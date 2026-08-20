import { NextRequest, NextResponse } from "next/server"
import { fetchAllData } from "@/lib/hubspot"
import { writeCache } from "@/lib/cache"
import { guardCronOrSession } from "@/lib/authz"

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const denied = await guardCronOrSession(req)
  if (denied) return denied

  try {
    const data = await fetchAllData()
    await writeCache(data)
    return NextResponse.json({ ok: true, fetchedAt: data.fetchedAt })
  } catch (err) {
    // Log detail server-side only. Previously this returned err.message AND
    // err.stack to the caller, leaking internal file paths.
    console.error("sync error:", err)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}
