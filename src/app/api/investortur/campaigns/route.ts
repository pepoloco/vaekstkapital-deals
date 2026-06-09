import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"

const BASE = "https://api.hubapi.com"
const KEY = process.env.HUBSPOT_API_KEY!
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Prefix match covering DK + SE, English + Danish naming. Excludes signup/registration lists.
function isInvestorList(name: string): boolean {
  const lower = name.toLowerCase()
  if (lower.includes("tilmeldte")) return false
  return (
    lower.startsWith("bu dk - investor tour") || lower.startsWith("bu dk - investortur") ||
    lower.startsWith("bu se - investor tour") || lower.startsWith("bu se - investortur")
  )
}

function extractCountry(name: string): "DK" | "SE" {
  return name.toLowerCase().startsWith("bu se") ? "SE" : "DK"
}

// Danish + English month name → zero-padded month number
const MONTHS: Record<string, string> = {
  januar: "01", january: "01",
  februar: "02", february: "02",
  marts: "03", march: "03",
  april: "04",
  maj: "05", may: "05",
  juni: "06", june: "06",
  juli: "07", july: "07",
  august: "08",
  september: "09",
  oktober: "10", october: "10",
  november: "11",
  december: "12",
}

function parseEventDate(name: string, fallback: string): string {
  // Try DD.MM.YYYY  e.g. "07.05.2025"
  const d = name.match(/(\d{2})\.(\d{2})\.(\d{4})/)
  if (d) return `${d[3]}-${d[2]}-${d[1]}`

  // Try "Month YYYY"  e.g. "April 2026" / "Maj 2026"
  const keys = Object.keys(MONTHS).join("|")
  const m = name.match(new RegExp(`\\b(${keys})\\b[^\\d]*(\\d{4})`, "i"))
  if (m) {
    const month = MONTHS[m[1].toLowerCase()]
    if (month) return `${m[2]}-${month}-01`
  }

  return (fallback || "").split("T")[0] || new Date().toISOString().split("T")[0]
}

type ListRaw = { listId: string; name: string; createdAt: string }

// v3 CRM lists search — query does substring matching, we filter to prefix client-side
async function searchLists(query: string): Promise<ListRaw[]> {
  const results: ListRaw[] = []
  let offset = 0
  let hasMore = true
  while (hasMore) {
    await sleep(200)
    const res = await fetch(`${BASE}/crm/v3/lists/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, count: 200, offset }),
      cache: "no-store",
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Lists search "${query}": ${res.status} ${err.slice(0, 300)}`)
    }
    const data = await res.json()
    for (const l of (data.lists ?? []) as Array<{ listId: string; name: string; createdAt: string }>) {
      if (isInvestorList(l.name)) {
        results.push({ listId: String(l.listId), name: l.name, createdAt: l.createdAt })
      }
    }
    hasMore = !!data.hasMore
    offset += (data.lists ?? []).length
  }
  return results
}

// Get exact participant count from the memberships endpoint (total field, limit=1 for speed)
async function getParticipantCount(listId: string): Promise<number> {
  await sleep(150)
  const res = await fetch(
    `${BASE}/crm/v3/lists/${listId}/memberships?limit=1`,
    { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" }
  )
  if (!res.ok) return 0
  const data = await res.json()
  return (data.total as number) ?? 0
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const seen = new Set<string>()
  const rawLists: ListRaw[] = []
  const errors: string[] = []

  const searches = await Promise.allSettled([
    searchLists("BU DK - Investor Tour"),
    searchLists("BU DK - Investortur"),
    searchLists("BU SE - Investor Tour"),
    searchLists("BU SE - Investortur"),
  ])

  for (const result of searches) {
    if (result.status === "fulfilled") {
      for (const l of result.value) {
        if (!seen.has(l.listId)) { seen.add(l.listId); rawLists.push(l) }
      }
    } else {
      errors.push(result.reason?.message ?? String(result.reason))
    }
  }

  type Campaign = { id: string; name: string; country: "DK" | "SE"; startDate: string; endDate: string; participantCount: number }

  // Build campaign objects and fetch participant counts in batches of 5
  const campaigns: Campaign[] = rawLists.map(l => ({
    id: l.listId,
    name: l.name,
    country: extractCountry(l.name),
    startDate: parseEventDate(l.name, l.createdAt),
    endDate: "",
    participantCount: 0,
  }))

  const BATCH = 5
  for (let i = 0; i < campaigns.length; i += BATCH) {
    await Promise.all(
      campaigns.slice(i, i + BATCH).map(async c => {
        c.participantCount = await getParticipantCount(c.id)
      })
    )
  }

  campaigns.sort((a, b) => b.startDate.localeCompare(a.startDate))

  return NextResponse.json({
    campaigns,
    ...(errors.length ? { errors } : {}),
  })
}
