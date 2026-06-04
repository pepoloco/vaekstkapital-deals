import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"

const ADMIN_DOMAINS = ["vaekstholdings.com", "vkfunddistribution.com"]
const ADMIN_EMAILS  = ["brj@vaekstkapital.dk", "sts@vaekstkapital.dk"]
const isAdmin = (email?: string | null) =>
  !!email && (
    ADMIN_DOMAINS.includes(email.split("@")[1]?.toLowerCase() ?? "") ||
    ADMIN_EMAILS.includes(email.toLowerCase())
  )

const BASE = "https://api.hubapi.com"
const KEY = process.env.HUBSPOT_API_KEY!

const PIPELINE_NAMES: Record<string, string> = {
  "312277465":  "VK Mortgage Fund",
  "317033164":  "SEE Residential A/S",
  "504393914":  "Sofia Residential A/S",
  "3285556461": "Vaekstkapital Invest A/S",
  "3391038697": "SRD LandHoldings A/S",
}

const STAGE_NAMES: Record<string, string> = {
  "497565675": "Closed Won",  "503960545": "Closed Won",  "517811422": "Closed Won",
  "766320087": "Closed Won",  "4500113624": "Closed Won", "4643302624": "Closed Won",
  "497565676": "Closed Lost", "503960546": "Closed Lost", "517811423": "Closed Lost",
  "766320088": "Closed Lost", "4500113625": "Closed Lost","4643302625": "Closed Lost",
  "497565672": "Subscription Form Sent", "503960544": "Subscription Form Sent",
  "517811421": "Subscription Form Sent", "766320086": "Subscription Form Sent",
  "4500113623": "Subscription Form Sent", "4643302626": "Subscription Form Sent",
  "5181367541": "Negotiations", "5181454546": "Negotiations",
  "5181446390": "Negotiations", "5181367542": "Negotiations",
  "5181446392": "Negotiations", "5181374699": "Negotiations",
}


const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function hsGet(path: string): Promise<Record<string, unknown>> {
  await sleep(200)
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`HubSpot GET ${path}: ${JSON.stringify(data)}`)
  return data
}

async function hsPost(path: string, body: object): Promise<Record<string, unknown>> {
  await sleep(200)
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`HubSpot POST ${path}: ${JSON.stringify(data)}`)
  return data
}

function normConsultant(name: string | null | undefined): string | null {
  if (!name) return null
  const s = name.trim().toLowerCase()
  if (!s || s === "n/a" || s === "pkb") return null
  if (s.startsWith("patrick")) return null
  if (s.startsWith("coac") || s.includes("vk administration")) return "COAC"
  if (s === "frank" || s.startsWith("frank w")) return "Frank Willis Eilersen"
  if (s.startsWith("tobias p")) return "Tobias Pedersen"
  if (s.startsWith("mathias")) return "Mathias Bro Jensen"
  if (s.startsWith("alexander") || s === "alexander roijej") return "Alexander Roijen"
  if (s.startsWith("brian")) return "Brian Jensen"
  if (s.startsWith("ole k")) return "Ole Krabbe"
  if (s.startsWith("mikkel l")) return "Mikkel Lauridsen"
  if (s.startsWith("emil")) return "Emil Antonsson"
  if (s.startsWith("jan e")) return "Jan Erik Dahl Hansen"
  if (s.startsWith("thomas n")) return "Thomas Nørby Pedersen"
  return name.trim()
}

async function getOwners(): Promise<Record<string, string>> {
  const byId: Record<string, string> = {}
  let after: string | undefined
  do {
    const url = `${BASE}/crm/v3/owners?limit=100${after ? `&after=${after}` : ""}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" })
    const data = await res.json()
    for (const o of data.results ?? []) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(" ")
      if (name) byId[String(o.id)] = name
    }
    after = (data.paging as { next?: { after: string } })?.next?.after
  } while (after)
  return byId
}

// Fetch contact IDs from a HubSpot list via the v3 lists memberships endpoint
async function getListContactIds(listId: string): Promise<string[]> {
  const ids: string[] = []
  let after: string | undefined
  do {
    await sleep(200)
    const params = new URLSearchParams({ limit: "500" })
    if (after) params.set("after", after)
    const res = await fetch(
      `${BASE}/crm/v3/lists/${listId}/memberships?${params}`,
      { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" }
    )
    if (!res.ok) break
    const data = await res.json()
    for (const r of (data.results as Array<{ recordId: string }>) ?? []) {
      ids.push(String(r.recordId))
    }
    after = (data.paging as { next?: { after: string } })?.next?.after
  } while (after)
  return ids
}

async function batchReadContacts(ids: string[]): Promise<Record<string, string>[]> {
  if (ids.length === 0) return []
  const results: Record<string, string>[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const data = await hsPost("/crm/v3/objects/contacts/batch/read", {
      inputs: chunk.map(id => ({ id })),
      properties: ["firstname", "lastname", "email", "hubspot_owner_id"],
    })
    for (const r of (data.results as Array<{ id: string; properties: Record<string, string> }>) ?? []) {
      results.push({ ...r.properties, hs_object_id: r.id })
    }
  }
  return results
}

async function getContactDealIds(contactId: string): Promise<string[]> {
  try {
    const data = await hsGet(`/crm/v3/objects/contacts/${contactId}/associations/deals`)
    return ((data.results as Array<{ id: string }>) ?? []).map(r => r.id)
  } catch {
    return []
  }
}

async function batchReadDeals(ids: string[]): Promise<Record<string, string>[]> {
  if (ids.length === 0) return []
  const results: Record<string, string>[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const data = await hsPost("/crm/v3/objects/deals/batch/read", {
      inputs: chunk.map(id => ({ id })),
      properties: [
        "dealname", "amount", "deal_currency_code", "dealstage", "pipeline",
        "createdate", "closedate", "investment_consultant", "fund_identifier",
        "hubspot_owner_id", "checked_by_coacs", "hs_is_closed_won",
      ],
    })
    for (const r of (data.results as Array<{ id: string; properties: Record<string, string> }>) ?? []) {
      results.push({ ...r.properties, hs_object_id: r.id })
    }
  }
  return results
}

async function getDealPipelineNames(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${BASE}/crm/v3/pipelines/deals`, {
      headers: { Authorization: `Bearer ${KEY}` },
      cache: "no-store",
    })
    const data = await res.json()
    const map: Record<string, string> = { ...PIPELINE_NAMES }
    for (const p of (data.results ?? []) as Array<{ id: string; label: string }>) {
      if (p.id && p.label) map[String(p.id)] = p.label
    }
    return map
  } catch {
    return PIPELINE_NAMES
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(session.user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(request.url)
  const listId    = url.searchParams.get("id") ?? ""
  const cutoffDate = url.searchParams.get("startDate") ?? url.searchParams.get("tourDate") ?? ""

  if (!listId) return NextResponse.json({ error: "Missing id parameter" }, { status: 400 })

  const [owners, contactIds, pipelineNames] = await Promise.all([
    getOwners(),
    getListContactIds(listId),
    getDealPipelineNames(),
  ])

  if (contactIds.length === 0) {
    return NextResponse.json({
      campaign: { id: listId, cutoffDate },
      contacts: [],
      fetchedAt: new Date().toISOString(),
    })
  }

  const contacts = await batchReadContacts(contactIds)

  // Fetch deal IDs for each contact sequentially to respect rate limits
  const contactDealIds: Record<string, string[]> = {}
  for (const id of contactIds) {
    contactDealIds[id] = await getContactDealIds(id)
  }

  const allDealIds = [...new Set(Object.values(contactDealIds).flat())]
  const allDeals = await batchReadDeals(allDealIds)
  const dealById = Object.fromEntries(allDeals.map(d => [d.hs_object_id, d]))

  const cutoffMs = cutoffDate ? new Date(cutoffDate).getTime() : 0

  // Use hs_is_closed_won so this works for all regions (DK, SE, etc.)
  const isQualifyingDeal = (d: Record<string, string>) =>
    d.hs_is_closed_won === "true" &&
    (d.checked_by_coacs === "✔" || d.checked_by_coacs === "true")

  const mapDeal = (d: Record<string, string>) => ({
    id: d.hs_object_id,
    name: d.dealname || "Unnamed",
    amount: parseFloat(d.amount) || 0,
    currency: d.deal_currency_code || "DKK",
    pipeline: pipelineNames[d.pipeline] || d.fund_identifier || "—",
    stage: STAGE_NAMES[d.dealstage] || "Closed Won",
    isClosedWon: true,
    isClosedLost: false,
    createdate: d.createdate,
    closedate: d.closedate || null,
    owner: owners[d.hubspot_owner_id] || normConsultant(d.investment_consultant) || "—",
  })

  const contactRows = contactIds.map(id => {
    const c = contacts.find(x => x.hs_object_id === id)
    // Only closed-won + checked by COACs
    const deals = (contactDealIds[id] ?? [])
      .map(did => dealById[did])
      .filter((d): d is Record<string, string> => !!d && isQualifyingDeal(d))
      .map(mapDeal)

    // Before = created before event start date; After = on or after
    const beforeDeals = deals
      .filter(d => cutoffMs === 0 || new Date(d.createdate).getTime() < cutoffMs)
      .sort((a, b) => new Date(b.createdate).getTime() - new Date(a.createdate).getTime())
    const afterDeals = deals
      .filter(d => cutoffMs > 0 && new Date(d.createdate).getTime() >= cutoffMs)
      .sort((a, b) => new Date(b.createdate).getTime() - new Date(a.createdate).getTime())

    return {
      id,
      name: [c?.firstname, c?.lastname].filter(Boolean).join(" ") || c?.email || "Unknown",
      email: c?.email || "",
      owner: owners[c?.hubspot_owner_id || ""] || "—",
      beforeDeals,
      afterDeals,
      beforeCount: beforeDeals.length,
      afterCount:  afterDeals.length,
      beforeTotal: beforeDeals.reduce((s, d) => s + d.amount, 0),
      afterTotal:  afterDeals.reduce((s, d) => s + d.amount, 0),
    }
  })

  return NextResponse.json({
    campaign: { id: listId, cutoffDate },
    contacts: contactRows,
    fetchedAt: new Date().toISOString(),
  })
}
