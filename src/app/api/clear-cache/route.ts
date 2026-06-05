import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"

const UPSTASH_URL   = process.env.KV_REST_API_URL   ?? process.env.UPSTASH_REST_API_URL
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REST_API_TOKEN

const KEYS_TO_DELETE = [
  "vk-pipeline-data",
  "vk-pipeline-data-0",
  "vk-pipeline-data-17424990",
  "vk-pipeline-data-17893427",
  "vk-pipeline-data-18387361",
  "vk-pipeline-data-17065112",
  "vk-pipeline-data-17435297",
]

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return NextResponse.json({ ok: true, mode: "memory", note: "No Redis configured — in-memory cache cleared on server restart" })
  }

  const results: Record<string, string> = {}
  for (const key of KEYS_TO_DELETE) {
    try {
      const res = await fetch(`${UPSTASH_URL}/del/${key}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        cache: "no-store",
      })
      const json = await res.json()
      results[key] = json.result === 1 ? "deleted" : "not found"
    } catch (e) {
      results[key] = `error: ${e}`
    }
  }

  return NextResponse.json({ ok: true, results })
}
