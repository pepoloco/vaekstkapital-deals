import { NextResponse } from "next/server"
import { guardCapability } from "@/lib/authz"
import { getTeamOwnerNames } from "@/lib/teams"

const BASE = "https://api.hubapi.com"
const KEY = process.env.HUBSPOT_API_KEY!
const SHIP_KEY = process.env.HUBSPOT_API_KEY_SHIPPING!
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const YEARS = [2024, 2025, 2026]

type RegionConfig = {
  label: string
  currency: string
  currencies: string[]          // currency codes to search (OR); SE includes DKK for SEE pipeline deals
  teamName: string | null       // null = all owners; string = fetch members of matching HubSpot team
  requireCoac: boolean
  hardcodedOwners?: string[]    // if set, bypasses team API and uses this name list directly
  hardcodedStartDates?: Record<string, string>  // consultant name → ISO date string (overrides HubSpot createdAt)
}

const REGIONS: Record<string, RegionConfig> = {
  dk: {
    label: "Denmark · Phone Sales",
    currency: "DKK",
    currencies: ["DKK"],
    teamName: "team denmark - phone sales",
    requireCoac: true,
  },
  se: {
    label: "Sweden · Phone Sales",
    currency: "SEK",
    currencies: ["SEK", "DKK"],  // SEE Residential pipeline uses DKK
    teamName: null,
    requireCoac: false,
    hardcodedOwners: ["Emil Antonsson", "Beshan Hashar"],
  },
  at: {
    label: "Austria",
    currency: "EUR",
    currencies: ["EUR"],
    teamName: null,
    requireCoac: true,
    hardcodedOwners: ["Michael Trost"],
    hardcodedStartDates: { "Michael Trost": "2026-02-27" },
  },
  shipping: {
    label: "Shipping",
    currency: "USD",
    currencies: ["USD"],
    teamName: null,
    requireCoac: false,
    hardcodedOwners: ["Bendik", "Magne Juvik", "Magnus Fischer", "Martin Engh"],
    hardcodedStartDates: {
      "Bendik":         "2025-05-14",
      "Magne Juvik":    "2025-05-14",
      "Magnus Fischer": "2025-05-14",
      "Martin Engh":    "2025-12-04",
    },
  },
}

// All words of target must appear in ownerName (case-insensitive)
function fuzzyMatch(ownerName: string, targets: string[]): string | null {
  const lower = ownerName.toLowerCase()
  for (const t of targets) {
    if (t.toLowerCase().split(/\s+/).every(w => lower.includes(w))) return t
  }
  return null
}

type OwnerInfo = { name: string; createdAt?: string }

async function getOwners(key = KEY): Promise<Record<string, OwnerInfo>> {
  const byId: Record<string, OwnerInfo> = {}
  let after: string | undefined
  do {
    await sleep(150)
    const url = `${BASE}/crm/v3/owners?limit=100${after ? `&after=${after}` : ""}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" })
    const data = await res.json()
    for (const o of (data.results ?? []) as Array<{ id: string; firstName: string; lastName: string; createdAt?: string }>) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(" ")
      if (name) byId[String(o.id)] = { name, createdAt: o.createdAt }
    }
    after = (data.paging as { next?: { after: string } })?.next?.after
  } while (after)
  return byId
}

async function searchDeals(currencies: string[], key = KEY): Promise<Record<string, string>[]> {
  const results: Record<string, string>[] = []
  let after: string | undefined
  const startMs = new Date("2024-01-01").getTime()
  const endMs   = new Date("2026-12-31T23:59:59Z").getTime()

  do {
    await sleep(200)
    const body: Record<string, unknown> = {
      // Multiple filterGroups = OR — one per currency so e.g. SE gets both SEK and DKK deals
      filterGroups: currencies.map(curr => ({
        filters: [
          { propertyName: "hs_is_closed_won",  operator: "EQ",  value: "true"          },
          { propertyName: "deal_currency_code", operator: "EQ",  value: curr            },
          { propertyName: "closedate",          operator: "GTE", value: String(startMs) },
          { propertyName: "closedate",          operator: "LTE", value: String(endMs)   },
        ],
      })),
      properties: ["dealname", "amount", "closedate", "checked_by_coacs", "hubspot_owner_id"],
      limit: 100,
    }
    if (after) body.after = after

    const res = await fetch(`${BASE}/crm/v3/objects/deals/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Deals search (${currencies}): ${JSON.stringify(data)}`)

    for (const r of (data.results ?? []) as Array<{ id: string; properties: Record<string, string> }>) {
      results.push({ ...r.properties, hs_object_id: r.id })
    }
    after = (data.paging as { next?: { after: string } })?.next?.after
  } while (after)

  return results
}

export async function GET(request: Request) {
  const denied = await guardCapability("canSalesReport")
  if (denied) return denied

  const url    = new URL(request.url)
  const region = (url.searchParams.get("region") ?? "dk").toLowerCase()
  const config = REGIONS[region] ?? REGIONS.dk

  const apiKey = region === "shipping" ? SHIP_KEY : KEY
  const [allDeals, owners, teamNames] = await Promise.all([
    searchDeals(config.currencies, apiKey),
    getOwners(apiKey),
    config.teamName ? getTeamOwnerNames(config.teamName) : Promise.resolve(null),
  ])
  const ownerFilter: string[] | null = config.hardcodedOwners ?? teamNames

  type DealRef = { id: string; name: string; amount: number }
  type Cell = { amount: number; count: number; deals: DealRef[] }
  const data: Record<string, Record<number, Record<number, Cell>>> = {}
  const ownerTotals: Record<string, number> = {}
  const startDates: Record<string, string> = {}  // consultant name → ISO date

  // Pre-seed hardcoded owners so they always appear even with no deals.
  // Build a name→ownerInfo reverse map for start-date lookup.
  if (ownerFilter) {
    const ownersByName: Record<string, OwnerInfo> = {}
    for (const info of Object.values(owners)) ownersByName[info.name.toLowerCase()] = info

    for (const target of ownerFilter) {
      ownerTotals[target] = ownerTotals[target] ?? 0
      if (!startDates[target]) {
        const hardcoded = config.hardcodedStartDates?.[target]
        if (hardcoded) {
          startDates[target] = hardcoded
        } else {
          // find the matching owner's createdAt via fuzzy match
          const matchedName = Object.keys(ownersByName).find(n =>
            target.toLowerCase().split(/\s+/).every(w => n.includes(w))
          )
          if (matchedName) startDates[target] = ownersByName[matchedName].createdAt ?? ""
        }
      }
    }
  }

  for (const d of allDeals) {
    if (config.requireCoac && d.checked_by_coacs !== "✔" && d.checked_by_coacs !== "true") continue

    const ownerInfo = owners[d.hubspot_owner_id]
    if (!ownerInfo) continue
    const rawName = ownerInfo.name

    const consultant = ownerFilter
      ? fuzzyMatch(rawName, ownerFilter)
      : rawName

    if (!consultant) continue
    if (!d.closedate) continue

    const date  = new Date(d.closedate)
    const year  = date.getFullYear()
    const month = date.getMonth() + 1
    if (year < 2024 || year > 2026) continue

    const amount = parseFloat(d.amount) || 0
    if (!data[consultant]) data[consultant] = {}
    if (!data[consultant][year]) data[consultant][year] = {}
    if (!data[consultant][year][month]) data[consultant][year][month] = { amount: 0, count: 0, deals: [] }
    data[consultant][year][month].amount += amount
    data[consultant][year][month].count  += 1
    data[consultant][year][month].deals.push({ id: d.hs_object_id, name: d.dealname || "Unknown Deal", amount })
    ownerTotals[consultant] = (ownerTotals[consultant] ?? 0) + amount
    if (!startDates[consultant]) {
      const hardcoded = config.hardcodedStartDates?.[consultant]
      startDates[consultant] = hardcoded ?? ownerInfo.createdAt ?? ""
    }
  }

  const consultants = Object.keys(ownerTotals).sort((a, b) => ownerTotals[b] - ownerTotals[a] || a.localeCompare(b))

  return NextResponse.json({
    region,
    label: config.label,
    currency: config.currency,
    consultants,
    years: YEARS,
    data,
    startDates,
    generatedAt: new Date().toISOString(),
  })
}
