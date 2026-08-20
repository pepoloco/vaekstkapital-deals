import { NextRequest, NextResponse } from "next/server"
import { guardRegion } from "@/lib/authz"
import { fetchClosedDeals } from "@/lib/hubspot"

export async function GET(req: NextRequest) {
  const denied = await guardRegion("dk")
  if (denied) return denied
  const from = req.nextUrl.searchParams.get("from") ?? ""
  const to   = req.nextUrl.searchParams.get("to") ?? ""
  try {
    const data = await fetchClosedDeals(from, to)
    return NextResponse.json(data)
  } catch (e) {
    console.error("closed-deals error:", e)
    return NextResponse.json({ error: "Kunne ikke hente closed deals" }, { status: 500 })
  }
}
