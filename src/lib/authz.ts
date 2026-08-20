import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"
import {
  getAccess,
  canReadRegion as canRead,
  salesReportRegions as srRegions,
  BRAND_TO_REGION,
  type Access,
  type Region,
} from "@/lib/access"

/**
 * Server-side authorisation for API routes.
 *
 * IMPORTANT: the checks in src/app/**\/page.tsx are UX only — they decide what
 * to render and are trivially bypassed with curl. Every API route that returns
 * data must call one of the guards here. Never rely on the client gate alone.
 *
 * All rules live in src/lib/access.ts so the server and the UI cannot drift.
 */

export type { Access, Region }
export { BRAND_TO_REGION }
export const canReadRegion = canRead
export const salesReportRegions = srRegions

/**
 * The authenticated + authorised user, or null if not signed in.
 * Always passes authOptions — a bare getServerSession() skips the configured
 * callbacks and only works by accident via the NEXTAUTH_SECRET env fallback.
 */
export async function requireUser(): Promise<Access | null> {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return null
  const access = getAccess(email)
  if (!access.email) return null
  return access
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

/**
 * True when the request carries the Vercel cron bearer token.
 * Length-checked constant-time compare so response timing does not leak the
 * secret one byte at a time.
 */
export function isCronRequest(req: { headers: { get(name: string): string | null } }): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  if (header.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

/**
 * Guard for a region-scoped data route. Returns a NextResponse to return
 * early, or null when the request is allowed.
 *
 *   const denied = await guardRegion("se"); if (denied) return denied
 */
export async function guardRegion(region: Region) {
  const u = await requireUser()
  if (!u) return unauthorized()
  if (!canRead(u, region)) return forbidden()
  return null
}

/** Guard for admin-only routes. */
export async function guardAdmin() {
  const u = await requireUser()
  if (!u) return unauthorized()
  if (!u.isAdmin) return forbidden()
  return null
}

/** Guard for a capability flag, e.g. guardCapability("canPipeline"). */
export async function guardCapability(
  cap: "canPipeline" | "canTour" | "canSalesReport" | "canMarketing",
) {
  const u = await requireUser()
  if (!u) return unauthorized()
  if (!u[cap]) return forbidden()
  return null
}

/** Guard for sync routes: Vercel cron (CRON_SECRET) or any signed-in user. */
export async function guardCronOrSession(req: { headers: { get(name: string): string | null } }) {
  if (isCronRequest(req)) return null
  const u = await requireUser()
  if (!u) return unauthorized()
  return null
}
