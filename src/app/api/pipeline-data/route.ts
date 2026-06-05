import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"

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
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = req.nextUrl.searchParams.get("brand")
  const key = brand ? `vk-pipeline-data-${brand}` : "vk-pipeline-data"

  const data = await readCache(key)
  if (!data) {
    if (brand) {
      // Try falling back to global if brand-specific not synced yet
      const global = await readCache("vk-pipeline-data")
      if (global) return NextResponse.json({ ...global, _brandFallback: true })
    }
    return NextResponse.json({ error: "No data — click Sync to fetch from HubSpot" }, { status: 404 })
  }
  return NextResponse.json(data)
}
