import { NextRequest, NextResponse } from "next/server"
import { guardRegion } from "@/lib/authz"
import { fetchSEClosedDeals } from "@/lib/hubspot"

export async function GET(req: NextRequest) {
  const denied = await guardRegion("se")
  if (denied) return denied
  const from = req.nextUrl.searchParams.get("from") ?? ""
  const to   = req.nextUrl.searchParams.get("to") ?? ""
  try {
    const data = await fetchSEClosedDeals(from, to)
    return NextResponse.json(data)
  } catch (e) {
    console.error("se-closed-deals error:", e)
    return NextResponse.json({ error: "Could not fetch SE closed deals" }, { status: 500 })
  }
}
