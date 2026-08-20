import { NextRequest, NextResponse } from "next/server"
import { guardRegion } from "@/lib/authz"
import { fetchNOClosedDeals } from "@/lib/hubspot"

export async function GET(req: NextRequest) {
  const denied = await guardRegion("no")
  if (denied) return denied
  const from = req.nextUrl.searchParams.get("from") ?? ""
  const to   = req.nextUrl.searchParams.get("to") ?? ""
  try {
    const data = await fetchNOClosedDeals(from, to)
    return NextResponse.json(data)
  } catch (e) {
    console.error("no-closed-deals error:", e)
    return NextResponse.json({ error: "Could not fetch NO closed deals" }, { status: 500 })
  }
}
