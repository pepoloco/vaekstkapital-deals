import { NextRequest, NextResponse } from "next/server"
import { fetchAllData } from "@/lib/hubspot"
import { writeCache } from "@/lib/cache"

export const maxDuration = 300

export async function GET(req: NextRequest) {
  try {
    const data = await fetchAllData()
    await writeCache(data)
    return NextResponse.json({ ok: true, fetchedAt: data.fetchedAt })
  } catch (err) {
    // Returner hele fejlen så vi kan se præcist hvad der går galt
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : ""
    console.error("Sync fejl:", err)
    return NextResponse.json({ 
      error: message,
      stack: stack,
    }, { status: 500 })
  }
}
