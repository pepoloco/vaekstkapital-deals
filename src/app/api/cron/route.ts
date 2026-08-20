import { NextRequest, NextResponse } from "next/server"
import { fetchAllData } from "@/lib/hubspot"
import { writeCache } from "@/lib/cache"
import { guardCronOrSession } from "@/lib/authz"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const denied = await guardCronOrSession(req)
  if (denied) return denied

  try {
    const data = await fetchAllData()
    await writeCache(data)
    return NextResponse.json({ ok: true, fetchedAt: data.fetchedAt })
  } catch (err) {
    // Log detail server-side only — never return message/stack to the client.
    console.error("cron sync error:", err)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}
