import { NextRequest, NextResponse } from "next/server"
import { guardRegion } from "@/lib/authz"
import { fetchATClosedDeals } from "@/lib/hubspot"

export async function GET(req: NextRequest) {
  const denied = await guardRegion("at")
  if (denied) return denied
  const from = req.nextUrl.searchParams.get("from") ?? ""
  const to   = req.nextUrl.searchParams.get("to") ?? ""
  try {
    const data = await fetchATClosedDeals(from, to)
    return NextResponse.json(data)
  } catch (e) {
    console.error("at-closed-deals error:", e)
    return NextResponse.json({ error: "Could not fetch AT closed deals" }, { status: 500 })
  }
}
