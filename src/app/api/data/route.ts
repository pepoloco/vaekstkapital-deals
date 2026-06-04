import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { readCache } from "@/lib/cache"

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const data = await readCache()
  if (!data) return NextResponse.json({ error: "Ingen data endnu — kør /api/sync" }, { status: 404 })

  return NextResponse.json(data)
}
