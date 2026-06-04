const UPSTASH_URL   = process.env.KV_REST_API_URL!
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN!
const KEY = "vn-data"

export async function readCache(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${UPSTASH_URL}/get/${KEY}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      cache: "no-store",
    })
    const json = await res.json()
    if (!json.result) return null

    // Parse indtil vi har et objekt (Upstash kan double-encode)
    let value = json.result
    while (typeof value === "string") {
      value = JSON.parse(value)
    }
    return value as Record<string, unknown>
  } catch (e) {
    console.error("readCache error:", e)
    return null
  }
}

export async function writeCache(data: unknown): Promise<void> {
  const res = await fetch(`${UPSTASH_URL}/set/${KEY}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(JSON.stringify(data)),
    cache: "no-store",
  })
  const result = await res.json()
  console.log("writeCache:", result.result ?? result.error)
}
