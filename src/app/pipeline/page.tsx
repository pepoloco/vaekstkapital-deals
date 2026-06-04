"use client"
// @ts-nocheck
import React, { useEffect, useRef, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

const PORTAL = "144061788"
const BG = "#F5F2EC", NAV = "#1a1a2e", INK = "#1a1a2e", MUTED = "#6b7280", BORDER = "#e5e0d8"
const GREEN = "#15624c", GD = "rgba(21,97,76,.12)"
const BLUE = "#2d68b0",  BD = "rgba(45,104,176,.12)"
const PURPLE = "#5a4998", PD = "rgba(90,73,152,.12)"
const AMBER = "#96803a",  AD = "rgba(150,128,58,.13)"
const RED = "#e06c75",    RD = "rgba(224,108,117,.12)"
const TEAL = "#0f766e",   TD = "rgba(15,118,110,.12)"
const TIP = { backgroundColor:"#fff", borderColor:"rgba(18,20,40,.1)", borderWidth:1, titleColor:INK, bodyColor:MUTED, padding:10, cornerRadius:6, displayColors:false }
const GRID_OPT = { color:"rgba(18,20,40,.05)" }
const AXES = { x:{grid:GRID_OPT,ticks:{color:MUTED,font:{size:10}}}, y:{grid:GRID_OPT,ticks:{color:MUTED,font:{size:10}}} }

const fmt = (n: number) => Math.round(n).toLocaleString("da-DK")
const fmtCcy = (n: number) => new Intl.NumberFormat("da-DK",{style:"currency",currency:"DKK",maximumFractionDigits:0}).format(n)
const fmtDate = (iso: string | null | undefined) => { if (!iso) return "—"; const d = new Date(iso); return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB") }
const fmtMo = (m: string) => { const [y,mo]=m.split("-"); return new Date(+y,+mo-1).toLocaleDateString("en-GB",{month:"short",year:"2-digit"}) }

function useChart(id: string, config: () => object, deps: unknown[]) {
  const ref = useRef<any>(null)
  useEffect(() => {
    const el = document.getElementById(id)
    if (!el) return
    ref.current?.destroy()
    ref.current = new (window as any).Chart(el, config())
    return () => { ref.current?.destroy() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

const s = {
  page:    { minHeight:"100vh", background:BG, fontFamily:"inherit" },
  nav:     { background:NAV, height:54, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px", position:"sticky" as const, top:0, zIndex:50 },
  main:    { maxWidth:1280, margin:"0 auto", padding:"28px 24px" },
  tabs:    { display:"flex", borderBottom:"2px solid "+BORDER, marginBottom:28, gap:0 },
  g4:      { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:4 },
  g2:      { display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12 },
  g3:      { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 },
  kpi:     { background:"#fff", border:"1px solid "+BORDER, borderRadius:10, padding:"16px 20px" },
  kpiLbl:  { fontSize:10, fontWeight:600, letterSpacing:".08em", textTransform:"uppercase" as const, color:MUTED, marginBottom:8 },
  kpiVal:  { fontSize:36, fontWeight:700, letterSpacing:"-.02em", lineHeight:1 },
  kpiSub:  { fontSize:11, color:MUTED, marginTop:4 },
  cc:      { background:"#fff", border:"1px solid "+BORDER, borderRadius:10, padding:"16px 20px" },
  ccTitle: { fontSize:13, fontWeight:700, color:INK },
  ccSub:   { fontSize:10, color:MUTED, marginTop:2 },
  lbl:     { padding:"18px 0 8px", borderTop:"1px solid "+BORDER, marginTop:28 },
  lblTxt:  { fontSize:10, fontWeight:700, letterSpacing:".1em", textTransform:"uppercase" as const, color:MUTED },
  tcard:   { background:"#fff", border:"1px solid "+BORDER, borderRadius:10, overflow:"hidden" },
  tcardH:  { display:"flex", alignItems:"baseline", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid "+BORDER },
  tcardT:  { fontSize:13, fontWeight:700, color:INK },
  tcardS:  { fontSize:11, color:MUTED },
  th:      { fontSize:10, fontWeight:600, letterSpacing:".07em", textTransform:"uppercase" as const, color:MUTED, padding:"7px 16px", textAlign:"left" as const, borderBottom:"1px solid "+BORDER, background:"#f7f5f0" },
  td:      { padding:"9px 16px", borderBottom:"1px solid "+BORDER, color:"#3c3f5e", fontSize:12 },
  tdr:     { padding:"9px 16px", borderBottom:"1px solid "+BORDER, color:"#3c3f5e", fontSize:12, textAlign:"right" as const, fontVariantNumeric:"tabular-nums" as const },
  rank:    { display:"inline-flex", alignItems:"center", justifyContent:"center", width:20, height:20, borderRadius:"50%", background:"#f0ede6", fontSize:10, fontWeight:700, color:MUTED },
}

const TABS = ["Lead Pipeline","Deals","Lead Quality","Salesperson","Stuck & At-Risk"]

// Colors for stage donut chart (one per lifecycle stage slot)
const STAGE_COLORS_BG = [BD, PD, TD, GD, AD, RD, MUTED+"22", BD+"80", PD+"80"]
const STAGE_COLORS_BORDER = [BLUE, PURPLE, TEAL, GREEN, AMBER, RED, MUTED, BLUE, PURPLE]

export default function PipelinePage() {
  const { status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState(0)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [chartReady, setChartReady] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status])

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Chart) { setChartReady(true); return }
    const scr = document.createElement("script")
    scr.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"
    scr.onload = () => setChartReady(true)
    document.head.appendChild(scr)
  }, [])

  useEffect(() => {
    if (status !== "authenticated") return
    fetch("/api/pipeline-data")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [status])

  async function handleSync() {
    setSyncing(true)
    await fetch("/api/pipeline-sync")
    const res = await fetch("/api/pipeline-data")
    const d = await res.json()
    if (!d.error) setData(d)
    setSyncing(false)
  }

  useChart("ch-funnel", () => {
    const fd: any[] = data?.funnelData ?? []
    return {
      type: "bar",
      data: { labels: fd.map(f => f.stage), datasets: [{ data: fd.map(f => f.count), backgroundColor: BLUE, borderRadius: 4, borderSkipped: false }] },
      options: { indexAxis: "y", responsive: false, plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: (ctx: any) => ` ${ctx.raw} (${Math.round(ctx.raw / (fd[0]?.count || 1) * 100)}%)` } } }, scales: AXES },
    }
  }, [data, chartReady, tab])

  useChart("ch-donut", () => {
    // Use the ordered stage counts list from the API (data-driven labels)
    const scl: any[] = (data?.stageCountsList ?? []).filter((s: any) => s.count > 0)
    return {
      type: "doughnut",
      data: {
        labels: scl.map(s => s.label),
        datasets: [{
          data: scl.map(s => s.count),
          backgroundColor: scl.map((_: any, i: number) => STAGE_COLORS_BG[i % STAGE_COLORS_BG.length]),
          borderColor: scl.map((_: any, i: number) => STAGE_COLORS_BORDER[i % STAGE_COLORS_BORDER.length]),
          borderWidth: 1,
        }],
      },
      options: { cutout: "64%", responsive: false, plugins: { legend: { position: "bottom", labels: { font: { size: 10 }, boxWidth: 12 } }, tooltip: TIP } },
    }
  }, [data, chartReady, tab])

  useChart("ch-monthly", () => {
    const bm: any[] = data?.byMonth ?? []
    return {
      type: "bar",
      data: { labels: bm.map(m => fmtMo(m.month)), datasets: [{ label: "New Contacts", data: bm.map(m => m.count), backgroundColor: BLUE+"33", borderColor: BLUE, borderWidth: 1.5, borderRadius: 4 }] },
      options: { responsive: false, plugins: { legend: { display: false }, tooltip: TIP }, scales: AXES },
    }
  }, [data, chartReady, tab])

  useChart("ch-lead-status", () => {
    const ls: any[] = data?.leadStatusDistribution ?? []
    return {
      type: "bar",
      data: {
        labels: ls.map(d => d.status),
        datasets: [{ data: ls.map(d => d.count), backgroundColor: TEAL+"44", borderColor: TEAL, borderWidth: 1.5, borderRadius: 4, borderSkipped: false }],
      },
      options: { indexAxis: "y", responsive: false, plugins: { legend: { display: false }, tooltip: TIP }, scales: AXES },
    }
  }, [data, chartReady, tab])

  useChart("ch-deal-stages", () => {
    const ds: any[] = data?.dealStats?.byStage ?? []
    return {
      type: "bar",
      data: { labels: ds.map(s => s.stage), datasets: [{ label: "Count", data: ds.map(s => s.count), backgroundColor: PURPLE+"33", borderColor: PURPLE, borderWidth: 1.5, borderRadius: 4 }] },
      options: { responsive: false, plugins: { legend: { display: false }, tooltip: TIP }, scales: AXES },
    }
  }, [data, chartReady, tab])

  useChart("ch-deals-monthly", () => {
    const dm: any[] = data?.dealStats?.byMonth ?? []
    return {
      type: "bar",
      data: { labels: dm.map(m => fmtMo(m.month)), datasets: [
        { label: "Created",    data: dm.map(m => m.created),   backgroundColor: BD, borderColor: BLUE,  borderWidth: 1.5, borderRadius: 4 },
        { label: "Closed Won", data: dm.map(m => m.closedWon), backgroundColor: GD, borderColor: GREEN, borderWidth: 1.5, borderRadius: 4 },
      ]},
      options: { responsive: false, plugins: { legend: { position: "bottom", labels: { font: { size: 10 }, boxWidth: 12 } }, tooltip: TIP }, scales: AXES },
    }
  }, [data, chartReady, tab])

  useChart("ch-score-dist", () => {
    const sd: any[] = data?.leadQuality?.scoreDistribution ?? []
    return {
      type: "bar",
      data: { labels: sd.map(b => b.bucket), datasets: [{ label: "Contacts", data: sd.map(b => b.count), backgroundColor: AMBER+"33", borderColor: AMBER, borderWidth: 1.5, borderRadius: 4 }] },
      options: { responsive: false, plugins: { legend: { display: false }, tooltip: TIP }, scales: AXES },
    }
  }, [data, chartReady, tab])

  useChart("ch-score-stage", () => {
    const ss: any[] = data?.leadQuality?.scoreByStage ?? []
    return {
      type: "bar",
      data: { labels: ss.map(s => s.stage), datasets: [{ label: "Avg Score", data: ss.map(s => s.avgScore), backgroundColor: BLUE+"33", borderColor: BLUE, borderWidth: 1.5, borderRadius: 4 }] },
      options: { responsive: false, plugins: { legend: { display: false }, tooltip: TIP }, scales: AXES },
    }
  }, [data, chartReady, tab])

  useChart("ch-grade-pie", () => {
    const gd: any[] = data?.leadQuality?.gradeDistribution ?? []
    const colors = [GREEN, BLUE, PURPLE, AMBER, RED, MUTED]
    return {
      type: "doughnut",
      data: { labels: gd.map(g => g.grade), datasets: [{ data: gd.map(g => g.count), backgroundColor: gd.map((_g, i) => colors[i % colors.length]), borderWidth: 1 }] },
      options: { cutout: "60%", responsive: false, plugins: { legend: { position: "bottom", labels: { font: { size: 10 }, boxWidth: 12 } }, tooltip: TIP } },
    }
  }, [data, chartReady, tab])

  if (status === "loading" || loading) {
    return (
      <div style={s.page}>
        <nav style={s.nav}>
          <img src="/logo.png" height={22} style={{ filter:"brightness(0) invert(1)", opacity:0.9 }} alt="logo" />
        </nav>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh", gap:12 }}>
          <p style={{ color:MUTED, fontSize:13 }}>Loading pipeline data…</p>
        </div>
      </div>
    )
  }

  const tabBtn = (i: number) => ({
    background:"transparent", border:"none",
    borderBottom: tab === i ? `2px solid ${INK}` : "2px solid transparent",
    padding:"10px 20px", fontSize:13, fontWeight: tab === i ? 700 : 500,
    color: tab === i ? INK : MUTED, cursor:"pointer" as const, fontFamily:"inherit", marginBottom:-2,
  })

  const Lbl = ({ children }: { children: React.ReactNode }) => (
    <div style={s.lbl}><span style={s.lblTxt}>{children}</span></div>
  )

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <img src="/logo.png" height={22} style={{ filter:"brightness(0) invert(1)", opacity:0.9 }} alt="logo" />
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {data?.fetchedAt && <span style={{ fontSize:11, color:"rgba(255,255,255,.55)" }}>Synced {fmtDate(data.fetchedAt)}</span>}
          <button onClick={handleSync} disabled={syncing} style={{ background:"rgba(255,255,255,.12)", border:"1px solid rgba(255,255,255,.2)", color:"#fff", borderRadius:6, padding:"5px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
            {syncing ? "Syncing… (1–2 min)" : "↻ Sync"}
          </button>
          <button onClick={() => signOut({ callbackUrl:"/login" })} style={{ background:"transparent", border:"1px solid rgba(255,255,255,.2)", color:"rgba(255,255,255,.7)", borderRadius:6, padding:"5px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
            Sign Out
          </button>
        </div>
      </nav>

      <div style={s.main}>
        <div style={s.tabs}>
          {TABS.map((t, i) => <button key={t} style={tabBtn(i)} onClick={() => setTab(i)}>{t}</button>)}
        </div>

        {!data && (
          <div style={{ ...s.cc, textAlign:"center", padding:40 }}>
            <p style={{ color:MUTED, marginBottom:16, fontSize:13 }}>No data yet. Run a sync to load HubSpot data.</p>
            <button onClick={handleSync} disabled={syncing} style={{ background:BLUE, color:"#fff", border:"none", borderRadius:6, padding:"8px 20px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              {syncing ? "Syncing…" : "↻ Sync Now"}
            </button>
          </div>
        )}

        {data && (<>

          {/* ══ TAB 0 — Lead Pipeline ══════════════════════════════════ */}
          {tab === 0 && (<>
            <Lbl>KPI · Lead Pipeline · since launch</Lbl>
            <div style={s.g4}>
              <div style={{ ...s.kpi, borderTop:`3px solid ${GREEN}` }}>
                <div style={s.kpiLbl}>Total Contacts</div>
                <div style={{ ...s.kpiVal, color:GREEN }}>{fmt(data.totalContacts)}</div>
                <div style={s.kpiSub}>Excl. VaekstNet brand</div>
              </div>
              <div style={{ ...s.kpi, borderTop:`3px solid ${BLUE}` }}>
                <div style={s.kpiLbl}>Customers / Existing Investors</div>
                <div style={{ ...s.kpiVal, color:BLUE }}>{fmt(data.stageCounts?.customer || 0)}</div>
                <div style={s.kpiSub}>{Math.round((data.stageCounts?.customer || 0) / (data.totalContacts || 1) * 100)}% conversion</div>
              </div>
              <div style={{ ...s.kpi, borderTop:`3px solid ${RED}` }}>
                <div style={s.kpiLbl}>Stuck Contacts</div>
                <div style={{ ...s.kpiVal, color:RED }}>{fmt(data.stuckLeads?.length || 0)}</div>
                <div style={s.kpiSub}>30+ days no stage change</div>
              </div>
              <div style={{ ...s.kpi, borderTop:`3px solid ${AMBER}` }}>
                <div style={s.kpiLbl}>Reinvesting</div>
                <div style={{ ...s.kpiVal, color:AMBER }}>{fmt(data.reinvestering?.reinvestedCount || 0)}</div>
                <div style={s.kpiSub}>{data.reinvestering?.medianDays || 0} days median · 2+ closed won deals</div>
              </div>
            </div>

            <Lbl>Activation Funnel · Lead → Customer</Lbl>
            <div style={s.cc}>
              <div style={s.ccTitle}>Activation Funnel</div>
              <div style={{ overflowX:"auto", marginTop:12 }}>
                <canvas id="ch-funnel" width={1100} height={220} style={{ maxWidth:"100%" }} />
              </div>
            </div>

            <Lbl>Stage Distribution &amp; Monthly Contacts</Lbl>
            <div style={s.g2}>
              <div style={s.cc}>
                <div style={s.ccTitle}>Stage Distribution</div>
                <div style={{ display:"flex", justifyContent:"center", marginTop:12 }}>
                  <canvas id="ch-donut" width={300} height={300} style={{ maxWidth:"100%" }} />
                </div>
              </div>
              <div style={s.cc}>
                <div style={s.ccTitle}>New Contacts / Month (last 18)</div>
                <div style={{ overflowX:"auto", marginTop:12 }}>
                  <canvas id="ch-monthly" width={1100} height={200} style={{ maxWidth:"100%" }} />
                </div>
              </div>
            </div>

            <Lbl>Avg Time Between Stages · median days</Lbl>
            <div style={s.tcard}>
              <div style={s.tcardH}><span style={s.tcardT}>Stage Transitions</span><span style={s.tcardS}>based on lifecycle history</span></div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>
                    <th style={s.th}>Stage Transition</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Median Days</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Avg Days</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Sample</th>
                  </tr></thead>
                  <tbody>
                    {Object.entries(data.avgDaysPerTransition || {}).map(([key, val]: [string, any]) => (
                      <tr key={key}>
                        <td style={s.td}>{key}</td>
                        <td style={s.tdr}>{val.median}</td>
                        <td style={s.tdr}>{val.avg}</td>
                        <td style={s.tdr}>{val.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Lbl>Time in Current Stage</Lbl>
            <div style={s.g4}>
              {Object.values(data.avgDaysInCurrentStage || {}).map((v: any) => {
                const hot = v.median > 90
                return (
                  <div key={v.label} style={{ ...s.kpi, background: hot ? "rgba(224,108,117,.07)" : "#fff", borderColor: hot ? RED : BORDER }}>
                    <div style={s.kpiLbl}>{v.label}</div>
                    <div style={{ ...s.kpiVal, fontSize:28, color: hot ? RED : INK }}>{v.avg}</div>
                    <div style={s.kpiSub}>avg days · {v.median} median</div>
                    <div style={{ fontSize:10, color:MUTED, marginTop:2 }}>{v.count} contacts</div>
                  </div>
                )
              })}
            </div>
          </>)}

          {/* ══ TAB 1 — Deals ══════════════════════════════════════════ */}
          {tab === 1 && (<>
            <Lbl>KPI · Deals · all time</Lbl>
            <div style={s.g4}>
              <div style={{ ...s.kpi, borderTop:`3px solid ${BLUE}` }}>
                <div style={s.kpiLbl}>Total Pipeline</div>
                <div style={{ ...s.kpiVal, fontSize:24, color:BLUE }}>{fmtCcy(data.dealStats?.totalPipeline || 0)}</div>
                <div style={s.kpiSub}>open deals value</div>
              </div>
              <div style={{ ...s.kpi, borderTop:`3px solid ${GREEN}` }}>
                <div style={s.kpiLbl}>Closed Won</div>
                <div style={{ ...s.kpiVal, fontSize:24, color:GREEN }}>{fmtCcy(data.dealStats?.closedWon || 0)}</div>
                <div style={s.kpiSub}>{data.dealStats?.closedWonCount || 0} deals</div>
              </div>
              <div style={{ ...s.kpi, borderTop:`3px solid ${PURPLE}` }}>
                <div style={s.kpiLbl}>Avg Deal Size</div>
                <div style={{ ...s.kpiVal, fontSize:24, color:PURPLE }}>{fmtCcy(data.dealStats?.avgDealSize || 0)}</div>
                <div style={s.kpiSub}>closed won</div>
              </div>
              <div style={{ ...s.kpi, borderTop:`3px solid ${AMBER}` }}>
                <div style={s.kpiLbl}>Win Rate</div>
                <div style={{ ...s.kpiVal, color:AMBER }}>{data.dealStats?.winRate || 0}%</div>
                <div style={s.kpiSub}>closed won / total deals</div>
              </div>
            </div>

            <Lbl>Pipeline by Stage</Lbl>
            <div style={s.cc}>
              <div style={s.ccTitle}>Deals by Stage (count)</div>
              <div style={{ overflowX:"auto", marginTop:12 }}>
                <canvas id="ch-deal-stages" width={900} height={250} style={{ maxWidth:"100%" }} />
              </div>
            </div>

            <Lbl>Deals Created vs Closed Won / Month</Lbl>
            <div style={s.cc}>
              <div style={s.ccTitle}>Deal Activity by Month (last 18)</div>
              <div style={{ overflowX:"auto", marginTop:12 }}>
                <canvas id="ch-deals-monthly" width={1100} height={220} style={{ maxWidth:"100%" }} />
              </div>
            </div>

            <Lbl>Top Performers</Lbl>
            <div style={s.tcard}>
              <div style={s.tcardH}><span style={s.tcardT}>Revenue by Salesperson</span></div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>
                    <th style={s.th}>#</th><th style={s.th}>Salesperson</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Created</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Closed</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Revenue</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Avg Days</th>
                  </tr></thead>
                  <tbody>
                    {(data.dealStats?.topPerformers || []).map((p: any, i: number) => (
                      <tr key={p.owner}>
                        <td style={s.td}><span style={s.rank}>{i + 1}</span></td>
                        <td style={{ ...s.td, fontWeight:600 }}>{p.owner}</td>
                        <td style={s.tdr}>{p.created}</td>
                        <td style={s.tdr}>{p.closed}</td>
                        <td style={{ ...s.tdr, color:GREEN, fontWeight:700 }}>{fmtCcy(p.revenue)}</td>
                        <td style={s.tdr}>{p.avgDays || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Lbl>Avg Deal Duration by Salesperson</Lbl>
            <div style={s.tcard}>
              <div style={s.tcardH}><span style={s.tcardT}>Days from Create → Close (Won)</span><span style={s.tcardS}>sorted ascending</span></div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>
                    <th style={s.th}>#</th><th style={s.th}>Salesperson</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Closed Won</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Avg Days to Close</th>
                  </tr></thead>
                  <tbody>
                    {(data.dealStats?.topPerformers || []).filter((p: any) => p.avgDays > 0).sort((a: any, b: any) => a.avgDays - b.avgDays).map((p: any, i: number) => (
                      <tr key={p.owner}>
                        <td style={s.td}><span style={s.rank}>{i + 1}</span></td>
                        <td style={{ ...s.td, fontWeight:600 }}>{p.owner}</td>
                        <td style={s.tdr}>{p.closed}</td>
                        <td style={{ ...s.tdr, color: p.avgDays < 60 ? GREEN : p.avgDays < 120 ? AMBER : RED, fontWeight:600 }}>{p.avgDays} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>)}

          {/* ══ TAB 2 — Lead Quality ═══════════════════════════════════ */}
          {tab === 2 && (<>
            <Lbl>Lead Scoring Distribution</Lbl>
            <div style={s.g2}>
              <div style={s.cc}>
                <div style={s.ccTitle}>Score Buckets</div>
                <div style={{ marginTop:12 }}><canvas id="ch-score-dist" width={480} height={220} style={{ maxWidth:"100%" }} /></div>
              </div>
              <div style={s.cc}>
                <div style={s.ccTitle}>Avg Score by Lifecycle Stage</div>
                <div style={{ marginTop:12 }}><canvas id="ch-score-stage" width={480} height={220} style={{ maxWidth:"100%" }} /></div>
              </div>
            </div>

            <Lbl>Grade &amp; Source</Lbl>
            <div style={s.g2}>
              <div style={s.cc}>
                <div style={s.ccTitle}>Global Grade Distribution</div>
                <div style={{ display:"flex", justifyContent:"center", marginTop:12 }}>
                  <canvas id="ch-grade-pie" width={260} height={220} style={{ maxWidth:"100%" }} />
                </div>
                <div style={{ marginTop:12, display:"flex", flexWrap:"wrap", gap:6 }}>
                  {(data.leadQuality?.gradeDistribution || []).map((g: any) => (
                    <span key={g.grade} style={{ fontSize:11, background:"#f7f5f0", borderRadius:4, padding:"2px 8px", color:INK }}>{g.grade}: <strong>{g.count}</strong></span>
                  ))}
                </div>
              </div>
              <div style={s.tcard}>
                <div style={s.tcardH}><span style={s.tcardT}>Conversion Rate by Lead Source</span></div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead><tr>
                      <th style={s.th}>Source</th>
                      <th style={{ ...s.th, textAlign:"right" as const }}>Total</th>
                      <th style={{ ...s.th, textAlign:"right" as const }}>Customers</th>
                      <th style={{ ...s.th, textAlign:"right" as const }}>Conv%</th>
                    </tr></thead>
                    <tbody>
                      {(data.leadQuality?.conversionBySource || []).map((row: any) => (
                        <tr key={row.source}>
                          <td style={s.td}>{row.source}</td>
                          <td style={s.tdr}>{row.total}</td>
                          <td style={{ ...s.tdr, color:GREEN, fontWeight:600 }}>{row.customers}</td>
                          <td style={{ ...s.tdr, color: row.pct >= 10 ? GREEN : row.pct >= 5 ? AMBER : MUTED, fontWeight:600 }}>{row.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <Lbl>Top 50 Contacts by Lead Score</Lbl>
            <div style={s.tcard}>
              <div style={s.tcardH}><span style={s.tcardT}>Highest Scoring Contacts</span><span style={s.tcardS}>top 50</span></div>
              <div style={{ overflowX:"auto", maxHeight:480, overflow:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>
                    <th style={s.th}>#</th><th style={s.th}>Name</th><th style={s.th}>Email</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Score</th>
                    <th style={s.th}>Stage</th><th style={s.th}>Status</th><th style={s.th}>Owner</th><th style={s.th}>Last Contacted</th>
                  </tr></thead>
                  <tbody>
                    {(data.leadQuality?.topScoring || []).map((c: any, i: number) => (
                      <tr key={c.id}>
                        <td style={s.td}><span style={s.rank}>{i + 1}</span></td>
                        <td style={s.td}><a href={`https://app-eu1.hubspot.com/contacts/${PORTAL}/contact/${c.id}`} target="_blank" rel="noreferrer" style={{ color:BLUE, fontWeight:600, textDecoration:"none", fontSize:12 }}>{c.name || "—"}</a></td>
                        <td style={{ ...s.td, color:MUTED }}>{c.email}</td>
                        <td style={{ ...s.tdr, color:AMBER, fontWeight:700 }}>{Math.round(c.score)}</td>
                        <td style={s.td}>{c.stage}</td>
                        <td style={{ ...s.td, color:MUTED }}>{c.status || "—"}</td>
                        <td style={s.td}>{c.owner}</td>
                        <td style={{ ...s.td, color:MUTED }}>{fmtDate(c.lastContacted)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>)}

          {/* ══ TAB 3 — Salesperson Performance ════════════════════════ */}
          {tab === 3 && (<>
            <Lbl>Stage Breakdown by Owner</Lbl>
            <div style={s.tcard}>
              <div style={s.tcardH}><span style={s.tcardT}>Contacts per Salesperson</span></div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>
                    <th style={s.th}>Salesperson</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Lead</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>MQL Cold</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>MQL Hot</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>SQL</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Opportunity</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Customer</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Total</th>
                  </tr></thead>
                  <tbody>
                    {(data.byOwner || []).map((o: any) => {
                      const total = o.lead + (o.mqlCold || 0) + (o.mqlHot || 0) + o.sql + o.opportunity + o.customer
                      return (
                        <tr key={o.name}>
                          <td style={{ ...s.td, fontWeight:600, color:BLUE }}>{o.name}</td>
                          <td style={s.tdr}>{o.lead}</td>
                          <td style={s.tdr}>{o.mqlCold || 0}</td>
                          <td style={s.tdr}>{o.mqlHot || 0}</td>
                          <td style={s.tdr}>{o.sql}</td>
                          <td style={s.tdr}>{o.opportunity}</td>
                          <td style={{ ...s.tdr, color:GREEN, fontWeight:700 }}>{o.customer}</td>
                          <td style={{ ...s.tdr, fontWeight:700 }}>{total}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <Lbl>Activity Leaderboard · last 30 days</Lbl>
            <div style={s.tcard}>
              <div style={s.tcardH}><span style={s.tcardT}>Calls / Emails / Meetings</span><span style={s.tcardS}>last 30 days</span></div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>
                    <th style={s.th}>Salesperson</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Calls</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Emails</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Meetings</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Total</th>
                  </tr></thead>
                  <tbody>
                    {(data.activityByOwner || []).length === 0
                      ? <tr><td colSpan={5} style={{ ...s.td, textAlign:"center" as const, color:MUTED }}>No activity data — sync to populate</td></tr>
                      : (data.activityByOwner || []).map((a: any) => (
                        <tr key={a.owner}>
                          <td style={{ ...s.td, fontWeight:600 }}>{a.owner}</td>
                          <td style={s.tdr}>{a.calls}</td>
                          <td style={s.tdr}>{a.emails}</td>
                          <td style={s.tdr}>{a.meetings}</td>
                          <td style={{ ...s.tdr, fontWeight:700, color:BLUE }}>{a.total}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <Lbl>Stuck Contacts per Rep</Lbl>
            <div style={s.tcard}>
              <div style={s.tcardH}><span style={s.tcardT}>Stuck Contacts (30+ days) by Owner</span></div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>
                    <th style={s.th}>Salesperson</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Stuck Contacts</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>% of Their Total</th>
                  </tr></thead>
                  <tbody>
                    {(data.stuckPerOwner || []).map((row: any) => {
                      const ownerRow = (data.byOwner || []).find((o: any) => o.name === row.owner)
                      const total = ownerRow ? ownerRow.lead + (ownerRow.mqlCold || 0) + (ownerRow.mqlHot || 0) + ownerRow.sql + ownerRow.opportunity + ownerRow.customer : 0
                      const pct = total > 0 ? Math.round(row.stuck / total * 100) : 0
                      return (
                        <tr key={row.owner}>
                          <td style={{ ...s.td, fontWeight:600 }}>{row.owner}</td>
                          <td style={{ ...s.tdr, color:RED, fontWeight:700 }}>{row.stuck}</td>
                          <td style={{ ...s.tdr, color: pct > 50 ? RED : pct > 25 ? AMBER : MUTED }}>{pct}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>)}

          {/* ══ TAB 4 — Stuck & At-Risk ════════════════════════════════ */}
          {tab === 4 && (<>
            <Lbl>Stuck Contacts · 30+ days no progress</Lbl>
            <div style={s.tcard}>
              <div style={s.tcardH}><span style={s.tcardT}>Stuck Contacts — 30+ days</span><span style={s.tcardS}>{data.stuckLeads?.length || 0} total</span></div>
              <div style={{ overflowX:"auto", maxHeight:500, overflow:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>
                    <th style={s.th}>#</th><th style={s.th}>Name</th><th style={s.th}>Email</th>
                    <th style={s.th}>Lifecycle Stage</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Days Stuck</th>
                    <th style={s.th}>Owner</th><th style={s.th}>Last Activity</th>
                  </tr></thead>
                  <tbody>
                    {(data.stuckLeads || []).map((l: any, i: number) => {
                      const rowBg = l.daysInStage >= 180 ? "rgba(224,108,117,.08)" : l.daysInStage >= 30 ? "rgba(150,128,58,.06)" : undefined
                      const dayColor = l.daysInStage >= 180 ? RED : l.daysInStage >= 90 ? AMBER : MUTED
                      return (
                        <tr key={l.id} style={{ background:rowBg }}>
                          <td style={s.td}><span style={s.rank}>{i + 1}</span></td>
                          <td style={s.td}><a href={`https://app-eu1.hubspot.com/contacts/${PORTAL}/contact/${l.id}`} target="_blank" rel="noreferrer" style={{ color:BLUE, fontWeight:600, textDecoration:"none", fontSize:12 }}>{l.name || "—"}</a></td>
                          <td style={{ ...s.td, color:MUTED }}>{l.email}</td>
                          <td style={s.td}>{l.stage}</td>
                          <td style={{ ...s.tdr, color:dayColor, fontWeight:700 }}>{l.daysInStage}</td>
                          <td style={s.td}>{l.owner}</td>
                          <td style={{ ...s.td, color:MUTED }}>{fmtDate(l.lastActivity)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <Lbl>Lead Status Distribution — Sales outreach stages</Lbl>
            <div style={s.cc}>
              <div style={s.ccTitle}>Lead Status Distribution</div>
              <div style={s.ccSub}>Count of contacts at each Lead Status — separate from Lifecycle Stage funnel</div>
              <div style={{ overflowX:"auto", marginTop:12 }}>
                <canvas id="ch-lead-status" width={900} height={280} style={{ maxWidth:"100%" }} />
              </div>
            </div>

            <Lbl>Stage vs Status Cross-table</Lbl>
            <div style={s.tcard}>
              <div style={s.tcardH}>
                <span style={s.tcardT}>Lifecycle Stage × Lead Status Matrix</span>
                <span style={s.tcardS}>contacts at each intersection</span>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>
                    <th style={{ ...s.th, minWidth:160 }}>Lifecycle Stage</th>
                    {(data.leadStatusCols || []).map((col: string) => (
                      <th key={col} style={{ ...s.th, textAlign:"right" as const, whiteSpace:"nowrap" as const }}>{col}</th>
                    ))}
                    <th style={{ ...s.th, textAlign:"right" as const }}>Total</th>
                  </tr></thead>
                  <tbody>
                    {(data.stageStatusMatrix || []).map((row: any) => (
                      <tr key={row.stage}>
                        <td style={{ ...s.td, fontWeight:600 }}>{row.stage}</td>
                        {(data.leadStatusCols || []).map((col: string) => {
                          const val = row[col] || 0
                          const hi = val > 0
                          return (
                            <td key={col} style={{ ...s.tdr, color: hi ? INK : MUTED, fontWeight: hi ? 600 : 400 }}>
                              {val > 0 ? val : "—"}
                            </td>
                          )
                        })}
                        <td style={{ ...s.tdr, fontWeight:700, color:BLUE }}>{row["_total"] || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Lbl>Nurture Candidates · no activity 180+ days</Lbl>
            <div style={s.tcard}>
              <div style={s.tcardH}>
                <span style={s.tcardT}>Re-engagement Candidates</span>
                <span style={s.tcardS}>180+ days no activity · excl. Nurture / Existing Investor / Grade E–F / Customer / Disqualified</span>
              </div>
              <div style={{ overflowX:"auto", maxHeight:400, overflow:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>
                    <th style={s.th}>#</th><th style={s.th}>Name</th><th style={s.th}>Email</th>
                    <th style={s.th}>Lifecycle Stage</th><th style={s.th}>Owner</th>
                    <th style={s.th}>Last Contacted</th>
                    <th style={s.th}>HubSpot</th>
                  </tr></thead>
                  <tbody>
                    {(data.nurtureCandidates || []).map((c: any, i: number) => (
                      <tr key={c.id}>
                        <td style={s.td}><span style={s.rank}>{i + 1}</span></td>
                        <td style={{ ...s.td, fontWeight:600 }}>{c.name || "—"}</td>
                        <td style={{ ...s.td, color:MUTED }}>{c.email}</td>
                        <td style={s.td}>{c.stage}</td>
                        <td style={s.td}>{c.owner}</td>
                        <td style={{ ...s.td, color:MUTED }}>{fmtDate(c.lastContacted)}</td>
                        <td style={s.td}>
                          <a href={`https://app-eu1.hubspot.com/contacts/${PORTAL}/contact/${c.id}`} target="_blank" rel="noreferrer" style={{ color:BLUE, fontWeight:600, textDecoration:"none", fontSize:12 }}>Open ↗</a>
                        </td>
                      </tr>
                    ))}
                    {(data.nurtureCandidates || []).length === 0 && (
                      <tr><td colSpan={7} style={{ ...s.td, textAlign:"center" as const, color:MUTED }}>No candidates found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>)}

        </>)}

        <div style={{ height:48 }} />
      </div>
    </div>
  )
}
