import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { fetchFIClosedDeals } from "@/lib/hubspot"

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
