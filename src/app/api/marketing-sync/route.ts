import { NextResponse } from "next/server"
import { guardCapability } from "@/lib/authz"
import { runMarketingSync } from "@/lib/marketing-sync"

export const maxDuration = 60

const UPSTASH_URL   = process.env.KV_REST_API_URL   ?? process.env.UPSTASH_REST_API_URL
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REST_API_TOKEN
const CACHE_KEY = "vk-marketing-data"

let memCache: unknown = null

async function writeCache(data: unknown) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) { memCache = data; return }
  const res = await fetch(`${UPSTASH_URL}/set/${CACHE_KEY}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(JSON.stringify(data)),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Cache write failed: ${res.status} ${body.slice(0, 200)}`)
  }
}

export async function POST() {
  const denied = await guardCapability("canMarketing")
  if (denied) return denied

  try {
    const data = await runMarketingSync()
    await writeCache(data)
    return NextResponse.json({ ok: true, generatedAt: data.generatedAt })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
