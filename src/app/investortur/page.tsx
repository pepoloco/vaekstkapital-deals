"use client"
// @ts-nocheck
import { useEffect, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

const PORTAL = "144061788"
const ADMIN_DOMAINS = new Set(["vaekstholdings.com", "vkfunddistribution.com"])
const DK_EXCEPTIONS = new Set(["brj@vaekstkapital.dk","tnp@vaekstkapital.dk","sok@vaekstkapital.dk","aro@vaekstkapital.dk","sts@vaekstkapital.dk"])
const SE_EXCEPTIONS = new Set(["spo@vaekstkapital.se","acs@vaekstkapital.se","nry@vaekstkapital.se"])

const isAdmin = (email?: string | null) => {
  if (!email) return false
  const lc = email.toLowerCase()
  const domain = lc.split("@")[1] ?? ""
  return ADMIN_DOMAINS.has(domain) || domain === "vaekstkapital.at" || DK_EXCEPTIONS.has(lc) || SE_EXCEPTIONS.has(lc)
}

// Returns which country columns this user may see ("DK" | "SE")[]
function getAllowedCountries(email?: string | null): Array<"DK" | "SE"> {
  if (!email) return []
  const lc = email.toLowerCase()
  const domain = lc.split("@")[1] ?? ""
  if (ADMIN_DOMAINS.has(domain) || domain === "vaekstkapital.at") return ["DK", "SE"]
  if (SE_EXCEPTIONS.has(lc) || domain === "vaekstkapital.se") return ["SE"]
  if (DK_EXCEPTIONS.has(lc) || domain === "vaekstkapital.dk") return ["DK"]
  return ["DK", "SE"]
}

const fmtAmt = (n: number, currency = "DKK") =>
  new Intl.NumberFormat("en-DK", { maximumFractionDigits: 0 }).format(n) + " " + currency

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function cleanName(name: string): string {
  return name
    .replace(/^bu\s+(dk|se)\s*[-–]\s*/i, "")
    .replace(/^event\s*[-–]\s*/i, "")
    .trim()
}

type Campaign = {
  id: string
  name: string
  country: "DK" | "SE"
  startDate: string
  endDate: string
  participantCount: number
}

type Summary = {
  afterDeals: number
  afterAmt: number
  avgAfterAmt: number
  totalDeals: number
  totalAmt: number
}

type Deal = {
  id: string; name: string; amount: number; currency: string; pipeline: string; stage: string
  isClosedWon: boolean; isClosedLost: boolean; createdate: string; closedate: string | null; owner: string
}

type ContactRow = {
  id: string; name: string; email: string; owner: string
  beforeDeals: Deal[]; afterDeals: Deal[]
  beforeCount: number; afterCount: number
  beforeTotal: number; afterTotal: number
}

type ReportData = {
  campaign: { id: string; cutoffDate: string }
  contacts: ContactRow[]
  fetchedAt: string
}

const th: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase",
  color: "var(--ink3)", padding: "8px 12px", textAlign: "left",
  borderBottom: "2px solid var(--bdr)", whiteSpace: "nowrap",
}
const thr: React.CSSProperties = { ...th, textAlign: "right" }
const td: React.CSSProperties = { padding: "8px 12px", borderBottom: "1px solid var(--bdr)", fontSize: 12, color: "var(--ink2)" }
const tdr: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }


function DealCard({ d, portal }: { d: Deal; portal: string }) {
  return (
    <div style={{
      border: "1px solid #e2e6ea", borderRadius: 8, padding: "14px 16px",
      background: "#f8f9fb", display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <a href={`https://app.hubspot.com/contacts/${portal}/record/0-3/${d.id}`}
          target="_blank" rel="noreferrer"
          style={{ color: "#2d68b0", textDecoration: "underline", fontWeight: 700, fontSize: 14, lineHeight: 1.3, flex: 1 }}>
          {d.name}
        </a>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", flexShrink: 0 }}>
          {fmtAmt(d.amount, d.currency || "DKK")}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4,
          background: "#d1fae5", color: "#065f46",
        }}>{d.stage}</span>
        <span style={{ fontSize: 12, color: "#374151" }}>{d.pipeline}</span>
        <span style={{ fontSize: 12, color: "#6b7280", marginLeft: "auto" }}>
          Created: <strong style={{ color: "#374151" }}>{fmtDate(d.createdate)}</strong>
          {d.closedate && <> &nbsp;·&nbsp; Closed: <strong style={{ color: "#374151" }}>{fmtDate(d.closedate)}</strong></>}
        </span>
      </div>
      {d.owner && d.owner !== "—" && (
        <div style={{ fontSize: 11, color: "#6b7280" }}>Owner: <span style={{ color: "#374151" }}>{d.owner}</span></div>
      )}
    </div>
  )
}

function DealsModal({ contact, cutoffDate, onClose }: { contact: ContactRow; cutoffDate: string; onClose: () => void }) {
  const before = [...contact.beforeDeals].sort((a, b) => new Date(b.createdate).getTime() - new Date(a.createdate).getTime())
  const after  = [...contact.afterDeals].sort((a, b) => new Date(b.createdate).getTime() - new Date(a.createdate).getTime())
  const total  = before.length + after.length

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }} onClick={onClose}>
      <div style={{
        background: "#ffffff", borderRadius: 14, width: "100%", maxWidth: 680,
        maxHeight: "88vh", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(0,0,0,.35)",
      }} onClick={e => e.stopPropagation()}>

        {/* Modal header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e6ea", background: "#ffffff", borderRadius: "14px 14px 0 0" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{contact.name}</div>
              {contact.email && <div style={{ fontSize: 12, color: "#6b7280" }}>{contact.email}</div>}
            </div>
            <button onClick={onClose} style={{
              background: "#f3f4f6", border: "1px solid #e2e6ea", borderRadius: 8,
              padding: "6px 14px", fontSize: 13, cursor: "pointer", color: "#374151", flexShrink: 0,
            }}>✕ Close</button>
          </div>
          <div style={{
            marginTop: 12, padding: "8px 12px", background: "#f3f4f6", borderRadius: 8,
            fontSize: 12, color: "#6b7280", display: "flex", gap: 16, flexWrap: "wrap",
          }}>
            <span>Cutoff: <strong style={{ color: "#111827" }}>{fmtDate(cutoffDate)}</strong></span>
            <span style={{ color: "#2d68b0", fontWeight: 600 }}>{before.length} deal{before.length !== 1 ? "s" : ""} before</span>
            <span style={{ color: "#065f46", fontWeight: 600 }}>{after.length} deal{after.length !== 1 ? "s" : ""} after</span>
            <span style={{ marginLeft: "auto", color: "#374151" }}>{total} total qualifying deal{total !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 24, background: "#ffffff", borderRadius: "0 0 14px 14px" }}>
          {total === 0 ? (
            <div style={{ textAlign: "center", color: "#6b7280", fontSize: 14, padding: "24px 0", fontStyle: "italic" }}>
              No qualifying deals (Closed Won + checked by COACs) for this participant
            </div>
          ) : (
            <>
              {before.length > 0 && (
                <div>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 12, paddingBottom: 10, borderBottom: "2px solid #bfdbfe",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", letterSpacing: ".06em", textTransform: "uppercase" }}>
                      Before Campaign
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>
                      {before.length} deal{before.length !== 1 ? "s" : ""} · {fmtAmt(before.reduce((s, d) => s + d.amount, 0))}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {before.map(d => <DealCard key={d.id} d={d} portal={PORTAL} />)}
                  </div>
                </div>
              )}

              {after.length > 0 && (
                <div>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 12, paddingBottom: 10, borderBottom: "2px solid #6ee7b7",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#065f46", letterSpacing: ".06em", textTransform: "uppercase" }}>
                      After Campaign
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46" }}>
                      {after.length} deal{after.length !== 1 ? "s" : ""} · {fmtAmt(after.reduce((s, d) => s + d.amount, 0))}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {after.map(d => <DealCard key={d.id} d={d} portal={PORTAL} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ParticipantTable({ reportData, currency }: { reportData: ReportData; currency: string }) {
  const [expandedContact, setExpandedContact] = useState<ContactRow | null>(null)
  const contacts = reportData.contacts

  if (contacts.length === 0) {
    return (
      <div style={{ padding: "32px", textAlign: "center", color: "var(--ink3)", fontSize: 13 }}>
        No influenced contacts found for this campaign in HubSpot
      </div>
    )
  }

  const totBefore = contacts.reduce((s, c) => s + c.beforeTotal, 0)
  const totAfter  = contacts.reduce((s, c) => s + c.afterTotal, 0)
  const totCntBefore = contacts.reduce((s, c) => s + c.beforeCount, 0)
  const totCntAfter  = contacts.reduce((s, c) => s + c.afterCount, 0)

  return (
    <>
      {expandedContact && (
        <DealsModal
          contact={expandedContact}
          cutoffDate={reportData.campaign.cutoffDate}
          onClose={() => setExpandedContact(null)}
        />
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={th}>Participant</th>
              <th style={th}>Advisor</th>
              <th style={{ ...thr, color: "#2d68b0" }}># Before</th>
              <th style={{ ...thr, color: "#2d68b0" }}>Amount Before</th>
              <th style={{ ...thr, color: "#15624c" }}># After</th>
              <th style={{ ...thr, color: "#15624c" }}>Net Amount After</th>
              <th style={{ ...thr, color: "#2d68b0" }}>Avg. Before</th>
              <th style={{ ...thr, color: "var(--ink3)" }}>Δ Avg. Deal</th>
              <th style={{ ...th, width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => {
              const avgBefore = c.beforeCount > 0 ? c.beforeTotal / c.beforeCount : 0
              const avgAfter  = c.afterCount  > 0 ? c.afterTotal  / c.afterCount  : 0
              const avgDiff   = avgBefore > 0 && avgAfter > 0 ? avgAfter - avgBefore : null
              return (
                <tr key={c.id} style={{ cursor: "default" }}>
                  <td style={td}>
                    <a href={`https://app.hubspot.com/contacts/${PORTAL}/record/0-1/${c.id}`}
                      target="_blank" rel="noreferrer"
                      style={{ color: "var(--ink1)", textDecoration: "none", fontWeight: 600 }}>
                      {c.name}
                    </a>
                    {c.email && <div style={{ fontSize: 10, color: "var(--ink3)" }}>{c.email}</div>}
                  </td>
                  <td style={td}>{c.owner}</td>
                  <td style={{ ...tdr, color: "#2d68b0", fontWeight: 600 }}>{c.beforeCount || "—"}</td>
                  <td style={{ ...tdr, color: "#2d68b0" }}>{c.beforeTotal > 0 ? fmtAmt(c.beforeTotal, currency) : "—"}</td>
                  <td style={{ ...tdr, color: "#15624c", fontWeight: 600 }}>{c.afterCount || "—"}</td>
                  <td style={{ ...tdr, color: "#15624c" }}>{c.afterTotal > 0 ? fmtAmt(c.afterTotal, currency) : "—"}</td>
                  <td style={{ ...tdr, color: "#2d68b0" }}>{avgBefore > 0 ? fmtAmt(avgBefore, currency) : "—"}</td>
                  <td style={{ ...tdr }}>
                    {avgDiff !== null ? (
                      <span style={{ color: avgDiff > 0 ? "#15624c" : "#c2410c", fontWeight: 700 }}>
                        {avgDiff > 0 ? "↑ " : "↓ "}{fmtAmt(Math.abs(avgDiff), currency)}
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <button onClick={() => setExpandedContact(c)} style={{
                      fontSize: 10, padding: "3px 8px", borderRadius: 4,
                      border: "1px solid var(--bdr)", background: "var(--bg)",
                      color: "var(--ink2)", cursor: "pointer",
                    }}>Deals</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid var(--bdr)" }}>
              <td style={{ ...td, fontWeight: 700, color: "var(--ink1)" }} colSpan={2}>Total ({contacts.length} participants)</td>
              <td style={{ ...tdr, color: "#2d68b0", fontWeight: 700 }}>{totCntBefore}</td>
              <td style={{ ...tdr, color: "#2d68b0", fontWeight: 700 }}>{totBefore > 0 ? fmtAmt(totBefore, currency) : "—"}</td>
              <td style={{ ...tdr, color: "#15624c", fontWeight: 700 }}>{totCntAfter || "—"}</td>
              <td style={{ ...tdr, color: "#15624c", fontWeight: 700 }}>{totAfter > 0 ? fmtAmt(totAfter, currency) : "—"}</td>
              <td style={{ ...tdr, color: "#2d68b0", fontWeight: 700 }}>{totCntBefore > 0 ? fmtAmt(totBefore / totCntBefore, currency) : "—"}</td>
              <td style={{ ...tdr, fontWeight: 700 }}>
                {totCntBefore > 0 && totCntAfter > 0 ? (() => {
                  const diff = (totAfter / totCntAfter) - (totBefore / totCntBefore)
                  return (
                    <span style={{ color: diff > 0 ? "#15624c" : "#c2410c", fontWeight: 700 }}>
                      {diff > 0 ? "↑ " : "↓ "}{fmtAmt(Math.abs(diff), currency)}
                    </span>
                  )
                })() : "—"}
              </td>
              <td style={td} />
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={{ textAlign: "right", fontSize: 10, color: "var(--ink3)", padding: "8px 12px" }}>
        Fetched: {new Date(reportData.fetchedAt).toLocaleString("en-GB")}
      </div>
    </>
  )
}

function CampaignCard({ c, summary, summaryLoading, onClick }: {
  c: Campaign; summary?: Summary; summaryLoading?: boolean; onClick: () => void
}) {
  const name = cleanName(c.name)
  const currency = c.country === "SE" ? "SEK" : "DKK"
  const flag = c.country === "SE" ? "🇸🇪" : "🇩🇰"
  const dot = <span style={{ display: "inline-block", width: 28, height: 10, borderRadius: 4, background: "var(--bdr)", opacity: 0.6 }} />
  return (
    <div onClick={onClick} style={{
      background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 10,
      padding: "18px 20px", cursor: "pointer",
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "#2d68b0")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--bdr)")}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16, lineHeight: 1.3, flexShrink: 0 }}>{flag}</span>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink1)", lineHeight: 1.4 }}>{name}</div>
      </div>

      {/* Row 1: start date + participants */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: summary || summaryLoading ? 12 : 0 }}>
        <div>
          <div style={{ fontSize: 9, color: "var(--ink3)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 2 }}>Start date</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink2)" }}>{fmtDate(c.startDate)}</div>
        </div>
        {c.endDate && (
          <div>
            <div style={{ fontSize: 9, color: "var(--ink3)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 2 }}>End date</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink2)" }}>{fmtDate(c.endDate)}</div>
          </div>
        )}
        <div style={{ marginLeft: "auto" }}>
          <div style={{ fontSize: 9, color: "var(--ink3)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 2 }}>Participants</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#2d68b0" }}>{c.participantCount}</div>
        </div>
      </div>

      {/* Row 2: deal stats (loads in background) */}
      {(summary || summaryLoading) && (
        <div style={{
          display: "flex", gap: 16, flexWrap: "wrap",
          paddingTop: 10, borderTop: "1px solid var(--bdr)",
        }}>
          <div>
            <div style={{ fontSize: 9, color: "#15624c", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 2 }}>New deals after</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#15624c" }}>
              {summaryLoading ? dot : (summary!.afterDeals || "—")}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: "#15624c", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 2 }}>Net amount after</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#15624c" }}>
              {summaryLoading ? dot : (summary!.afterAmt > 0 ? fmtAmt(summary!.afterAmt, currency) : "—")}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: "var(--ink3)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 2 }}>Avg. after amount</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink2)" }}>
              {summaryLoading ? dot : (summary!.avgAfterAmt > 0 ? fmtAmt(summary!.avgAfterAmt, currency) : "—")}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InvestorturPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [campaigns, setCampaigns]             = useState<Campaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [selected, setSelected]               = useState<Campaign | null>(null)
  const [reportData, setReportData]           = useState<ReportData | null>(null)
  const [reportLoading, setReportLoading]     = useState(false)
  const [error, setError]                     = useState("")
  const [summaries, setSummaries]             = useState<Record<string, Summary>>({})
  const [summaryLoading, setSummaryLoading]   = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (status !== "authenticated") return
    if (!isAdmin(session?.user?.email)) return
    fetch("/api/investortur/campaigns")
      .then(r => r.json())
      .then(d => {
        setCampaigns(d.campaigns ?? [])
        if (d.errors?.length) setError("API warnings: " + d.errors.join(" | "))
        setCampaignsLoading(false)
      })
      .catch(e => { setError("Failed to load campaigns: " + e); setCampaignsLoading(false) })
  }, [status])

  // Background-load deal summaries for all cards sequentially after campaigns appear
  useEffect(() => {
    if (campaigns.length === 0) return
    let cancelled = false
    const loadSummaries = async () => {
      for (const c of campaigns) {
        if (cancelled) break
        setSummaryLoading(prev => ({ ...prev, [c.id]: true }))
        try {
          const params = new URLSearchParams({ id: c.id, startDate: c.startDate })
          const r = await fetch(`/api/investortur?${params}`)
          const d = await r.json()
          if (cancelled) break
          if (d.contacts) {
            const rows = d.contacts as ContactRow[]
            const afterDeals = rows.reduce((s, x) => s + x.afterCount, 0)
            const afterAmt   = rows.reduce((s, x) => s + x.afterTotal, 0)
            setSummaries(prev => ({
              ...prev,
              [c.id]: {
                afterDeals,
                afterAmt,
                avgAfterAmt: afterDeals > 0 ? afterAmt / afterDeals : 0,
                totalDeals:  rows.reduce((s, x) => s + x.beforeCount + x.afterCount, 0),
                totalAmt:    rows.reduce((s, x) => s + x.beforeTotal + x.afterTotal, 0),
              },
            }))
          }
        } catch { /* ignore per-campaign errors */ }
        setSummaryLoading(prev => ({ ...prev, [c.id]: false }))
      }
    }
    loadSummaries()
    return () => { cancelled = true }
  }, [campaigns])

  const openCampaign = (c: Campaign) => {
    setSelected(c)
    setReportData(null)
    setReportLoading(true)
    setError("")
    const params = new URLSearchParams({ id: c.id, startDate: c.startDate })
    fetch(`/api/investortur?${params}`)
      .then(r => r.json())
      .then(d => {
        setReportData(d)
        setReportLoading(false)
        if (d.contacts) {
          const rows = d.contacts as ContactRow[]
          const afterDeals = rows.reduce((s: number, x: ContactRow) => s + x.afterCount, 0)
          const afterAmt   = rows.reduce((s: number, x: ContactRow) => s + x.afterTotal, 0)
          setSummaries(prev => ({
            ...prev,
            [c.id]: {
              afterDeals,
              afterAmt,
              avgAfterAmt: afterDeals > 0 ? afterAmt / afterDeals : 0,
              totalDeals:  rows.reduce((s: number, x: ContactRow) => s + x.beforeCount + x.afterCount, 0),
              totalAmt:    rows.reduce((s: number, x: ContactRow) => s + x.beforeTotal + x.afterTotal, 0),
            },
          }))
        }
      })
      .catch(() => { setError("Failed to load report"); setReportLoading(false) })
  }

  if (status === "loading" || (status === "authenticated" && isAdmin(session?.user?.email) && campaignsLoading)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg)", gap: 8 }}>
        <div style={{ color: "var(--ink2)", fontSize: 14 }}>Loading investor tour campaigns…</div>
        <div style={{ color: "var(--ink3)", fontSize: 11 }}>Fetching campaigns and participant counts from HubSpot</div>
      </div>
    )
  }

  if (status === "authenticated" && !isAdmin(session?.user?.email)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg)", gap: 16 }}>
        <div style={{ fontSize: 32 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink1)" }}>Access restricted</div>
        <div style={{ fontSize: 13, color: "var(--ink3)", textAlign: "center", maxWidth: 360 }}>
          The Investor Tour report is only available to VaekstHoldings and VK Fund Distribution users.
        </div>
        <button onClick={() => router.push("/")}
          style={{ marginTop: 8, padding: "8px 20px", borderRadius: 6, border: "1px solid var(--bdr)", background: "var(--card)", color: "var(--ink2)", fontSize: 13, cursor: "pointer" }}>
          ← Back to Main Menu
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "28px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink3)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>Report</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink1)", margin: "0 0 4px" }}>Investor Tour Report</h1>
            <p style={{ fontSize: 12, color: "var(--ink3)", margin: 0 }}>
              {selected ? "Participant deals before and after investor tour start date" : "Select an investor tour to view participant data"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {selected && (
              <button onClick={() => { setSelected(null); setReportData(null) }}
                style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid var(--bdr)", background: "var(--card)", color: "var(--ink2)", fontSize: 12, cursor: "pointer" }}>
                ← Back to Investor Tours
              </button>
            )}
            <button onClick={() => router.push("/")}
              style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid var(--bdr)", background: "var(--card)", color: "var(--ink2)", fontSize: 12, cursor: "pointer" }}>
              Main Menu
            </button>
            <button onClick={() => signOut({ callbackUrl: "/login" })}
              style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid var(--bdr)", background: "var(--card)", color: "var(--ink3)", fontSize: 12, cursor: "pointer" }}>
              Sign out
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", color: "#b91c1c", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Campaign grid — split by country */}
        {!selected && (
          campaigns.length === 0 ? (
            <div style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "40px", textAlign: "center" }}>
              <div style={{ color: "var(--ink2)", fontSize: 13, marginBottom: 6 }}>No investor tour lists found in HubSpot</div>
              <div style={{ color: "var(--ink3)", fontSize: 11 }}>Searched for lists starting with "BU DK - Investor Tour" and "BU SE - Investor Tour"</div>
              {error && <div style={{ color: "#b91c1c", fontSize: 11, marginTop: 8, maxWidth: 500, margin: "8px auto 0" }}>{error}</div>}
            </div>
          ) : (() => {
            const allowedCountries = getAllowedCountries(session?.user?.email)
            const dk = allowedCountries.includes("DK") ? campaigns.filter(c => c.country === "DK") : null
            const se = allowedCountries.includes("SE") ? campaigns.filter(c => c.country === "SE") : null
            const colStyle: React.CSSProperties = { flex: "1 1 0", minWidth: 0 }
            const colHeader = (label: string, flag: string, count: number): React.ReactNode => (
              <div style={{
                display: "flex", alignItems: "center", gap: 12, marginBottom: 14,
                paddingBottom: 12, borderBottom: "2px solid var(--bdr)",
              }}>
                <span style={{ fontSize: 32, lineHeight: 1 }}>{flag}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink1)" }}>{label}</div>
                  <div style={{ fontSize: 11, color: "var(--ink3)" }}>{count} tour{count !== 1 ? "s" : ""}</div>
                </div>
              </div>
            )
            const renderCol = (items: Campaign[], label: string, flag: string, empty: string) => (
              <div style={colStyle}>
                {colHeader(label, flag, items.length)}
                {items.length === 0
                  ? <div style={{ color: "var(--ink3)", fontSize: 12, fontStyle: "italic" }}>{empty}</div>
                  : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {items.map(c => <CampaignCard key={c.id} c={c} summary={summaries[c.id]} summaryLoading={summaryLoading[c.id]} onClick={() => openCampaign(c)} />)}
                    </div>
                }
              </div>
            )
            const showBoth = dk !== null && se !== null
            return (
              <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
                {dk !== null && renderCol(dk, "Denmark", "🇩🇰", "No Denmark tours found")}
                {showBoth && <div style={{ width: 1, background: "var(--bdr)", alignSelf: "stretch", flexShrink: 0 }} />}
                {se !== null && renderCol(se, "Sweden", "🇸🇪", "No Sweden tours found")}
              </div>
            )
          })()
        )}

        {/* Detail view */}
        {selected && (
          <>
            <div style={{
              background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 10,
              padding: "16px 20px", marginBottom: 20,
              display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
            }}>
              <div style={{ flex: "1 1 auto" }}>
                <div style={{ fontSize: 10, color: "var(--ink3)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 3 }}>HubSpot Contact List</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{selected.country === "SE" ? "🇸🇪" : "🇩🇰"}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink1)" }}>{selected.name}</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--ink3)", marginTop: 3 }}>List ID: {selected.id}</div>
              </div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 9, color: "var(--ink3)", letterSpacing: ".07em", textTransform: "uppercase" }}>Start date (cutoff)</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink1)" }}>{fmtDate(selected.startDate)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "var(--ink3)", letterSpacing: ".07em", textTransform: "uppercase" }}>End date</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink1)" }}>{fmtDate(selected.endDate)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "var(--ink3)", letterSpacing: ".07em", textTransform: "uppercase" }}>Participants</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#2d68b0" }}>{selected.participantCount}</div>
                </div>
                {reportData && (() => {
                  const cur      = selected.country === "SE" ? "SEK" : "DKK"
                  const afterDeals = reportData.contacts.reduce((s, c) => s + c.afterCount, 0)
                  const afterAmt   = reportData.contacts.reduce((s, c) => s + c.afterTotal, 0)
                  const totalAmt   = reportData.contacts.reduce((s, c) => s + c.beforeTotal + c.afterTotal, 0)
                  return (
                    <>
                      <div style={{ width: 1, background: "var(--bdr)", alignSelf: "stretch" }} />
                      <div>
                        <div style={{ fontSize: 9, color: "#15624c", letterSpacing: ".07em", textTransform: "uppercase" }}>After-Tour Deals</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#15624c" }}>{afterDeals}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: "#15624c", letterSpacing: ".07em", textTransform: "uppercase" }}>Net Amount After</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#15624c" }}>{afterAmt > 0 ? fmtAmt(afterAmt, cur) : "—"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: "var(--ink3)", letterSpacing: ".07em", textTransform: "uppercase" }}>Total Amount</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink1)" }}>{fmtAmt(totalAmt, cur)}</div>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>

            {reportLoading && (
              <div style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "40px", textAlign: "center" }}>
                <div style={{ color: "var(--ink2)", fontSize: 14, marginBottom: 6 }}>Loading deal data from HubSpot…</div>
                <div style={{ color: "var(--ink3)", fontSize: 11 }}>Fetching deals for {selected.participantCount} participants — this may take 15–30 seconds</div>
              </div>
            )}

            {reportData && !reportLoading && (
              <div style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 10, overflow: "hidden" }}>
                <ParticipantTable reportData={reportData} currency={selected.country === "SE" ? "SEK" : "DKK"} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
