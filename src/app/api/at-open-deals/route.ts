import { NextResponse } from "next/server"
import { guardRegion } from "@/lib/authz"
import { fetchATOpenDeals } from "@/lib/hubspot"

export async function GET() {
  const denied = await guardRegion("at")
  if (denied) return denied
  try {
    const data = await fetchATOpenDeals()
    return NextResponse.json(data)
  } catch (e) {
    console.error("at-open-deals error:", e)
    return NextResponse.json({ error: "Could not fetch AT open deals" }, { status: 500 })
  }
}
