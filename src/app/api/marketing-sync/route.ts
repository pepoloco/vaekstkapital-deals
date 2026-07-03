import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"
import { runMarketingSync } from "@/lib/marketing-sync"

export const maxDuration = 60

const ADMIN_DOMAINS = ["vaekstholdings.com", "vkfunddistribution.com"]
const ADMIN_EMAILS = new Set(["tlm@vaekstnet.com"])
const isAdmin = (email?: string | null) =>
  !!email && (ADMIN_DOMAINS.includes(email.split("@")[1]?.toLowerCase() ?? "") || ADMIN_EMAILS.has(email.toLowerCase()))

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
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(session.user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const data = await runMarketingSync()
    await writeCache(data)
    return NextResponse.json({ ok: true, generatedAt: data.generatedAt })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
