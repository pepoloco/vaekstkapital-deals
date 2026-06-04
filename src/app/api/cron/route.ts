import { NextRequest, NextResponse } from "next/server"
import { fetchAllData } from "@/lib/hubspot"
import { writeCache } from "@/lib/cache"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const data = await fetchAllData()
    await writeCache(data)
    return NextResponse.json({ ok: true, fetchedAt: data.fetchedAt })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
