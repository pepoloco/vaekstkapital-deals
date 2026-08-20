import { NextRequest, NextResponse } from "next/server"
import { guardRegion } from "@/lib/authz"
import { fetchFIClosedDeals } from "@/lib/hubspot"

export async function GET(req: NextRequest) {
  const denied = await guardRegion("fi")
  if (denied) return denied
  const from = req.nextUrl.searchParams.get("from") ?? ""
  const to   = req.nextUrl.searchParams.get("to") ?? ""
  try {
    const data = await fetchFIClosedDeals(from, to)
    return NextResponse.json(data)
  } catch (e) {
    console.error("fi-closed-deals error:", e)
    return NextResponse.json({ error: "Could not fetch FI closed deals" }, { status: 500 })
  }
}
