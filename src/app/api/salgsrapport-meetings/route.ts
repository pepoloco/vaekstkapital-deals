import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"

const ADMIN_DOMAINS = ["vaekstholdings.com", "vkfunddistribution.com"]
const isAdmin = (email?: string | null) =>
  !!email && ADMIN_DOMAINS.includes(email.split("@")[1]?.toLowerCase() ?? "")

const BASE = "https://api.hubapi.com"
const KEY = process.env.HUBSPOT_API_KEY!
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const TEAM_NAME: Record<string, string | null> = {
  dk:       "team denmark",
  se:       null, // filter by ALLOWED_CONSULTANTS name list only
  at:       "team austria",
  shipping: null,
}

// Only show these consultants in the meetings report (by region)
const ALLOWED_CONSULTANTS: Record<string, Set<string> | null> = {
  dk: new Set([
    "Alexander Roijen",
    "Frank Willis Eilersen",
    "Brian Jensen",
    "Ole Krabbe",
    "Jan Erik Dahl Hansen",
    "Tobias Pedersen",
    "Mikkel Lauridsen",
  ]),
  se: new Set([
    "Simon Otterstedt",
    "Emil Antonsson",
  ]),
  at:       null,
  shipping: null,
}

const YEARS = [2024, 2025, 2026]

type MeetingData = {
  consultants: string[]
  years: number[]
  data: Record<string, Record<number, Record<number, number>>>
  generatedAt: string
}

async function getOwnerMaps(): Promise<{
  nameByOwnerId:  Record<string, string>
  nameByUserId:   Record<string, string>
  ownerIdByUserId: Record<string, string>
  userIdByOwnerId: Record<string, string>
}> {
  const nameByOwnerId:  Record<string, string> = {}
  const nameByUserId:   Record<string, string> = {}
  const ownerIdByUserId: Record<string, string> = {}
  const userIdByOwnerId: Record<string, string> = {}
  let after: string | undefined
  do {
    await sleep(100)
    const url = `${BASE}/crm/v3/owners?limit=100${after ? `&after=${after}` : ""}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" })
    const d = await res.json()
    for (const o of d.results ?? []) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(" ")
      const oid  = String(o.id)
      const uid  = o.userId ? String(o.userId) : ""
      if (name) {
        nameByOwnerId[oid] = name
        if (uid) {
          nameByUserId[uid]    = name
          ownerIdByUserId[uid] = oid
          userIdByOwnerId[oid] = uid
        }
      }
    }
    after = d.paging?.next?.after
  } while (after)
  return { nameByOwnerId, nameByUserId, ownerIdByUserId, userIdByOwnerId }
}

async function getTeamOwnerIds(teamName: string, userIdByOwnerId: Record<string, string>): Promise<{
  ownerIds: Set<string>
  userIds:  Set<string>
}> {
  const ownerIds = new Set<string>()
  const userIds  = new Set<string>()
  try {
    await sleep(80)
    const res  = await fetch(`${BASE}/settings/v3/users/teams?includeMembers=true`, {
      headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store",
    })
    if (!res.ok) return { ownerIds, userIds }
    const data = await res.json()
    const lower = teamName.toLowerCase()
    for (const team of data.results ?? []) {
      if ((team.name || "").toLowerCase().includes(lower)) {
        for (const uid of team.userIds ?? team.memberUserIds ?? []) {
          const s = String(uid)
          userIds.add(s)
          // We'll map userId → ownerId after we have both maps — they must be resolved together
        }
      }
    }
  } catch { /* fallback: empty → show all */ }
  // Resolve ownerIds from userIds
  for (const [oid, uid] of Object.entries(userIdByOwnerId)) {
    if (userIds.has(uid)) ownerIds.add(oid)
  }
  return { ownerIds, userIds }
}

async function fetchMeetings(fromMs: number, toMs: number): Promise<any[]> {
  const results: any[] = []
  let after: string | undefined
  do {
    await sleep(150)
    const body: any = {
      filterGroups: [{ filters: [
        { propertyName: "hs_createdate", operator: "GTE", value: String(fromMs) },
        { propertyName: "hs_createdate", operator: "LTE", value: String(toMs) },
      ]}],
      properties: ["hs_createdate", "hs_created_by_user_id", "hubspot_owner_id"],
      limit: 100,
    }
    if (after) body.after = after
    const res = await fetch(`${BASE}/crm/v3/objects/meetings/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    if (!res.ok) break
    const data = await res.json()
    results.push(...(data.results ?? []))
    after = data.paging?.next?.after
  } while (after)
  return results
}

function buildTable(
  meetings: any[],
  getKey: (m: any) => string | null,
  getName: (key: string) => string | null,
  allowedKeys: Set<string> | null,
  fromMs: number,
  toMs: number,
  allowedNames: Set<string> | null,
): MeetingData {
  const data: Record<string, Record<number, Record<number, number>>> = {}

  // Pre-seed from allowlist so consultants appear even with zero data
  if (allowedNames) {
    for (const name of allowedNames) data[name] = {}
  }

  for (const m of meetings) {
    const key  = getKey(m)
    if (!key || (allowedKeys && !allowedKeys.has(key))) continue
    const name = getName(key)
    if (!name) continue
    if (allowedNames && !allowedNames.has(name)) continue

    const ts = m.properties?.hs_createdate
    if (!ts) continue
    const date = new Date(ts)
    const ms   = date.getTime()
    if (ms < fromMs || ms > toMs) continue

    const year  = date.getFullYear()
    const month = date.getMonth() + 1
    if (!YEARS.includes(year)) continue

    if (!data[name])         data[name] = {}
    if (!data[name][year])   data[name][year] = {}
    data[name][year][month] = (data[name][year][month] || 0) + 1
  }

  const consultants = Object.keys(data).sort((a, b) => {
    const ta = Object.values(data[a]).flatMap(y => Object.values(y)).reduce((s, n) => s + n, 0)
    const tb = Object.values(data[b]).flatMap(y => Object.values(y)).reduce((s, n) => s + n, 0)
    return tb - ta
  })

  return { consultants, years: YEARS, data, generatedAt: new Date().toISOString() }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(session.user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url    = new URL(request.url)
  const region = (url.searchParams.get("region") ?? "dk").toLowerCase()
  const from   = url.searchParams.get("from")
  const to     = url.searchParams.get("to")

  const fromMs = from ? new Date(from).getTime()                  : new Date("2024-01-01").getTime()
  const toMs   = to   ? new Date(to).getTime() + 86400000 - 1    : Date.now()

  const { nameByOwnerId, nameByUserId, userIdByOwnerId } = await getOwnerMaps()
  const teamName = TEAM_NAME[region] ?? null

  let allowedOwnerIds: Set<string> | null = null
  let allowedUserIds:  Set<string> | null = null

  if (teamName) {
    const { ownerIds, userIds } = await getTeamOwnerIds(teamName, userIdByOwnerId)
    if (ownerIds.size > 0) {
      allowedOwnerIds = ownerIds
      allowedUserIds  = userIds
    }
  }

  const meetings   = await fetchMeetings(fromMs, toMs)
  const allowedNames = ALLOWED_CONSULTANTS[region] ?? null

  const booked = buildTable(
    meetings,
    m => m.properties?.hs_created_by_user_id ? String(m.properties.hs_created_by_user_id) : null,
    uid => nameByUserId[uid] ?? null,
    allowedUserIds,
    fromMs,
    toMs,
    allowedNames,
  )

  const attended = buildTable(
    meetings,
    m => m.properties?.hubspot_owner_id ? String(m.properties.hubspot_owner_id) : null,
    oid => nameByOwnerId[oid] ?? null,
    allowedOwnerIds,
    fromMs,
    toMs,
    allowedNames,
  )

  return NextResponse.json({ booked, attended })
}
