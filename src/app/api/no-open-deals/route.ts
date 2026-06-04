import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { fetchNOOpenDeals } from "@/lib/hubspot"

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const data = await fetchNOOpenDeals()
    return NextResponse.json(data)
  } catch (e) {
    console.error("no-open-deals error:", e)
    return NextResponse.json({ error: "Could not fetch NO open deals" }, { status: 500 })
  }
}
