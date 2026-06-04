import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { fetchOpenDeals } from "@/lib/hubspot"

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const data = await fetchOpenDeals()
    return NextResponse.json(data)
  } catch (e) {
    console.error("open-deals error:", e)
    return NextResponse.json({ error: "Kunne ikke hente open deals" }, { status: 500 })
  }
}
