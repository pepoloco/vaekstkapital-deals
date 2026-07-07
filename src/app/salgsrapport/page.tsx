"use client"
// @ts-nocheck
import { useEffect, useRef, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

const ADMIN_DOMAINS = ["vaekstholdings.com", "vkfunddistribution.com"]
const ADMIN_EMAILS = new Set(["tlm@vaekstnet.com"])
const isAdmin = (email?: string | null) =>
  !!email && (ADMIN_DOMAINS.includes(email?.split("@")[1]?.toLowerCase() ?? "") || ADMIN_EMAILS.has(email.toLowerCase()))

// Non-admin emails granted Sales Report access, mapped to the regions they can see
const SALES_REPORT_EXCEPTIONS: Record<string, string[]> = {
  "sok@vaekstkapital.dk": ["dk"],
}

const canViewSalesReport = (email?: string | null) =>
  !!email && (isAdmin(email) || email.toLowerCase() in SALES_REPORT_EXCEPTIONS)

const allowedRegions = (email?: string | null): string[] | null => {
  if (!email) return null
  if (isAdmin(email)) return null // null = all regions
  return SALES_REPORT_EXCEPTIONS[email.toLowerCase()] ?? null
}

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

type DealRef = { id: string; name: string; amount: number }
type Cell = { amount: number; count: number; deals?: DealRef[] }
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

const HS_PORTAL = "144061788"

function DealPopover({ deals, currency, x, y, onClose }: {
  deals: DealRef[]
  currency: string
  x: number
  y: number
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  // Keep popover on screen horizontally
  const popW = 340
  const left = x + popW > window.innerWidth - 12 ? x - popW - 4 : x + 8
  const top  = Math.max(8, Math.min(y - 20, window.innerHeight - 320))

  return (
    <div ref={ref} style={{
      position: "fixed", left, top, zIndex: 9999,
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
      boxShadow: "0 8px 24px rgba(0,0,0,.18)",
      minWidth: 280, width: popW, maxHeight: 320, overflowY: "auto",
      fontSize: 12,
    }}>
      <div style={{ padding: "9px 14px", borderBottom: "1px solid #f3f4f6", fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: ".07em", textTransform: "uppercase" }}>
        {deals.length} Deal{deals.length !== 1 ? "s" : ""}
      </div>
      {deals.map((d, i) => (
        <a key={d.id}
          href={`https://app-eu1.hubspot.com/contacts/${HS_PORTAL}/deal/${d.id}`}
          target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            padding: "9px 14px", textDecoration: "none", color: "inherit",
            borderBottom: i < deals.length - 1 ? "1px solid #f9fafb" : "none" }}
          onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = "#f9fafb" }}
          onMouseOut={e  => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
        >
          <span style={{ color: "#111827", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
          <span style={{ color: "#0091ae", fontWeight: 700, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
            {fmtCell(d.amount)} <span style={{ fontSize: 10, color: "#9ca3af" }}>↗</span>
          </span>
        </a>
      ))}
    </div>
  )
}

function SalesTable({ report }: { report: ReportData }) {
  const { region, currency, consultants, data } = report
  const [popover, setPopover] = useState<{ deals: DealRef[]; x: number; y: number } | null>(null)

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
    <>
      {popover && (
        <DealPopover
          deals={popover.deals}
          currency={currency}
          x={popover.x}
          y={popover.y}
          onClose={() => setPopover(null)}
        />
      )}
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
                    const cell    = data[c]?.[y]?.[monthNum]
                    const amount  = cell?.amount ?? 0
                    const count   = cell?.count  ?? 0
                    const deals   = cell?.deals  ?? []
                    const isLast  = yi === YEARS.length - 1
                    const clr     = getClr(c, ci, region)
                    const clickable = amount > 0 && deals.length > 0
                    return (
                      <td key={`${c}-${y}`}
                        onClick={clickable ? (e) => {
                          e.stopPropagation()
                          setPopover({ deals, x: e.clientX, y: e.clientY })
                        } : undefined}
                        style={{
                          padding: "7px 10px", textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          borderRight: isLast ? bdr2 : bdr, borderBottom: bdr,
                          verticalAlign: "middle",
                          cursor: clickable ? "pointer" : "default",
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
    </>
  )
}

type MeetingTableData = {
  consultants: string[]
  years: number[]
  data: Record<string, Record<number, Record<number, number>>>
  generatedAt: string
}

function MeetingsCountTable({ report, title }: { report: MeetingTableData; title: string }) {
  const { consultants, data } = report
  const bdr  = "1px solid var(--bdr)"
  const bdr2 = "2px solid var(--bdr)"

  if (consultants.length === 0) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--ink3)", fontSize: 13, fontStyle: "italic" }}>
        No meetings found for this period.
      </div>
    )
  }

  const colTotals: Record<string, Record<number, number>> = {}
  for (const c of consultants) {
    colTotals[c] = {}
    for (const y of YEARS) {
      colTotals[c][y] = Object.values(data[c]?.[y] ?? {}).reduce((s, n) => s + n, 0)
    }
  }

  return (
    <div style={{ borderTop: bdr2, paddingTop: 0 }}>
      <div style={{ padding: "10px 16px", background: "var(--bg)", borderBottom: bdr, fontSize: 12, fontWeight: 700, color: "var(--ink2)", letterSpacing: ".04em" }}>
        {title}
      </div>
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
                const clr = getClr(c, ci, "dk")
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
                  const clr    = getClr(c, ci, "dk")
                  const isLast = yi === YEARS.length - 1
                  return (
                    <th key={`${c}-${y}`} style={{
                      padding: "5px 10px", textAlign: "right", fontSize: 9, fontWeight: 700,
                      color: clr.bg, background: clr.light,
                      borderBottom: bdr2, borderRight: isLast ? bdr2 : bdr, whiteSpace: "nowrap",
                    }}>
                      {y === 2026 ? "2026 YTD" : String(y)}
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
                      const count  = data[c]?.[y]?.[monthNum] ?? 0
                      const isLast = yi === YEARS.length - 1
                      const clr    = getClr(c, ci, "dk")
                      return (
                        <td key={`${c}-${y}`} style={{
                          padding: "7px 10px", textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          borderRight: isLast ? bdr2 : bdr, borderBottom: bdr,
                          verticalAlign: "middle",
                        }}>
                          {count > 0 ? (
                            <div style={{ fontSize: 13, fontWeight: 700, color: clr.bg, lineHeight: 1.2 }}>
                              {count}
                            </div>
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
                  const clr    = getClr(c, ci, "dk")
                  return (
                    <td key={`${c}-${y}`} style={{
                      padding: "10px 10px", textAlign: "right",
                      fontWeight: 700, fontSize: 13, fontVariantNumeric: "tabular-nums",
                      color:      total > 0 ? clr.bg : "var(--ink3)",
                      background: total > 0 ? clr.light : "transparent",
                      borderRight: isLast ? bdr2 : bdr,
                    }}>
                      {total > 0 ? total : "—"}
                    </td>
                  )
                })
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default function SalgsrapportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab,   setActiveTab]   = useState("dk")
  const [sectionTab,  setSectionTab]  = useState<"deals" | "meetings">("deals")
  const [tabData,     setTabData]     = useState<Record<string, ReportData | "loading" | "error">>({})
  const [meetFrom,    setMeetFrom]    = useState("2024-01-01")
  const [meetTo,      setMeetTo]      = useState(new Date().toISOString().slice(0, 10))
  const [meetLoading, setMeetLoading] = useState(false)
  const [meetData,    setMeetData]    = useState<{ booked: MeetingTableData; attended: MeetingTableData } | null>(null)
  const [meetError,   setMeetError]   = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const loadTab = (region: string) => {
    setTabData(prev => {
      if (prev[region]) return prev
      fetch(`/api/salgsrapport?region=${region}`)
        .then(r => r.json())
        .then(d  => setTabData(p => ({ ...p, [region]: d?.error ? "error" : d })))
        .catch(() => setTabData(p => ({ ...p, [region]: "error" })))
      return { ...prev, [region]: "loading" }
    })
  }

  useEffect(() => {
    if (status === "authenticated" && canViewSalesReport(session?.user?.email)) loadTab("dk")
  }, [status])

  const switchTab = (key: string) => {
    setActiveTab(key)
    loadTab(key)
    setMeetData(null)
    setMeetError(null)
  }

  async function loadMeetings() {
    setMeetLoading(true)
    setMeetError(null)
    try {
      const res  = await fetch(`/api/salgsrapport-meetings?region=${activeTab}&from=${meetFrom}&to=${meetTo}`)
      const data = await res.json()
      if (data.error) { setMeetError(data.error); return }
      setMeetData(data)
    } catch (e: any) {
      setMeetError(e.message)
    } finally {
      setMeetLoading(false)
    }
  }

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ color: "var(--ink2)", fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  if (status === "authenticated" && !canViewSalesReport(session?.user?.email)) {
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

  const email    = session?.user?.email
  const regions  = allowedRegions(email)
  const visibleTabs = regions ? TABS.filter(t => regions.includes(t.key)) : TABS

  const tabInfo  = visibleTabs.find(t => t.key === activeTab) ?? visibleTabs[0]!
  const tabState = tabData[activeTab]
  const report   = typeof tabState === "object" ? tabState : null

  const bdr = "1px solid var(--bdr)"

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "28px 24px" }}>
      <div style={{ maxWidth: 1600, margin: "0 auto" }}>

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink3)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>Report</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink1)", margin: "0 0 4px" }}>Sales Report by Consultant</h1>
            <p style={{ fontSize: 12, color: "var(--ink3)", margin: 0 }}>
              Closed Won deals and meeting activity by consultant
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
          {visibleTabs.map(t => {
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

        {/* Card */}
        <div style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>

          {/* Region subtitle */}
          <div style={{ padding: "10px 16px", borderBottom: bdr, background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
            {/* Section sub-tabs: Deals | Meetings */}
            <div style={{ display: "flex", gap: 4, background: "var(--bdr)", borderRadius: 8, padding: 3 }}>
              {(["deals", "meetings"] as const).map(s => (
                <button key={s} onClick={() => setSectionTab(s)} style={{
                  padding: "5px 16px", borderRadius: 6, border: "none", cursor: "pointer",
                  fontFamily: "inherit", fontSize: 12, fontWeight: sectionTab === s ? 700 : 500,
                  background: sectionTab === s ? "var(--card)" : "transparent",
                  color:      sectionTab === s ? "var(--ink1)" : "var(--ink3)",
                  boxShadow:  sectionTab === s ? "0 1px 3px rgba(0,0,0,.08)" : "none",
                }}>
                  {s === "deals" ? "Deals" : "Meetings"}
                </button>
              ))}
            </div>
          </div>

          {/* ── DEALS section ── */}
          {sectionTab === "deals" && (<>
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
              <div style={{ textAlign: "right", fontSize: 10, color: "var(--ink3)", padding: "8px 16px", borderTop: bdr }}>
                {report.currency} · Grouped by deal owner + close date · Generated: {new Date(report.generatedAt).toLocaleString("en-GB")}
              </div>
            )}
          </>)}

          {/* ── MEETINGS section ── */}
          {sectionTab === "meetings" && (
            <div>
              {/* Date range controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: bdr, flexWrap: "wrap" as const }}>
                <span style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 600 }}>Date range:</span>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink2)" }}>
                  From
                  <input type="date" value={meetFrom} onChange={e => setMeetFrom(e.target.value)}
                    style={{ fontSize: 12, padding: "4px 8px", border: "1px solid var(--bdr)", borderRadius: 5, fontFamily: "inherit", background: "var(--card)", color: "var(--ink1)" }} />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink2)" }}>
                  To
                  <input type="date" value={meetTo} onChange={e => setMeetTo(e.target.value)}
                    style={{ fontSize: 12, padding: "4px 8px", border: "1px solid var(--bdr)", borderRadius: 5, fontFamily: "inherit", background: "var(--card)", color: "var(--ink1)" }} />
                </label>
                <button onClick={loadMeetings} disabled={meetLoading}
                  style={{ padding: "5px 16px", borderRadius: 6, border: "none", background: "#1d4ed8", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: meetLoading ? 0.7 : 1 }}>
                  {meetLoading ? "Loading…" : "Load data"}
                </button>
                {meetData && (
                  <span style={{ fontSize: 11, color: "var(--ink3)" }}>
                    Generated: {new Date(meetData.booked.generatedAt).toLocaleString("en-GB")}
                  </span>
                )}
              </div>

              {meetError && (
                <div style={{ padding: "16px", color: "#b91c1c", fontSize: 13, borderBottom: bdr }}>
                  ⚠ {meetError}
                </div>
              )}

              {!meetData && !meetLoading && !meetError && (
                <div style={{ padding: "48px", textAlign: "center", color: "var(--ink3)", fontSize: 13, fontStyle: "italic" }}>
                  Select a date range and click "Load data" to view meetings
                </div>
              )}

              {meetLoading && (
                <div style={{ padding: "48px", textAlign: "center", color: "var(--ink3)", fontSize: 13 }}>
                  Loading meetings from HubSpot…
                </div>
              )}

              {meetData && (
                <>
                  <MeetingsCountTable report={meetData.booked}    title="Meetings Booked (created by consultant)" />
                  <MeetingsCountTable report={meetData.attended}  title="All Meetings Attended (consultant is host)" />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
