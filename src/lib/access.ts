/**
 * Single source of truth for WHO MAY SEE WHAT.
 *
 * Pure logic, no server imports — safe to use from both client components and
 * API routes. Server routes must go through src/lib/authz.ts, which wraps this
 * with the session lookup. Client pages import it directly for UX gating.
 *
 * Keep all access rules here. Duplicating them per-page is how allowlists drift
 * apart and people silently lose (or gain) access.
 */

export type Region = "dk" | "se" | "at" | "fi" | "no" | "ship"

export const ALL_REGIONS: Region[] = ["dk", "se", "at", "fi", "no", "ship"]

/** Domains that see everything, in every country, in every tool. */
export const ADMIN_DOMAINS = new Set([
  "vaekstholdings.com",
  "vkfunddistribution.com",
  "vaekstnet.com",
  "vaekstkapital.com",
])

/** Country-scoped domains: each sees only its own country. */
export const COUNTRY_DOMAIN: Record<Region, string> = {
  dk:   "vaekstkapital.dk",
  se:   "vaekstkapital.se",
  at:   "vaekstkapital.at",
  fi:   "vaekstkapital.fi",
  no:   "vaekstkapital.no",
  ship: "vk-shipping.com",
}

/** HubSpot business-unit id -> region (used by /api/pipeline-data?brand=). */
export const BRAND_TO_REGION: Record<string, Region> = {
  "0":        "dk",
  "17424990": "se",
  "17893427": "ship",
  "18387361": "at",
  "17065112": "fi",
  "17435297": "no",
}

export const REGION_TO_BRAND: Record<Region, string> = Object.fromEntries(
  Object.entries(BRAND_TO_REGION).map(([brand, region]) => [region, brand]),
) as Record<Region, string>

/** Named individuals granted Contact Pipeline + Investor Tour. */
export const PIPELINE_TOUR_EXCEPTIONS = new Set([
  "brj@vaekstkapital.dk",
  "tnp@vaekstkapital.dk",
  "sok@vaekstkapital.dk",
  "aro@vaekstkapital.dk",
  "sts@vaekstkapital.dk",
  "spo@vaekstkapital.se",
  "acs@vaekstkapital.se",
  "nry@vaekstkapital.se",
])

/** Non-admin emails granted Sales Report, mapped to the regions they may see. */
export const SALES_REPORT_EXCEPTIONS: Record<string, Region[]> = {
  "sok@vaekstkapital.dk": ["dk"],
}

/** Domain exclusively allowed to access the Compass · Vaekstnet section. */
export const COMPASS_DOMAIN = "vkfunddistribution.com"

export type Access = {
  email: string
  domain: string
  isAdmin: boolean
  /** The single region this user is scoped to, or null for admins (= all). */
  region: Region | null
  /** Every region this user may read. Admins get all of them. */
  regions: Region[]
  canPipeline: boolean
  canTour: boolean
  canSalesReport: boolean
  canMarketing: boolean
  /** Compass · Vaekstnet: vkfunddistribution.com only, regardless of admin status. */
  canCompass: boolean
}

/** Canonical form of an email before any trust decision is made. */
export function normaliseEmail(raw: string | null | undefined): string {
  if (!raw) return ""
  const s = raw.normalize("NFKC").trim().toLowerCase()
  if ((s.match(/@/g) ?? []).length !== 1) return ""
  if (/[\s -]/.test(s)) return ""
  return s
}

/** Resolve an email to its full access profile. */
export function getAccess(rawEmail: string | null | undefined): Access {
  const email = normaliseEmail(rawEmail)
  const domain = email.split("@")[1] ?? ""
  const isAdmin = ADMIN_DOMAINS.has(domain)

  const region = isAdmin
    ? null
    : ((Object.entries(COUNTRY_DOMAIN).find(([, d]) => d === domain)?.[0] as Region | undefined) ?? null)

  const canPipeline =
    isAdmin || PIPELINE_TOUR_EXCEPTIONS.has(email) || domain === "vaekstkapital.at"

  return {
    email,
    domain,
    isAdmin,
    region,
    regions: isAdmin ? [...ALL_REGIONS] : region ? [region] : [],
    canPipeline,
    canTour: canPipeline,
    canSalesReport: isAdmin || email in SALES_REPORT_EXCEPTIONS,
    canMarketing: isAdmin,
    canCompass: isAdmin || domain === COMPASS_DOMAIN || domain === "vaekstnet.com",
  }
}

/** May this user read data for `region`? */
export function canReadRegion(a: Access, region: Region): boolean {
  return a.isAdmin || a.region === region
}

/** Regions this user may see in the Sales Report. null = all. */
export function salesReportRegions(a: Access): Region[] | null {
  if (a.isAdmin) return null
  return SALES_REPORT_EXCEPTIONS[a.email] ?? []
}

/** Countries this user may see in the Investor Tour (DK/SE campaigns). */
export function tourCountries(a: Access): Array<"DK" | "SE"> {
  if (a.isAdmin || a.domain === "vaekstkapital.at") return ["DK", "SE"]
  if (a.region === "se") return ["SE"]
  if (a.region === "dk") return ["DK"]
  return []
}
