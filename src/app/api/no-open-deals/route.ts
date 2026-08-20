import { NextResponse } from "next/server"
import { guardRegion } from "@/lib/authz"
import { fetchNOOpenDeals } from "@/lib/hubspot"

export async function GET() {
  const denied = await guardRegion("no")
  if (denied) return denied
  try {
    const data = await fetchNOOpenDeals()
    return NextResponse.json(data)
  } catch (e) {
    console.error("no-open-deals error:", e)
    return NextResponse.json({ error: "Could not fetch NO open deals" }, { status: 500 })
  }
}
