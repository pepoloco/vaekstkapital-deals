import { NextResponse } from "next/server"
import { guardRegion } from "@/lib/authz"
import { fetchSEOpenDeals } from "@/lib/hubspot"

export async function GET() {
  const denied = await guardRegion("se")
  if (denied) return denied
  try {
    const data = await fetchSEOpenDeals()
    return NextResponse.json(data)
  } catch (e) {
    console.error("se-open-deals error:", e)
    return NextResponse.json({ error: "Could not fetch SE open deals" }, { status: 500 })
  }
}
