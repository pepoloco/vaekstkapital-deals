"use client"
// @ts-nocheck
import { useEffect, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

const ADMIN_DOMAINS = ["vaekstholdings.com", "vkfunddistribution.com"]
const isAdmin = (email?: string | null) =>
  !!email && ADMIN_DOMAINS.includes(email?.split("@")[1]?.toLowerCase() ?? "")

const YEARS = [2024, 2025, 2026]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const TODAY = new Date()
const YTD_LABEL = TODAY.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

const TABS = [
  { key: "dk",       label: "Denmark",  flagImg: "/dk-flag.jpg",       subtitle: "Phone Sales · DKK",     coac: true  },
  { key: "se",       label: "Sweden",   flagImg: "/se-flag.jpeg",      subtitle: "Phone Sales · SEK",     coac: true  },
  { key: "at",       label: "Austria",  flagImg: "/austria-flag.webp", subtitle: "Team Austria · EUR",    coac: true  },
  { key: "shipping", label: "Shipping", flagImg: "/ship-icon.jpg",     subtitle: "All owners · USD",      coac: false },
]

// Stable colour map — new team members automatically get palette colours via getClr()
const DK_CLR: Record<string, { bg: string; text: string; light: string }> = {
  "Ole Krabbe":            { bg: "#6d28d9", text: "#fff", light: "#ede9fe" },
  "Brian Jensen":          { bg: "#1d4ed8", text: "#fff", light: "#dbeafe" },
  "Frank Willis Eilersen": { bg: "#065f46", text: "#fff", light: "#d1fae5" },
  "Alexander Roijen":      { bg: "#92400e", text: "#fff", light: "#fef3c7" },
  "Mikkel Lauridsen":      { bg: "#be123c", text: "#fff", light: "#ffe4e6" },
  "Mathias Bro Jensen":    { bg: "#0369a1", text: "#fff", light: "#e0f2fe" },
  "Tobias Pedersen":       { bg: "#3730a3", text: "#fff", light: "#e0e7ff" },
  "Jan Erik Dahl Hansen":  { bg: "#c2410c", text: "#fff", light: "#ffedd5" },
}

// Rotating palette for dynamic regions (SE, Shipping)
const PALETTE = [
  { bg: "#6d28d9", text: "#fff", light: "#ede9fe" },
  { bg: "#1d4ed8", text: "#fff", light: "#dbeafe" },
  { bg: "#065f46", text: "#fff", light: "#d1fae5" },
  { bg: "#92400e", text: "#fff", light: "#fef3c7" },
  { bg: "#be123c", text: "#fff", light: "#ffe4e6" },
  { bg: "#0369a1", text: "#fff", light: "#e0f2fe" },
  { bg: "#3730a3", text: "#fff", light: "#e0e7ff" },
  { bg: "#c2410c", text: "#fff", light: "#ffedd5" },
  { bg: "#0f766e", text: "#fff", light: "#ccfbf1" },
]

function getClr(consultant: string, index: number, region: string) {
  if (region === "dk" && DK_CLR[consultant]) return DK_CLR[consultant]
  return PALETTE[index % PALETTE.length]
}

// Annual sales targets per region → consultant → year (0 = no target set)
// Frank, Alexander, Brian Jensen: 120 M DKK/year — all others: 60 M DKK/year
const TARGETS: Record<string, Record<string, Record<number, number>>> = {
  dk: {
    "Ole Krabbe":            { 2024: 60_000_000, 2025: 60_000_000, 2026: 60_000_000 },
    "Brian Jensen":          { 2024: 120_000_000, 2025: 120_000_000, 2026: 120_000_000 },
    "Frank Willis Eilersen": { 2024: 120_000_000, 2025: 120_000_000, 2026: 120_000_000 },
    "Alexander Roijen":      { 2024: 120_000_000, 2025: 120_000_000, 2026: 120_000_000 },
    "Mikkel Lauridsen":      { 2024: 60_000_000, 2025: 60_000_000, 2026: 60_000_000 },
    "Mathias Bro Jensen":    { 2024: 60_000_000, 2025: 60_000_000, 2026: 60_000_000 },
    "Tobias Pedersen":       { 2024: 60_000_000, 2025: 60_000_000, 2026: 60_000_000 },
    "Jan Erik Dahl Hansen":  { 2024: 60_000_000, 2025: 60_000_000, 2026: 60_000_000 },
  },
  se:       {},
  at:       {},
  shipping: {},
}

function fmtCell(n: number): string {
  if (n <= 0) return ""
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000)     return Math.round(n / 1_000) + "K"
  return Math.round(n).toLocaleString("en-DK")
}

type Cell = { amount: number; count: number }
type ReportData = {
  region: string
  label: string
  currency: string
  consultants: string[]
  years: number[]
  data: Record<string, Record<number, Record<number, Cell>>>
  generatedAt: string
}

function FlagImg({ src, label }: { src: string; label: string }) {
  return (
    <img
      src={src} alt={label}
      style={{ width: 32, height: 22, objectFit: "cover", borderRadius: 3, flexShrink: 0, display: "block" }}
    />
  )
}

function SalesTable({ report }: { report: ReportData }) {
  const { region, currency, consultants, data } = report

  if (consultants.length === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--ink3)", fontSize: 13, fontStyle: "italic" }}>
        No qualifying deals found ({currency} · 2024–2026)
      </div>
    )
  }

  const colTotals: Record<string, Record<number, number>> = {}
  for (const c of consultants) {
    colTotals[c] = {}
    for (const y of YEARS) {
      colTotals[c][y] = Object.values(data[c]?.[y] ?? {}).reduce((s, cell) => s + cell.amount, 0)
    }
  }

  const bdr  = "1px solid var(--bdr)"
  const bdr2 = "2px solid var(--bdr)"

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{
              padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 600,
              letterSpacing: ".07em", textTransform: "uppercase", color: "var(--ink3)",
              borderBottom: bdr2, borderRight: bdr2, verticalAlign: "bottom", whiteSpace: "nowrap",
            }}>Month</th>
            {consultants.map((c, ci) => {
              const clr = getClr(c, ci, region)
              return (
                <th key={c} colSpan={YEARS.length} style={{
                  padding: "10px 12px", textAlign: "center", fontSize: 11, fontWeight: 700,
                  background: clr.bg, color: clr.text,
                  borderRight: bdr2, borderBottom: "none", whiteSpace: "nowrap",
                }}>{c}</th>
              )
            })}
          </tr>
          <tr>
            {consultants.map((c, ci) =>
              YEARS.map((y, yi) => {
                const clr    = getClr(c, ci, region)
                const isLast = yi === YEARS.length - 1
                return (
                  <th key={`${c}-${y}`} style={{
                    padding: "5px 10px", textAlign: "right", fontSize: 9, fontWeight: 700,
                    color: clr.bg, background: clr.light,
                    borderBottom: bdr, borderRight: isLast ? bdr2 : bdr, whiteSpace: "nowrap",
                  }}>
                    {y === 2026 ? "2026 YTD" : String(y)}
                  </th>
                )
              })
            )}
          </tr>

          {/* Target row */}
          <tr>
            <th style={{
              padding: "5px 16px", textAlign: "left", fontSize: 9, fontWeight: 600,
              letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink3)",
              borderBottom: bdr, borderRight: bdr2, whiteSpace: "nowrap", background: "var(--bg)",
            }}>Target</th>
            {consultants.map((c, ci) =>
              YEARS.map((y, yi) => {
                const target = TARGETS[region]?.[c]?.[y] ?? 0
                const isLast = yi === YEARS.length - 1
                return (
                  <th key={`${c}-${y}`} style={{
                    padding: "5px 10px", textAlign: "right", fontSize: 9, fontWeight: 600,
                    color: "var(--ink3)", background: "var(--bg)",
                    borderBottom: bdr, borderRight: isLast ? bdr2 : bdr, whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {target > 0 ? fmtCell(target) : <span style={{ color: "var(--bdr)" }}>—</span>}
                  </th>
                )
              })
            )}
          </tr>

          {/* % of Target row */}
          <tr>
            <th style={{
              padding: "5px 16px", textAlign: "left", fontSize: 9, fontWeight: 600,
              letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink3)",
              borderBottom: bdr2, borderRight: bdr2, whiteSpace: "nowrap", background: "var(--bg)",
            }}>% of Target</th>
            {consultants.map((c, ci) =>
              YEARS.map((y, yi) => {
                const total  = colTotals[c]?.[y] ?? 0
                const target = TARGETS[region]?.[c]?.[y] ?? 0
                const isLast = yi === YEARS.length - 1
                const pct    = target > 0 ? (total / target) * 100 : null
                const pctColor = pct === null ? "var(--bdr)"
                  : pct >= 100 ? "#059669"
                  : pct >= 75  ? "#d97706"
                  : pct >= 50  ? "#ea580c"
                  : "#dc2626"
                return (
                  <th key={`${c}-${y}`} style={{
                    padding: "5px 10px", textAlign: "right", fontSize: 10, fontWeight: 700,
                    color: pctColor, background: "var(--bg)",
                    borderBottom: bdr2, borderRight: isLast ? bdr2 : bdr, whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {pct !== null ? `${pct.toFixed(1)}%` : "—"}
                  </th>
                )
              })
            )}
          </tr>
        </thead>
        <tbody>
          {MONTHS.map((month, mi) => {
            const monthNum = mi + 1
            return (
              <tr key={month} style={{ background: mi % 2 === 0 ? "var(--card)" : "var(--bg)" }}>
                <td style={{
                  padding: "9px 16px", fontWeight: 600, fontSize: 12, color: "var(--ink2)",
                  borderRight: bdr2, borderBottom: bdr, whiteSpace: "nowrap",
                }}>{month}</td>
                {consultants.map((c, ci) =>
                  YEARS.map((y, yi) => {
                    const cell   = data[c]?.[y]?.[monthNum]
                    const amount = cell?.amount ?? 0
                    const count  = cell?.count  ?? 0
                    const isLast = yi === YEARS.length - 1
                    const clr    = getClr(c, ci, region)
                    return (
                      <td key={`${c}-${y}`} style={{
                        padding: "7px 10px", textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        borderRight: isLast ? bdr2 : bdr, borderBottom: bdr,
                        verticalAlign: "middle",
                      }}>
                        {amount > 0 ? (
                          <>
                            <div style={{ fontSize: 13, fontWeight: 700, color: clr.bg, lineHeight: 1.2 }}>
                              {fmtCell(amount)}
                            </div>
                            <div style={{ fontSize: 9, color: "var(--ink3)", lineHeight: 1.3 }}>
                              {count} deal{count !== 1 ? "s" : ""}
                            </div>
                          </>
                        ) : (
                          <span style={{ color: "var(--bdr)", fontSize: 11 }}>—</span>
                        )}
                      </td>
                    )
                  })
                )}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: bdr2 }}>
            <td style={{
              padding: "10px 16px", fontWeight: 700, fontSize: 10, color: "var(--ink1)",
              letterSpacing: ".06em", textTransform: "uppercase", borderRight: bdr2,
            }}>Total</td>
            {consultants.map((c, ci) =>
              YEARS.map((y, yi) => {
                const total  = colTotals[c]?.[y] ?? 0
                const isLast = yi === YEARS.length - 1
                const clr    = getClr(c, ci, region)
                return (
                  <td key={`${c}-${y}`} style={{
                    padding: "10px 10px", textAlign: "right",
                    fontWeight: 700, fontSize: 13, fontVariantNumeric: "tabular-nums",
                    color:      total > 0 ? clr.bg : "var(--ink3)",
                    background: total > 0 ? clr.light : "transparent",
                    borderRight: isLast ? bdr2 : bdr,
                  }}>
                    {total > 0 ? fmtCell(total) : "—"}
                  </td>
                )
              })
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default function SalgsrapportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("dk")
  const [tabData, setTabData] = useState<Record<string, ReportData | "loading" | "error">>({})

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const loadTab = (region: string) => {
    setTabData(prev => {
      if (prev[region]) return prev
      fetch(`/api/salgsrapport?region=${region}`)
        .then(r => r.json())
        .then(d  => setTabData(p => ({ ...p, [region]: d })))
        .catch(() => setTabData(p => ({ ...p, [region]: "error" })))
      return { ...prev, [region]: "loading" }
    })
  }

  useEffect(() => {
    if (status === "authenticated" && isAdmin(session?.user?.email)) loadTab("dk")
  }, [status])

  const switchTab = (key: string) => { setActiveTab(key); loadTab(key) }

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ color: "var(--ink2)", fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  if (status === "authenticated" && !isAdmin(session?.user?.email)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg)", gap: 16 }}>
        <div style={{ fontSize: 32 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink1)" }}>Access restricted</div>
        <button onClick={() => router.push("/dashboard")}
          style={{ marginTop: 8, padding: "8px 20px", borderRadius: 6, border: "1px solid var(--bdr)", background: "var(--card)", color: "var(--ink2)", fontSize: 13, cursor: "pointer" }}>
          ← Back to Dashboard
        </button>
      </div>
    )
  }

  const tabInfo  = TABS.find(t => t.key === activeTab)!
  const tabState = tabData[activeTab]
  const report   = typeof tabState === "object" ? tabState : null

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "28px 24px" }}>
      <div style={{ maxWidth: 1600, margin: "0 auto" }}>

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink3)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>Report</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink1)", margin: "0 0 4px" }}>Sales Report by Consultant</h1>
            <p style={{ fontSize: 12, color: "var(--ink3)", margin: 0 }}>
              Closed Won · Close Date 2024-01-01 to 2026-12-31
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => router.push("/dashboard")}
              style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid var(--bdr)", background: "var(--card)", color: "var(--ink2)", fontSize: 12, cursor: "pointer" }}>
              Dashboard
            </button>
            <button onClick={() => signOut({ callbackUrl: "/login" })}
              style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid var(--bdr)", background: "var(--card)", color: "var(--ink3)", fontSize: 12, cursor: "pointer" }}>
              Sign out
            </button>
          </div>
        </div>

        {/* Region tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--bdr)" }}>
          {TABS.map(t => {
            const active  = t.key === activeTab
            const loading = tabData[t.key] === "loading"
            return (
              <button key={t.key} onClick={() => switchTab(t.key)} style={{
                padding: "10px 20px", border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: active ? 700 : 500,
                color:      active ? "var(--ink1)" : "var(--ink3)",
                background: "transparent",
                borderBottom: active ? "2px solid var(--ink1)" : "2px solid transparent",
                marginBottom: -2,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <FlagImg src={t.flagImg} label={t.label} />
                {t.label}
                {loading && <span style={{ fontSize: 10, color: "var(--ink3)" }}>…</span>}
              </button>
            )
          })}
        </div>

        {/* Table card */}
        <div style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>

          {/* Tab subtitle bar */}
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--bdr)", background: "var(--bg)", display: "flex", alignItems: "center", gap: 12 }}>
            <FlagImg src={tabInfo.flagImg} label={tabInfo.label} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink1)" }}>{tabInfo.label}</div>
              <div style={{ fontSize: 11, color: "var(--ink3)" }}>
                {tabInfo.subtitle}
                {tabInfo.coac ? " · checked_by_coacs = ✔" : " · all Closed Won (no COACs filter)"}
                {" · 2026 YTD to " + YTD_LABEL}
              </div>
            </div>
          </div>

          {tabState === "loading" && (
            <div style={{ padding: "48px", textAlign: "center", color: "var(--ink3)", fontSize: 13 }}>
              Loading {tabInfo.label} deals from HubSpot… this may take 20–40 seconds
            </div>
          )}

          {tabState === "error" && (
            <div style={{ padding: "32px", textAlign: "center", color: "#b91c1c", fontSize: 13 }}>
              Failed to load data. Please try refreshing.
            </div>
          )}

          {report && <SalesTable report={report} />}

          {report && (
            <div style={{ textAlign: "right", fontSize: 10, color: "var(--ink3)", padding: "8px 16px", borderTop: "1px solid var(--bdr)" }}>
              {report.currency} · Grouped by deal owner + close date · Generated: {new Date(report.generatedAt).toLocaleString("en-GB")}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
