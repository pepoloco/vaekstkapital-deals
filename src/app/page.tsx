"use client"
import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

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
  { label: "Contact Pipeline", sub: "Lifecycle stages, stuck contacts, nurture candidates", href: "/pipeline", color: "#2d68b0" },
  { label: "Investor Tour",    sub: "VaekstNet investor onboarding & AUM",                 href: "/investortur", color: "#15624c" },
  { label: "Sales Report",     sub: "YTD subscription & fund performance",                 href: "/salgsrapport", color: "#5a4998" },
]

const PIPELINE_ALLOWED_EMAILS = new Set(["brj@vaekstkapital.dk","tnp@vaekstkapital.dk","sok@vaekstkapital.dk","spo@vaekstkapital.se","acs@vaekstkapital.se"])

function canSeePipeline(email?: string | null) {
  if (!email) return false
  const lc = email.toLowerCase()
  const domain = lc.split("@")[1] ?? ""
  return domain === "vkfunddistribution.com" || domain === "vaekstholdings.com" || PIPELINE_ALLOWED_EMAILS.has(lc)
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

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "inherit" }}>
      <nav style={{ background: NAV, height: 54, display: "flex", alignItems: "center", padding: "0 28px", position: "sticky", top: 0, zIndex: 50 }}>
        <img src="/vaekstkapital-logo.webp" height={22} style={{ filter: "brightness(0) invert(1)", opacity: 0.9 }} alt="Vaekstkapital" />
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "52px 24px 80px" }}>

        {/* Hero */}
        <div style={{ marginBottom: 52 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: INK, margin: 0, letterSpacing: "-.02em" }}>Dashboards</h1>
          <p style={{ color: MUTED, fontSize: 14, marginTop: 8 }}>Select a country or open a tool.</p>
        </div>

        {/* Country cards */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>Deal Reports by Country</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {COUNTRIES.map(c => (
              <a key={c.key} href={`/dashboard?region=${c.key}`} style={{ textDecoration: "none", borderRadius: 12, overflow: "hidden", border: "1px solid " + BORDER, background: "#fff", display: "block", transition: "box-shadow .15s", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}
                onMouseOver={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.12)")}
                onMouseOut={e => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.06)")}>
                <div style={{ height: 100, backgroundImage: `url(${c.flag})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)" }} />
                  <div style={{ position: "absolute", bottom: 14, left: 16 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".1em", color: "rgba(255,255,255,.8)", textTransform: "uppercase" }}>TEAM</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: ".02em" }}>{c.label}</div>
                  </div>
                </div>
                <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: MUTED }}>View deal reports</span>
                  <span style={{ color: MUTED, fontSize: 14 }}>→</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Tools section */}
        <div style={{ marginTop: 44 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>Analytics Tools</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {TOOLS.filter(t => t.href !== "/pipeline" || canSeePipeline(session?.user?.email)).map(t => (
              <a key={t.href} href={t.href} style={{ textDecoration: "none", borderRadius: 12, border: "1px solid " + BORDER, background: "#fff", padding: "20px 22px", display: "block", boxShadow: "0 1px 3px rgba(0,0,0,.06)", transition: "box-shadow .15s" }}
                onMouseOver={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.12)")}
                onMouseOut={e => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.06)")}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: t.color, marginBottom: 14 }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: INK, marginBottom: 6 }}>{t.label}</div>
                <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{t.sub}</div>
                <div style={{ marginTop: 16, fontSize: 12, color: t.color, fontWeight: 600 }}>Open →</div>
              </a>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
