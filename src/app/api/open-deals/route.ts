import { NextResponse } from "next/server"
import { guardRegion } from "@/lib/authz"
import { fetchOpenDeals } from "@/lib/hubspot"

export async function GET() {
  const denied = await guardRegion("dk")
  if (denied) return denied

  try {
    const data = await fetchOpenDeals()
    return NextResponse.json(data)
  } catch (e) {
    console.error("open-deals error:", e)
    return NextResponse.json({ error: "Kunne ikke hente open deals" }, { status: 500 })
  }
}
