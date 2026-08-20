import { NextResponse } from "next/server"
import { guardRegion } from "@/lib/authz"
import { fetchFIOpenDeals } from "@/lib/hubspot"

export async function GET() {
  const denied = await guardRegion("fi")
  if (denied) return denied
  try {
    const data = await fetchFIOpenDeals()
    return NextResponse.json(data)
  } catch (e) {
    console.error("fi-open-deals error:", e)
    return NextResponse.json({ error: "Could not fetch FI open deals" }, { status: 500 })
  }
}
