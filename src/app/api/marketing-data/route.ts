import { NextResponse } from "next/server"
import { guardCapability } from "@/lib/authz"

const UPSTASH_URL   = process.env.KV_REST_API_URL   ?? process.env.UPSTASH_REST_API_URL
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REST_API_TOKEN
const CACHE_KEY = "vk-marketing-data"

async function readCache(): Promise<unknown | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null
  const res = await fetch(`${UPSTASH_URL}/get/${CACHE_KEY}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  const json = await res.json()
  if (!json.result) return null
  let value = json.result
  while (typeof value === "string") value = JSON.parse(value)
  return value
}

export async function GET() {
  const denied = await guardCapability("canMarketing")
  if (denied) return denied

  const data = await readCache()
  if (!data) return NextResponse.json({ error: "No data synced yet" }, { status: 404 })
  return NextResponse.json(data)
}
