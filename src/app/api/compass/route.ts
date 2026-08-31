import { NextResponse } from "next/server"
import { requireUser, forbidden, unauthorized } from "@/lib/authz"

const BASE  = "https://api.hubapi.com"
const KEY   = () => process.env.HUBSPOT_API_KEY!
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function hsPost(path: string, body: object, attempt = 0): Promise<any> {
  await sleep(300)
  const res = await fetch(`${BASE}${path}`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
    cache:   "no-store",
  })
  if (res.status === 429 && attempt < 5) {
    await sleep(2000 * (attempt + 1))
    return hsPost(path, body, attempt + 1)
  }
  return res.json()
}

async function searchAll(objectType: string, filterGroups: object[], properties: string[]): Promise<Record<string, string>[]> {
  const results: Record<string, string>[] = []
  let after: string | undefined
  do {
    const body: Record<string, unknown> = { filterGroups, properties, limit: 200 }
    if (after) body.after = after
    const data = await hsPost(`/crm/v3/objects/${objectType}/search`, body)
    for (const r of data.results ?? []) {
      results.push({ ...r.properties, hs_object_id: r.id })
    }
    after = data.paging?.next?.after
  } while (after)
  return results
}

type OwnerMaps = {
  byId:     Record<string, string>   // ownerId → name
  byUserId: Record<string, string>   // userId  → ownerId
}

async function getOwnerMaps(): Promise<OwnerMaps> {
  const byId:     Record<string, string> = {}
  const byUserId: Record<string, string> = {}
  let after: string | undefined
  do {
    await sleep(150)
    const url = `${BASE}/crm/v3/owners?limit=100${after ? `&after=${after}` : ""}`
    const res  = await fetch(url, { headers: { Authorization: `Bearer ${KEY()}` }, cache: "no-store" })
    const data = await res.json()
    for (const o of data.results ?? []) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(" ")
      if (name) {
        byId[String(o.id)] = name
        if (o.userId) byUserId[String(o.userId)] = String(o.id)
      }
    }
    after = data.paging?.next?.after
  } while (after)
  return { byId, byUserId }
}

type TeamRole = "consultant" | "manager" | "director" | "other"

type TeamMember = {
  name:     string
  ownerId:  string     // HubSpot owner ID (matches hubspot_owner_id on deals/meetings)
  role:     TeamRole
  teamName: string
  country:  "dk" | "se" | "other"
}

async function getTeamMembers(owners: OwnerMaps): Promise<TeamMember[]> {
  try {
    const res  = await fetch(`${BASE}/settings/v3/users/teams?includeMembers=true`, {
      headers: { Authorization: `Bearer ${KEY()}` }, cache: "no-store",
    })
    if (!res.ok) return []
    const data    = await res.json()
    const members: TeamMember[] = []
    const seen    = new Set<string>() // ownerId+role dedupe

    for (const team of data.results ?? []) {
      const tl     = (team.name || "").toLowerCase()
      const role: TeamRole =
        tl.includes("consultant") ? "consultant" :
        tl.includes("manager")   ? "manager"    :
        tl.includes("director")  ? "director"   : "other"

      const country: TeamMember["country"] =
        tl.includes("denmark") || tl.includes(" dk") || tl.startsWith("dk ") || tl.includes("(dk)") ? "dk" :
        tl.includes("sweden")  || tl.includes(" se") || tl.startsWith("se ") || tl.includes("(se)") ? "se" : "other"

      for (const uid of team.userIds ?? team.memberUserIds ?? []) {
        const ownerId = owners.byUserId[String(uid)]
        if (!ownerId) continue
        const name = owners.byId[ownerId]
        if (!name) continue
        const dedupeKey = `${ownerId}::${role}`
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)
        members.push({ name, ownerId, role, teamName: team.name, country })
      }
    }
    return members
  } catch {
    return []
  }
}

async function fetchSEPipelineIds(): Promise<string[]> {
  const res  = await fetch(`${BASE}/crm/v3/pipelines/deals`, {
    headers: { Authorization: `Bearer ${KEY()}` }, cache: "no-store",
  })
  const data = await res.json()
  return (data.results ?? [])
    .filter((p: any) => (p.label || "").toUpperCase().includes("BU SE"))
    .map((p: any) => p.id as string)
}

const DK_WON   = ["497565675","503960545","517811422","766320087","4500113624","4643302624"]
const DK_OPEN  = ["497565672","503960544","517811421","766320086","4500113623","4643302626"]
const DEAL_PROPS = ["dealname","amount","closedate","createdate","hubspot_owner_id","endavu_deal_id","hs_object_id","pipeline","investment_consultant","deal_tm_owner"]

async function fetchDKWon(fromMs: number, toMs: number) {
  const r = await Promise.all(DK_WON.map(id =>
    searchAll("deals", [{ filters: [
      { propertyName: "dealstage", operator: "EQ",  value: id            },
      { propertyName: "closedate", operator: "GTE", value: String(fromMs) },
      { propertyName: "closedate", operator: "LTE", value: String(toMs)  },
    ]}], DEAL_PROPS)
  ))
  return r.flat()
}

async function fetchSEWon(fromMs: number, toMs: number, sePipelineIds: string[]) {
  if (sePipelineIds.length === 0) return []
  const r = await Promise.all(sePipelineIds.map(id =>
    searchAll("deals", [{ filters: [
      { propertyName: "pipeline",         operator: "EQ",  value: id            },
      { propertyName: "hs_is_closed_won", operator: "EQ",  value: "true"        },
      { propertyName: "closedate",        operator: "GTE", value: String(fromMs) },
      { propertyName: "closedate",        operator: "LTE", value: String(toMs)  },
    ]}], DEAL_PROPS)
  ))
  return r.flat()
}

async function fetchDKSent(fromMs: number, toMs: number) {
  const r = await Promise.all(DK_OPEN.map(id =>
    searchAll("deals", [{ filters: [
      { propertyName: "dealstage",  operator: "EQ",  value: id            },
      { propertyName: "createdate", operator: "GTE", value: String(fromMs) },
      { propertyName: "createdate", operator: "LTE", value: String(toMs)  },
    ]}], ["dealname","hubspot_owner_id","hs_object_id","createdate"])
  ))
  return r.flat()
}

async function fetchMeetings(fromMs: number, toMs: number) {
  return searchAll("meetings", [{ filters: [
    { propertyName: "hs_meeting_outcome", operator: "EQ",  value: "COMPLETED"   },
    { propertyName: "hs_timestamp",       operator: "GTE", value: String(fromMs) },
    { propertyName: "hs_timestamp",       operator: "LTE", value: String(toMs)  },
  ]}], ["hs_meeting_outcome","hs_timestamp","hubspot_owner_id"])
}

async function fetchCalls(fromMs: number, toMs: number) {
  // No status filter — count all call attempts (connected + no answer + busy etc.)
  // so the total matches the Sales Activity report
  return searchAll("calls", [{ filters: [
    { propertyName: "hs_timestamp", operator: "GTE", value: String(fromMs) },
    { propertyName: "hs_timestamp", operator: "LTE", value: String(toMs)  },
  ]}], ["hs_call_duration","hs_timestamp","hubspot_owner_id","hs_call_status"])
}

function resolveOwner(d: Record<string, string>, byId: Record<string, string>): string {
  return d.investment_consultant?.trim() ||
    byId[d.deal_tm_owner]       ||
    byId[d.hubspot_owner_id]    ||
    "—"
}

// Parse "YYYY-MM-DD" or "YYYY-MM" into { fromMs, toMs, label }
function parseDate(s: string | null, fallback: Date): Date {
  if (!s) return fallback
  // Full date
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number)
    return new Date(y, m - 1, d)
  }
  // Year-month only
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split("-").map(Number)
    return new Date(y, m - 1, 1)
  }
  return fallback
}

function parsePeriod(from: string | null, to: string | null, fallbackFrom: Date, fallbackTo: Date) {
  const f = parseDate(from, fallbackFrom)
  const t = parseDate(to,   fallbackTo)
  const fromMs = f.getTime()
  const toMs   = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59, 999).getTime()
  const fmtD   = (d: Date) => d.toLocaleDateString("da-DK", { day:"numeric", month:"short", year:"numeric" })
  const label  = fromMs === toMs - (23*3600+59*60+59)*1000 - 999
    ? fmtD(f)
    : `${fmtD(f)} – ${fmtD(t)}`
  return { fromMs, toMs, label }
}

export async function GET(req: Request) {
  const user = await requireUser()
  if (!user) return unauthorized()
  if (!user.canCompass) return forbidden()

  const url  = new URL(req.url)
  const now  = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevEnd    = new Date(now.getFullYear(), now.getMonth(), 0)

  const primary = parsePeriod(
    url.searchParams.get("from"),
    url.searchParams.get("to"),
    monthStart, now
  )
  const hasCompare = url.searchParams.has("compareFrom")
  const compare = hasCompare
    ? parsePeriod(
        url.searchParams.get("compareFrom"),
        url.searchParams.get("compareTo"),
        prevStart, prevEnd
      )
    : null

  // Upper bound for historical scan = furthest toMs we need
  const latestTo = Math.max(primary.toMs, compare?.toMs ?? 0)
  const histFrom = new Date(2022, 0, 1).getTime()

  // Shared fetches
  const [owners, sePipelineIds] = await Promise.all([
    getOwnerMaps(),
    fetchSEPipelineIds(),
  ])

  const teamMembers = await getTeamMembers(owners)

  // Historical won deals (for New vs Reinvestment classification)
  const [histDKWon, histSEWon] = await Promise.all([
    fetchDKWon(histFrom, latestTo),
    fetchSEWon(histFrom, latestTo, sePipelineIds),
  ])

  // Build investor first-deal timestamp (keyed by normalised dealname)
  const firstDeal: Record<string, number> = {}
  ;[...histDKWon, ...histSEWon]
    .sort((a, b) => new Date(a.closedate).getTime() - new Date(b.closedate).getTime())
    .forEach(d => {
      const k = (d.dealname || "").toLowerCase().trim()
      if (k && firstDeal[k] === undefined) firstDeal[k] = new Date(d.closedate).getTime()
    })

  const isNewInvestor = (d: Record<string, string>, periodFrom: number) => {
    const k     = (d.dealname || "").toLowerCase().trim()
    const first = firstDeal[k]
    return first === undefined || first >= periodFrom
  }

  // Build owner ID sets per country for meetings attribution
  const dkOwnerIds = new Set(teamMembers.filter(m => m.country === "dk").map(m => m.ownerId))
  const seOwnerIds = new Set(teamMembers.filter(m => m.country === "se").map(m => m.ownerId))

  const computeMonth = async (fromMs: number, toMs: number, label: string) => {
    const [dkWon, seWon, dkSent, meetings, calls] = await Promise.all([
      fetchDKWon(fromMs, toMs),
      fetchSEWon(fromMs, toMs, sePipelineIds),
      fetchDKSent(fromMs, toMs),
      fetchMeetings(fromMs, toMs),
      fetchCalls(fromMs, toMs),
    ])

    // Meetings by owner
    const meetingsByOwner: Record<string, number> = {}
    for (const m of meetings) {
      if (m.hubspot_owner_id) meetingsByOwner[m.hubspot_owner_id] = (meetingsByOwner[m.hubspot_owner_id] ?? 0) + 1
    }

    // Calls by owner
    const callsByOwner: Record<string, { count: number; totalMs: number }> = {}
    for (const c of calls) {
      const oid = c.hubspot_owner_id
      if (!oid) continue
      if (!callsByOwner[oid]) callsByOwner[oid] = { count: 0, totalMs: 0 }
      callsByOwner[oid].count++
      callsByOwner[oid].totalMs += parseInt(c.hs_call_duration || "0") || 0
    }

    const summariseDealSet = (deals: Record<string, string>[]) => {
      let value = 0, newInv = 0, reinv = 0
      for (const d of deals) {
        value += parseFloat(d.amount) || 0
        if (isNewInvestor(d, fromMs)) newInv++; else reinv++
      }
      return { dealValue: value, newInvestments: newInv, reinvestment: reinv, totalInvestment: newInv + reinv }
    }

    const attrDealSet = (deals: Record<string, string>[]) => {
      let newC = 0, vnC = 0, existC = 0
      for (const d of deals) {
        if (d.endavu_deal_id) vnC++
        else if (isNewInvestor(d, fromMs)) newC++
        else existC++
      }
      return { new: newC, vaekstnet: vnC, existingInvestor: existC }
    }

    const dkMeetings = dkOwnerIds.size > 0
      ? [...dkOwnerIds].reduce((s, id) => s + (meetingsByOwner[id] ?? 0), 0)
      : meetings.length // fallback: all meetings if no team config
    const seMeetings = [...seOwnerIds].reduce((s, id) => s + (meetingsByOwner[id] ?? 0), 0)

    const dkStats = { label, qualityMeetings: dkMeetings, dealsSent: dkSent.length, ...summariseDealSet(dkWon) }
    const seStats = { label, qualityMeetings: seMeetings, dealsSent: 0,             ...summariseDealSet(seWon) }

    // Per-person stats
    type PS = {
      name: string; role: TeamRole; teamName: string; country: TeamMember["country"]
      qualityMeetings: number; totalCalls: number; avgCallMinutes: number
      wonDeals: number; wonAmount: number; newInvestments: number; reinvestment: number
    }
    const personMap: Record<string, PS> = {}
    for (const m of teamMembers) {
      const cd = callsByOwner[m.ownerId]
      const avgMs = (cd && cd.count > 0) ? cd.totalMs / cd.count : 0
      personMap[m.ownerId] = {
        name: m.name, role: m.role, teamName: m.teamName, country: m.country,
        qualityMeetings: meetingsByOwner[m.ownerId] ?? 0,
        totalCalls:      cd?.count ?? 0,
        avgCallMinutes:  Math.round(avgMs / 60000 * 10) / 10,
        wonDeals: 0, wonAmount: 0, newInvestments: 0, reinvestment: 0,
      }
    }

    for (const d of [...dkWon, ...seWon]) {
      const ownerName = resolveOwner(d, owners.byId)
      // Match by name to ownerId
      const member = teamMembers.find(m => m.name === ownerName)
      const ps     = member ? personMap[member.ownerId] : undefined
      if (!ps) continue
      ps.wonDeals++
      ps.wonAmount += parseFloat(d.amount) || 0
      if (isNewInvestor(d, fromMs)) ps.newInvestments++; else ps.reinvestment++
    }

    return {
      label,
      summary:     { dk: dkStats, se: seStats },
      attribution: { dk: attrDealSet(dkWon), se: attrDealSet(seWon) },
      people:      Object.values(personMap).sort((a, b) => b.wonAmount - a.wonAmount),
    }
  }

  // Run periods sequentially to stay within HubSpot rate limits
  const primaryData = await computeMonth(primary.fromMs, primary.toMs, primary.label)
  const compareData = compare ? await computeMonth(compare.fromMs, compare.toMs, compare.label) : null

  return NextResponse.json({
    primary:     primaryData,
    compare:     compareData,
    // Keep legacy names so existing state that hasn't re-fetched still works
    thisMonth:   primaryData,
    lastMonth:   compareData ?? primaryData,
    teamMembers: teamMembers.map(m => ({ name: m.name, role: m.role, teamName: m.teamName, country: m.country })),
    generatedAt: new Date().toISOString(),
  })
}
