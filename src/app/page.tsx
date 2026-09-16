"use client"
import { useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { getAccess as resolveAccess } from "@/lib/access"

const BG = "#F5F2EC", NAV = "#1a1a2e", INK = "#1a1a2e", MUTED = "#6b7280", BORDER = "#e5e0d8"

const COUNTRIES = [
  { key: "dk",   label: "Denmark",  flag: "/dk-flag.jpg" },
  { key: "se",   label: "Sweden",   flag: "/se-flag.jpeg" },
  { key: "ship", label: "Shipping", flag: "/ship-icon.jpg" },
  { key: "at",   label: "Austria",  flag: "/austria-flag.webp" },
  { key: "fi",   label: "Finland",  flag: "/finland-flag.jpg" },
  { key: "no",   label: "Norway",   flag: "/norway-flag.jpg" },
]

const TOOLS = [
  { label: "Contact Pipeline",    sub: "Lifecycle stages, stuck contacts, nurture candidates",     href: "/pipeline",                  color: "#2d68b0", adminOnly: false },
  { label: "Investor Tour",       sub: "VaekstNet investor onboarding & AUM",                     href: "/investortur",               color: "#15624c", adminOnly: false },
  { label: "Seminars",            sub: "Webinar attendees — pre & post-investment activity",        href: "/seminars",                  color: "#7c3aed", adminOnly: false },
  { label: "Investor Dinners",   sub: "Event attendees — pre & post-investment activity",          href: "/investor-dinners",          color: "#b45309", adminOnly: false },
  { label: "Sales Report",        sub: "YTD subscription & fund performance",                     href: "/salgsrapport",              color: "#5a4998", adminOnly: false },
  { label: "Marketing Reports",   sub: "Platform ad spend, leads & deal attribution by market",   href: "/marketing",                 color: "#0091ae", adminOnly: false },
  { label: "Compass · Vaekstnet", sub: "DK & SE monthly performance — meetings, deals, team KPIs", href: "/dashboard?region=compass", color: "#6d3b8e", adminOnly: false, compassOnly: true, underConstruction: true },
]

// All access rules live in src/lib/access.ts, shared with the server guards in
// src/lib/authz.ts so the UI and the API can never disagree about who sees what.
// This gating is UX only — the API routes enforce the same rules independently.
function getAccess(email?: string | null) {
  const a = resolveAccess(email)
  return {
    isAdmin: a.isAdmin,
    canPipelineTour: a.canPipeline,
    canSalesReport: a.canSalesReport,
    canMarketing: a.canMarketing,
    canCompass: a.canCompass,
    myCountryKey: a.region,
  }
}


export default function HubPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: MUTED, fontSize: 13 }}>Loading…</p>
      </div>
    )
  }

  const { isAdmin, canPipelineTour, canSalesReport, canMarketing, canCompass, myCountryKey } = getAccess(session?.user?.email)
  const showTools = isAdmin || canPipelineTour || canSalesReport || canMarketing || canCompass

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "inherit" }}>
      <nav style={{ background: NAV, height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", position: "sticky", top: 0, zIndex: 50 }}>
        <img src="/vaekstkapital-logo.webp" height={22} style={{ filter: "brightness(0) invert(1)", opacity: 0.9 }} alt="Vaekstkapital" />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {session?.user?.email && (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,.45)" }}>{session.user.email}</span>
          )}
          <button onClick={() => signOut({ callbackUrl: "/login" })} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.25)", color: "rgba(255,255,255,.75)", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            Sign Out
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "52px 24px 80px" }}>

        {/* Hero */}
        <div style={{ marginBottom: 52 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: INK, margin: 0, letterSpacing: "-.02em" }}>Dashboards</h1>
          <p style={{ color: MUTED, fontSize: 14, marginTop: 8 }}>Select a country or open a tool.</p>
        </div>

        {/* Country cards — all visible, only authorized one(s) are clickable */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>Deal Reports by Country</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {COUNTRIES.map(c => {
              const clickable = isAdmin || myCountryKey === c.key
              return (
                <div
                  key={c.key}
                  onClick={() => clickable && router.push(`/dashboard?region=${c.key}`)}
                  onMouseOver={e => { if (clickable) (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,.12)" }}
                  onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(0,0,0,.06)" }}
                  style={{ borderRadius: 12, overflow: "hidden", border: "1px solid " + BORDER, background: "#fff", display: "block", transition: "box-shadow .15s", boxShadow: "0 1px 3px rgba(0,0,0,.06)", cursor: clickable ? "pointer" : "default", opacity: clickable ? 1 : 0.4 }}
                >
                  <div style={{ height: 100, backgroundImage: `url(${c.flag})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)" }} />
                    <div style={{ position: "absolute", bottom: 14, left: 16 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".1em", color: "rgba(255,255,255,.8)", textTransform: "uppercase" }}>TEAM</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: ".02em" }}>{c.label}</div>
                    </div>
                  </div>
                  <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: MUTED }}>{clickable ? "View deal reports" : "No access"}</span>
                    {clickable && <span style={{ color: MUTED, fontSize: 14 }}>→</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Analytics Tools — only shown to users with at least one tool access */}
        {showTools && (
          <div style={{ marginTop: 44 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>Analytics Tools</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {TOOLS.filter(t => {
                if ((t as any).compassOnly) return canCompass
                if (t.adminOnly) return isAdmin
                if (t.href === "/pipeline" || t.href === "/investortur" || t.href === "/seminars" || t.href === "/investor-dinners") return canPipelineTour
                if (t.href === "/salgsrapport") return canSalesReport
                if (t.href === "/marketing") return canMarketing
                return false
              }).map(t => (
                <a key={t.href} href={t.href} style={{ textDecoration: "none", borderRadius: 12, border: "1px solid " + BORDER, background: "#fff", padding: "20px 22px", display: "block", boxShadow: "0 1px 3px rgba(0,0,0,.06)", transition: "box-shadow .15s" }}
                  onMouseOver={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.12)")}
                  onMouseOut={e => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.06)")}>
                  <div style={{ width: 36, height: 4, borderRadius: 2, background: t.color, marginBottom: 14 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{t.label}</div>
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{t.sub}</div>
                  {(t as any).underConstruction && (
                    <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: "#dc2626", letterSpacing: ".02em" }}>Under construction</div>
                  )}
                  <div style={{ marginTop: 14 }}>
                    <span style={{ display: "inline-block", background: "#2563eb", color: "#fff", fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 6 }}>Open</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
