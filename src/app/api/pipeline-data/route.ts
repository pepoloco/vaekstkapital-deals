import { NextRequest, NextResponse } from "next/server"
import { requireUser, unauthorized, forbidden, BRAND_TO_REGION, canReadRegion } from "@/lib/authz"

const UPSTASH_URL   = process.env.KV_REST_API_URL   ?? process.env.UPSTASH_REST_API_URL
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REST_API_TOKEN

let memCache: Record<string, unknown> = {}

async function readCache(key: string) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return memCache[key] ?? null
  const res = await fetch(`${UPSTASH_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    cache: "no-store",
  })
  const json = await res.json()
  if (!json.result) return null
  let value = json.result
  while (typeof value === "string") value = JSON.parse(value)
  return value
}

export async function GET(req: NextRequest) {
  const u = await requireUser()
  if (!u) return unauthorized()
  if (!u.canPipeline) return forbidden()

  const brand = req.nextUrl.searchParams.get("brand")

  // A country-scoped user may only read their own brand. Admins read any.
  if (brand) {
    const region = BRAND_TO_REGION[brand]
    if (!region) return NextResponse.json({ error: "Unknown brand" }, { status: 400 })
    if (!canReadRegion(u, region)) return forbidden()
  } else if (!u.isAdmin) {
    // No brand = the cross-brand global view. Country-scoped users are
    // redirected to their own brand instead of seeing every country.
    if (!u.region) return forbidden()
    const own = Object.entries(BRAND_TO_REGION).find(([, r]) => r === u.region)?.[0]
    if (!own) return forbidden()
    const scoped = await readCache(`vk-pipeline-data-${own}`)
    if (scoped) return NextResponse.json(scoped)
    return NextResponse.json({ error: "No data — click Sync to fetch from HubSpot" }, { status: 404 })
  }

  const key = brand ? `vk-pipeline-data-${brand}` : "vk-pipeline-data"
  const data = await readCache(key)
  if (!data) {
    // Fall back to the global blob only for admins — for a country-scoped user
    // that would leak every other country's pipeline.
    if (brand && u.isAdmin) {
      const global = await readCache("vk-pipeline-data")
      if (global) return NextResponse.json({ ...global, _brandFallback: true })
    }
    return NextResponse.json({ error: "No data — click Sync to fetch from HubSpot" }, { status: 404 })
  }
  return NextResponse.json(data)
}
