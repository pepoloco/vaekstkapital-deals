import { NextResponse } from "next/server"
import { readCache } from "@/lib/cache"
import { requireUser, unauthorized } from "@/lib/authz"

export async function GET() {
  // Group-level VaekstNet KPIs (AUC, funnel, funds) — not country-scoped, so
  // any signed-in user may read it. If this ever starts carrying per-country
  // deal detail, add a region guard here.
  const u = await requireUser()
  if (!u) return unauthorized()

  const data = await readCache()
  if (!data) return NextResponse.json({ error: "Ingen data endnu — kør /api/sync" }, { status: 404 })

  return NextResponse.json(data)
}
