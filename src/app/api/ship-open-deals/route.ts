import { NextResponse } from "next/server"
import { guardRegion } from "@/lib/authz"
import { fetchShipOpenDeals } from "@/lib/hubspot"

export async function GET() {
  const denied = await guardRegion("ship")
  if (denied) return denied
  try {
    const data = await fetchShipOpenDeals()
    return NextResponse.json(data)
  } catch (e) {
    console.error("ship-open-deals error:", e)
    return NextResponse.json({ error: "Could not fetch Ship open deals" }, { status: 500 })
  }
}
