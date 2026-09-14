import { NextResponse } from "next/server"
import { guardCapability } from "@/lib/authz"

const BASE = "https://api.hubapi.com"
const KEY = process.env.HUBSPOT_API_KEY!
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Match lists named like:
//   "BU DK - Webinar 12.05.26 - Attended & replays"
//   "DK - Webinar 19.08.25 attendees and replays"
//   "DK - SR Webinar June 18 2025 - attendees and replays"
// Must contain "webinar" + ("attended" or "replay"), exclude "deals won" segment.
function isWebinarList(name: string): boolean {
  const lower = name.toLowerCase()
  if (!lower.includes("webinar")) return false
  if (lower.includes("deals won")) return false
  if (!lower.includes("attended") && !lower.includes("replay")) return false
  return (
    lower.startsWith("bu dk") || lower.startsWith("bu se") ||
    lower.startsWith("dk -") || lower.startsWith("dk–") ||
    lower.startsWith("se -") || lower.startsWith("se–")
  )
}

function extractCountry(name: string): "DK" | "SE" {
  const lower = name.toLowerCase()
  return lower.startsWith("bu se") || lower.startsWith("se -") || lower.startsWith("se–") ? "SE" : "DK"
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
  // Try DD.MM.YYYY or DD/MM/YYYY (4-digit year)
  const d4 = name.match(/(\d{2})[./](\d{2})[./](\d{4})/)
  if (d4) return `${d4[3]}-${d4[2]}-${d4[1]}`

  // Try DD.MM.YY or DD/MM/YY (2-digit year → 20YY)
  const d2 = name.match(/(\d{2})[./](\d{2})[./](\d{2})(?!\d)/)
  if (d2) return `20${d2[3]}-${d2[2]}-${d2[1]}`

  const keys = Object.keys(MONTHS).join("|")

  // Try "Month D(D) YYYY" or "Month D(D), YYYY" e.g. "June 18 2025" / "May 22, 2025"
  const mdy = name.match(new RegExp(`\\b(${keys})\\b\\s+(\\d{1,2}),?\\s+(\\d{4})`, "i"))
  if (mdy) {
    const month = MONTHS[mdy[1].toLowerCase()]
    if (month) return `${mdy[3]}-${month}-${String(mdy[2]).padStart(2, "0")}`
  }

  // Try "Month YYYY" e.g. "April 2026" / "Maj 2026"
  const my = name.match(new RegExp(`\\b(${keys})\\b[^\\d]*(\\d{4})`, "i"))
  if (my) {
    const month = MONTHS[my[1].toLowerCase()]
    if (month) return `${my[2]}-${month}-01`
  }

  return (fallback || "").split("T")[0] || new Date().toISOString().split("T")[0]
}

type ListRaw = { listId: string; name: string; createdAt: string }

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
      if (isWebinarList(l.name)) {
        results.push({ listId: String(l.listId), name: l.name, createdAt: l.createdAt })
      }
    }
    hasMore = !!data.hasMore
    offset += (data.lists ?? []).length
  }
  return results
}

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
  const denied = await guardCapability("canTour")
  if (denied) return denied

  const seen = new Set<string>()
  const rawLists: ListRaw[] = []
  const errors: string[] = []

  const searches = await Promise.allSettled([
    searchLists("BU DK - Webinar"),
    searchLists("BU SE - Webinar"),
    searchLists("DK - Webinar"),
    searchLists("SE - Webinar"),
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
