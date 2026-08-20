import { NextRequest, NextResponse } from "next/server"
import { guardRegion } from "@/lib/authz"
import { fetchShipClosedDeals } from "@/lib/hubspot"

export async function GET(req: NextRequest) {
  const denied = await guardRegion("ship")
  if (denied) return denied
  const from = req.nextUrl.searchParams.get("from") ?? ""
  const to   = req.nextUrl.searchParams.get("to") ?? ""
  try {
    const data = await fetchShipClosedDeals(from, to)
    return NextResponse.json(data)
  } catch (e) {
    console.error("ship-closed-deals error:", e)
    return NextResponse.json({ error: "Could not fetch Ship closed deals" }, { status: 500 })
  }
}
