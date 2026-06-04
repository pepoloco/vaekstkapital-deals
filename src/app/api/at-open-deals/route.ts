import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { fetchATOpenDeals } from "@/lib/hubspot"

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const data = await fetchATOpenDeals()
    return NextResponse.json(data)
  } catch (e) {
    console.error("at-open-deals error:", e)
    return NextResponse.json({ error: "Could not fetch AT open deals" }, { status: 500 })
  }
}
