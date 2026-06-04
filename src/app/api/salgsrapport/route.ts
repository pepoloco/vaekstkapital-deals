import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"

const ADMIN_DOMAINS = ["vaekstholdings.com", "vkfunddistribution.com"]
const isAdmin = (email?: string | null) =>
  !!email && ADMIN_DOMAINS.includes(email.split("@")[1]?.toLowerCase() ?? "")

const BASE = "https://api.hubapi.com"
const KEY = process.env.HUBSPOT_API_KEY!
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const YEARS = [2024, 2025, 2026]

type RegionConfig = {
  label: string
  currency: string
  ownerFilter: string[] | null  // null = all owners with deals
  requireCoac: boolean
}

const REGIONS: Record<string, RegionConfig> = {
  dk: {
    label: "Denmark · Phone Sales",
    currency: "DKK",
    ownerFilter: [
      "Ole Krabbe",
      "Brian Jensen",
      "Frank Willis Eilersen",
      "Alexander Roijen",
      "Mikkel Lauridsen",
      "Mathias Bro Jensen",
      "Tobias Pedersen",
      "Jan Erik Dahl Hansen",
      "Thomas Thallaug",
    ],
    requireCoac: true,
  },
  se: {
    label: "Sweden · Phone Sales",
    currency: "SEK",
    ownerFilter: null,
    requireCoac: true,
  },
  at: {
    label: "Austria",
    currency: "EUR",
    ownerFilter: ["Michael Trost"],
    requireCoac: true,
  },
  shipping: {
    label: "Shipping",
    currency: "USD",
    ownerFilter: null,
    requireCoac: false,  // Shipping does not use COACs
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

async function getOwners(): Promise<Record<string, string>> {
  const byId: Record<string, string> = {}
  let after: string | undefined
  do {
    await sleep(150)
    const url = `${BASE}/crm/v3/owners?limit=100${after ? `&after=${after}` : ""}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" })
    const data = await res.json()
    for (const o of (data.results ?? []) as Array<{ id: string; firstName: string; lastName: string }>) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(" ")
      if (name) byId[String(o.id)] = name
    }
    after = (data.paging as { next?: { after: string } })?.next?.after
  } while (after)
  return byId
}

async function searchDeals(currency: string): Promise<Record<string, string>[]> {
  const results: Record<string, string>[] = []
  let after: string | undefined
  const startMs = new Date("2024-01-01").getTime()
  const endMs   = new Date("2026-12-31T23:59:59Z").getTime()

  do {
    await sleep(200)
    const body: Record<string, unknown> = {
      filterGroups: [{
        filters: [
          { propertyName: "hs_is_closed_won",  operator: "EQ",  value: "true"          },
          { propertyName: "deal_currency_code", operator: "EQ",  value: currency        },
          { propertyName: "closedate",          operator: "GTE", value: String(startMs) },
          { propertyName: "closedate",          operator: "LTE", value: String(endMs)   },
        ],
      }],
      properties: ["amount", "closedate", "checked_by_coacs", "hubspot_owner_id"],
      limit: 100,
    }
    if (after) body.after = after

    const res = await fetch(`${BASE}/crm/v3/objects/deals/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Deals search (${currency}): ${JSON.stringify(data)}`)

    for (const r of (data.results ?? []) as Array<{ id: string; properties: Record<string, string> }>) {
      results.push({ ...r.properties, hs_object_id: r.id })
    }
    after = (data.paging as { next?: { after: string } })?.next?.after
  } while (after)

  return results
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(session.user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url    = new URL(request.url)
  const region = (url.searchParams.get("region") ?? "dk").toLowerCase()
  const config = REGIONS[region] ?? REGIONS.dk

  const [allDeals, owners] = await Promise.all([searchDeals(config.currency), getOwners()])

  type Cell = { amount: number; count: number }
  const data: Record<string, Record<number, Record<number, Cell>>> = {}
  const ownerTotals: Record<string, number> = {}

  for (const d of allDeals) {
    if (config.requireCoac && d.checked_by_coacs !== "✔" && d.checked_by_coacs !== "true") continue

    const rawName = owners[d.hubspot_owner_id]
    if (!rawName) continue

    const consultant = config.ownerFilter
      ? fuzzyMatch(rawName, config.ownerFilter)
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
    if (!data[consultant][year][month]) data[consultant][year][month] = { amount: 0, count: 0 }
    data[consultant][year][month].amount += amount
    data[consultant][year][month].count  += 1
    ownerTotals[consultant] = (ownerTotals[consultant] ?? 0) + amount
  }

  // Fixed lists keep specified order; dynamic lists sort by total desc
  const consultants = config.ownerFilter
    ? config.ownerFilter.filter(c => data[c])
    : Object.keys(ownerTotals).sort((a, b) => ownerTotals[b] - ownerTotals[a])

  return NextResponse.json({
    region,
    label: config.label,
    currency: config.currency,
    consultants,
    years: YEARS,
    data,
    generatedAt: new Date().toISOString(),
  })
}
