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

const TABS: string[] = [] // No tabs — Contact Pipeline shows all sections directly

// Canonical English lifecycle stage labels — overrides whatever the cache says.
// IDs verified against HubSpot property settings (some are custom numeric IDs).
const STAGE_LABELS: Record<string, string> = {
  lead:                   "Lead",
  marketingqualifiedlead: "MQL Cold",
  "770940371":            "MQL Hot",
  salesqualifiedlead:     "SQL",
  opportunity:            "Opportunity / Potential Investor",
  customer:               "Customer / Existing Investor",
  evangelist:             "Evangelist",
  "1874186475":           "Disqualified",
  "3529709812":           "Job Applicant",
  "773079518":            "Attempted / Connected",
  other:                  "Other",
}
const sl = (id: string, fallback: string) => STAGE_LABELS[id] ?? fallback

// Colors for stage donut chart (one per lifecycle stage slot)
const STAGE_COLORS_BG = [BLUE+"cc", PURPLE+"cc", TEAL+"cc", GREEN+"cc", AMBER+"cc", RED+"cc", MUTED+"cc", "#1a7fc1cc", "#8b5cf6cc", "#0d9488cc"]
const STAGE_COLORS_BORDER = [BLUE, PURPLE, TEAL, GREEN, AMBER, RED, MUTED, "#1a7fc1", "#8b5cf6", "#0d9488"]

const BRAND_LABELS: Record<string, string> = {
  "0":        "Denmark",
  "17424990": "Sweden",
  "17893427": "Shipping",
  "18387361": "Austria",
  "17065112": "Finland",
  "17435297": "Norway",
}
const REGION_TO_BRAND: Record<string, string> = {
  dk: "0", se: "17424990", ship: "17893427", at: "18387361", fi: "17065112", no: "17435297"
}

const PIPELINE_ALLOWED_EMAILS = new Set(["brj@vaekstkapital.dk","tnp@vaekstkapital.dk","sok@vaekstkapital.dk","aro@vaekstkapital.dk","sts@vaekstkapital.dk","spo@vaekstkapital.se","acs@vaekstkapital.se","nry@vaekstkapital.se"])
const ADMIN_DOMAINS = new Set(["vkfunddistribution.com","vaekstholdings.com"])
// Non-admin domains that have pipeline access → locked to their own brand
const DOMAIN_TO_BRAND: Record<string, string> = {
  "vaekstkapital.dk": "0",
  "vaekstkapital.se": "17424990",
  "vaekstkapital.at": "18387361",
}

export default function PipelinePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState(0)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [chartReady, setChartReady] = useState(false)
  // "" = not yet resolved; only fetch once this is a real brand id
  const [brandId, setBrandId] = useState<string>("")
  const [filterOwner, setFilterOwner] = useState<string>("all")
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return }
    if (status === "authenticated") {
      const email = session?.user?.email?.toLowerCase() ?? ""
      const domain = email.split("@")[1] ?? ""
      const allowed = ADMIN_DOMAINS.has(domain) || domain === "vaekstkapital.at" || PIPELINE_ALLOWED_EMAILS.has(email)
      if (!allowed) { router.push("/"); return }
      const admin = ADMIN_DOMAINS.has(domain)
      setIsAdmin(admin)
      if (!admin) {
        // Non-admins locked to their own brand
        const lockedBrand = DOMAIN_TO_BRAND[domain]
        setBrandId(lockedBrand ?? "0")
      } else {
        // Admins: use URL param brand if present, otherwise Denmark
        const params = new URLSearchParams(window.location.search)
        const region = params.get("region")
        const urlBrand = params.get("brand") ?? (region ? REGION_TO_BRAND[region] : null)
        setBrandId(urlBrand ?? "0")
      }
    }
  }, [status, session])

  useEffect(() => {
    if (typeof window === "undefined") return
    if ((window as any).Chart) { setChartReady(true); return }
    const scr = document.createElement("script")
    scr.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"
    scr.onload = () => setChartReady(true)
    document.head.appendChild(scr)
  }, [])

  useEffect(() => {
    if (status !== "authenticated" || brandId === "") return
    const url = `/api/pipeline-data?brand=${brandId}`
    setFilterOwner("all")
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [status, brandId])

  async function handleSync() {
    setSyncing(true)
    await fetch("/api/pipeline-sync")
    const url = brandId ? `/api/pipeline-data?brand=${brandId}` : "/api/pipeline-data"
    const res = await fetch(url)
    const d = await res.json()
    if (!d.error) setData(d)
    setSyncing(false)
  }

  useChart("ch-funnel", () => {
    const FUNNEL_IDS = ["lead","marketingqualifiedlead","770940371","salesqualifiedlead","opportunity","customer"]
    // Slice to FUNNEL_IDS.length — old cached data may have extra stale entries (e.g. "Kunde")
    const fd: any[] = (data?.funnelData ?? []).slice(0, FUNNEL_IDS.length)
    const labels = fd.map((f: any, i: number) => sl(f.id ?? FUNNEL_IDS[i], f.stage))
    return {
      type: "bar",
      data: { labels, datasets: [{ data: fd.map(f => f.count), backgroundColor: BLUE, borderRadius: 4, borderSkipped: false }] },
      options: { indexAxis: "y", responsive: false, plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: (ctx: any) => ` ${ctx.raw} (${Math.round(ctx.raw / (fd[0]?.count || 1) * 100)}%)` } } }, scales: AXES },
    }
  }, [data, chartReady, tab])

  useChart("ch-donut", () => {
    const scl: any[] = (data?.stageCountsList ?? []).filter((s: any) => s.count > 0)
    return {
      type: "doughnut",
      data: {
        labels: scl.map(s => sl(s.id, s.label)),
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
      data: { labels: ss.map(s => sl(s.id, s.stage)), datasets: [{ label: "Avg Score", data: ss.map(s => s.avgScore), backgroundColor: BLUE+"33", borderColor: BLUE, borderWidth: 1.5, borderRadius: 4 }] },
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
          <img src="/vaekstkapital-logo.webp" height={22} style={{ filter:"brightness(0) invert(1)", opacity:0.9 }} alt="logo" />
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
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <a href="/" style={{ display:"flex", alignItems:"center", textDecoration:"none" }}>
            <img src="/vaekstkapital-logo.webp" height={22} style={{ filter:"brightness(0) invert(1)", opacity:0.9 }} alt="logo" />
          </a>
          <span style={{ color:"rgba(255,255,255,.3)", fontSize:12 }}>›</span>
          <span style={{ color:"rgba(255,255,255,.85)", fontSize:12, fontWeight:600, letterSpacing:".04em" }}>
            CONTACT PIPELINE{brandId && BRAND_LABELS[brandId] ? ` · ${BRAND_LABELS[brandId].toUpperCase()}` : ""}
          </span>
          <a href="/" style={{ textDecoration:"none", border:"1px solid rgba(255,255,255,.25)", background:"transparent", padding:"0 12px", height:28, borderRadius:4, fontSize:11, fontWeight:600, letterSpacing:".06em", color:"rgba(255,255,255,.8)", display:"flex", alignItems:"center", cursor:"pointer" }}>
            ← Go Back
          </a>
        </div>
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
        {!data && (
          <div style={{ ...s.cc, textAlign:"center", padding:40 }}>
            <p style={{ color:MUTED, marginBottom:16, fontSize:13 }}>No data yet. Run a sync to load HubSpot data.</p>
            <button onClick={handleSync} disabled={syncing} style={{ background:BLUE, color:"#fff", border:"none", borderRadius:6, padding:"8px 20px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              {syncing ? "Syncing…" : "↻ Sync Now"}
            </button>
          </div>
        )}

        {data && (<>
          {/* UNDER CONSTRUCTION banner */}
          <div style={{ background:"rgba(224,108,117,.12)", border:"1px solid "+RED, borderRadius:8, padding:"10px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:11, fontWeight:800, letterSpacing:".12em", textTransform:"uppercase" as const, color:RED }}>⚠ Under Construction</span>
            <span style={{ fontSize:11, color:RED, opacity:0.8 }}>Data and metrics are being validated — numbers may not yet be accurate.</span>
          </div>

          {/* Global Brand filter — admins only */}
          {isAdmin && (
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20, flexWrap:"wrap" as const }}>
              <span style={{ fontSize:11, fontWeight:700, color:MUTED, letterSpacing:".08em", textTransform:"uppercase" as const }}>Brand:</span>
              {Object.entries(BRAND_LABELS).map(([id, label]) => (
                <button key={id} onClick={() => { setBrandId(id); setFilterOwner("all") }} style={{ fontSize:11, padding:"5px 12px", borderRadius:6, border:"1px solid "+(brandId === id ? INK : BORDER), background: brandId === id ? INK : "#fff", color: brandId === id ? "#fff" : INK, cursor:"pointer", fontFamily:"inherit", fontWeight:600, transition:"all .12s" }}>{label}</button>
              ))}
            </div>
          )}

          {/* Contact Pipeline — all 11 sections */}
          {true && (<>

            {/* §1 KPI row */}
            <Lbl>KPI · Contact Pipeline</Lbl>
            <div style={s.g4}>
              <div style={{ ...s.kpi, borderTop:`3px solid ${GREEN}` }}>
                <div style={s.kpiLbl}>Total Contacts</div>
                <div style={{ ...s.kpiVal, color:GREEN }}>{fmt(data.totalContacts)}</div>
                <div style={s.kpiSub}>{data.brandId ? `Brand: ${data.brand ?? data.brandId}` : "Unique contacts across all brands"}</div>
              </div>
              <div style={{ ...s.kpi, borderTop:`3px solid ${BLUE}` }}>
                <div style={s.kpiLbl}>Customers / Existing Investors</div>
                <div style={{ ...s.kpiVal, color:BLUE }}>{fmt(data.stageCounts?.customer || 0)}</div>
                <div style={s.kpiSub}>{Math.round((data.stageCounts?.customer || 0) / (data.totalContacts || 1) * 100)}% of total contacts</div>
              </div>
              <div style={{ ...s.kpi, borderTop:`3px solid ${RED}` }}>
                <div style={s.kpiLbl}>Stuck Contacts</div>
                <div style={{ ...s.kpiVal, color:RED }}>{fmt(data.stuckLeads?.length || 0)}</div>
                <div style={s.kpiSub}>30+ days no progress</div>
              </div>
              <div style={{ ...s.kpi, borderTop:`3px solid ${AMBER}` }}>
                <div style={s.kpiLbl}>Reinvesting Customers</div>
                <div style={{ ...s.kpiVal, color:AMBER }}>{fmt(data.reinvestering?.reinvestedCount || 0)}</div>
                <div style={s.kpiSub}>Median {data.reinvestering?.medianDays || 0} days to reinvest</div>
              </div>
            </div>

            {/* §2 Activation Funnel + Stage Distribution */}
            <Lbl>Activation Funnel &amp; Stage Distribution</Lbl>
            <div style={s.g2}>
              <div style={s.cc}>
                <div style={s.ccTitle}>Activation Funnel</div>
                <div style={s.ccSub}>Contacts reaching each lifecycle stage</div>
                <div style={{ overflowX:"auto", marginTop:12 }}>
                  <canvas id="ch-funnel" width={520} height={280} style={{ maxWidth:"100%" }} />
                </div>
              </div>
              <div style={s.cc}>
                <div style={s.ccTitle}>Stage Distribution</div>
                <div style={{ display:"flex", justifyContent:"center", marginTop:12 }}>
                  <canvas id="ch-donut" width={300} height={300} style={{ maxWidth:"100%" }} />
                </div>
              </div>
            </div>

            {/* §4 New Contacts per Month */}
            <Lbl>New Contacts per Month</Lbl>
            <div style={s.cc}>
              <div style={s.ccTitle}>New contacts per month</div>
              <div style={s.ccSub}>Last 18 months</div>
              <div style={{ overflowX:"auto", marginTop:12 }}>
                <canvas id="ch-monthly" width={1100} height={200} style={{ maxWidth:"100%" }} />
              </div>
            </div>

            {/* §5 Avg Time Between Stages */}
            <Lbl>Average Time Between Stages</Lbl>
            <div style={s.cc}>
              <div style={s.ccTitle}>Average time between stages</div>
              <div style={s.ccSub}>Avg / median days — using HubSpot lifecycle stage date properties</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:10, marginTop:16 }}>
                {Object.entries(data.avgDaysPerTransition || {}).map(([key, val]: [string, any]) => (
                  <div key={key} style={{ background:"#f7f5f0", borderRadius:8, padding:"12px 14px", border:"1px solid "+BORDER }}>
                    <div style={{ fontSize:10, fontWeight:600, color:MUTED, marginBottom:8, letterSpacing:".06em", textTransform:"uppercase" as const, lineHeight:1.4 }}>{key}</div>
                    {val.count === 0
                      ? <div style={{ fontSize:12, color:MUTED, fontStyle:"italic" }}>No data yet</div>
                      : (<>
                          <div style={{ fontSize:26, fontWeight:700, color:INK, lineHeight:1 }}>{val.avg}</div>
                          <div style={{ fontSize:11, color:MUTED, marginTop:2 }}>avg days</div>
                          <div style={{ fontSize:13, fontWeight:600, color:MUTED, marginTop:6 }}>{val.median} median</div>
                          <div style={{ fontSize:10, color:MUTED, marginTop:2 }}>{val.count} data points</div>
                        </>)
                    }
                  </div>
                ))}
              </div>
            </div>

            {/* §6 Time in Current Stage */}
            <Lbl>Time in Current Stage</Lbl>
            <div style={s.cc}>
              <div style={s.ccTitle}>Time in current stage</div>
              <div style={s.ccSub}>Avg / median days contacts have been sitting in their current stage</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))", gap:10, marginTop:16 }}>
                {Object.entries(data.avgDaysInCurrentStage || {}).map(([stageId, v]: [string, any]) => {
                  const bg  = v.median > 90 ? "rgba(224,108,117,.1)" : v.median > 30 ? "rgba(150,128,58,.08)" : "rgba(21,97,76,.08)"
                  const col = v.median > 90 ? RED : v.median > 30 ? AMBER : GREEN
                  return (
                    <div key={stageId} style={{ background:bg, borderRadius:8, padding:"12px 14px", border:`1px solid ${col}33` }}>
                      <div style={{ fontSize:10, fontWeight:600, color:MUTED, marginBottom:6, letterSpacing:".06em", textTransform:"uppercase" as const }}>{sl(stageId, v.label)}</div>
                      <div style={{ fontSize:24, fontWeight:700, color:col, lineHeight:1 }}>{v.avg}</div>
                      <div style={{ fontSize:11, color:MUTED, marginTop:2 }}>avg days</div>
                      <div style={{ fontSize:13, fontWeight:600, color:col, marginTop:4 }}>{v.median} median</div>
                      <div style={{ fontSize:10, color:MUTED, marginTop:2 }}>{v.count} contacts</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* §7 Reinvestment */}
            <Lbl>Reinvestment</Lbl>
            <div style={s.g4}>
              <div style={{ ...s.kpi, borderTop:`3px solid ${AMBER}` }}>
                <div style={s.kpiLbl}>Reinvesting</div>
                <div style={{ ...s.kpiVal, color:AMBER }}>{data.reinvestering?.reinvestRate || 0}%</div>
                <div style={s.kpiSub}>{fmt(data.reinvestering?.reinvestedCount || 0)} customers with 2+ deals</div>
              </div>
              <div style={{ ...s.kpi, borderTop:`3px solid ${BLUE}` }}>
                <div style={s.kpiLbl}>Median Time to 2nd Deal</div>
                <div style={{ ...s.kpiVal, color:BLUE }}>{data.reinvestering?.medianDays || 0}</div>
                <div style={s.kpiSub}>{data.reinvestering?.avgDays || 0} days average</div>
              </div>
              <div style={{ ...s.kpi, borderTop:`3px solid ${GREEN}` }}>
                <div style={s.kpiLbl}>Within 90 Days</div>
                <div style={{ ...s.kpiVal, color:GREEN }}>
                  {data.reinvestering?.totalCustomers > 0 ? Math.round((data.reinvestering?.within90days || 0) / data.reinvestering.totalCustomers * 100) : 0}%
                </div>
                <div style={s.kpiSub}>{fmt(data.reinvestering?.within90days || 0)} customers</div>
              </div>
              <div style={{ ...s.kpi, borderTop:`3px solid ${TEAL}` }}>
                <div style={s.kpiLbl}>Within 180 Days</div>
                <div style={{ ...s.kpiVal, color:TEAL }}>
                  {data.reinvestering?.totalCustomers > 0 ? Math.round((data.reinvestering?.within180days || 0) / data.reinvestering.totalCustomers * 100) : 0}%
                </div>
                <div style={s.kpiSub}>{fmt(data.reinvestering?.within180days || 0)} customers</div>
              </div>
            </div>

            {/* §8 Contacts per Salesperson */}
            <Lbl>Contacts per Salesperson</Lbl>
            {/* Salesperson filter */}
            {(() => {
              const teamIds: string[] = data.teamOwnerIds?.[brandId] ?? []
              const teamNames: string[] = data.teamOwnerNames?.[brandId] ?? []
              const hasTeam = teamIds.length > 0 || teamNames.length > 0
              const visibleOwners: any[] = hasTeam
                ? (data.byOwner || []).filter((o: any) => teamIds.includes(o.ownerId) || teamNames.includes(o.name))
                : (data.byOwner || [])
              return (
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, flexWrap:"wrap" as const }}>
              <span style={{ fontSize:11, fontWeight:600, color:MUTED, letterSpacing:".06em", textTransform:"uppercase" as const }}>Salesperson:</span>
              <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} style={{ fontSize:11, padding:"4px 10px", borderRadius:6, border:"1px solid "+BORDER, background:"#fff", color:INK, fontFamily:"inherit", cursor:"pointer" }}>
                <option value="all">All</option>
                {visibleOwners.map((o: any) => <option key={o.name} value={o.name}>{o.name}</option>)}
              </select>
            </div>
              )
            })()}
            <div style={s.tcard}>
              <div style={s.tcardH}><span style={s.tcardT}>Contacts per Salesperson</span><span style={s.tcardS}>by lifecycle stage{brandId && BRAND_LABELS[brandId] ? ` · ${BRAND_LABELS[brandId]}` : ""}{filterOwner !== "all" ? ` · ${filterOwner}` : ""}</span></div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>
                    <th style={s.th}>Salesperson</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Lead</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>MQL Cold</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>MQL Hot</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>SQL</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Opportunity</th>
                    <th style={{ ...s.th, textAlign:"right" as const, background:"rgba(21,97,76,.06)" }}>Customer</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Disqualified</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Total</th>
                  </tr></thead>
                  <tbody>
                    {(() => {
                      const teamIds: string[] = data.teamOwnerIds?.[brandId] ?? []
                      const teamNames: string[] = data.teamOwnerNames?.[brandId] ?? []
                      const hasTeam = teamIds.length > 0 || teamNames.length > 0
                      return (data.byOwner || [])
                        .filter((o: any) => {
                          if (hasTeam && !teamIds.includes(o.ownerId) && !teamNames.includes(o.name)) return false
                          if (filterOwner !== "all" && o.name !== filterOwner) return false
                          return true
                        })
                        .map((o: any) => {
                          const total = o.lead + (o.mqlCold || 0) + (o.mqlHot || 0) + o.sql + o.opportunity + o.customer + (o.disqualified || 0)
                          return (
                            <tr key={o.name}>
                              <td style={{ ...s.td, fontWeight:600, color:BLUE }}>{o.name}</td>
                              <td style={s.tdr}>{o.lead}</td>
                              <td style={s.tdr}>{o.mqlCold || 0}</td>
                              <td style={s.tdr}>{o.mqlHot || 0}</td>
                              <td style={s.tdr}>{o.sql}</td>
                              <td style={s.tdr}>{o.opportunity}</td>
                              <td style={{ ...s.tdr, color:GREEN, fontWeight:700, background:"rgba(21,97,76,.04)" }}>{o.customer}</td>
                              <td style={{ ...s.tdr, color:MUTED }}>{o.disqualified || 0}</td>
                              <td style={{ ...s.tdr, fontWeight:700 }}>{total}</td>
                            </tr>
                          )
                        })
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* §10 Stuck Contacts */}
            <Lbl>Stuck Contacts · 30+ days no progress</Lbl>
            {/* Salesperson filter */}
            {(() => {
              const teamIds10: string[] = data.teamOwnerIds?.[brandId] ?? []
              const teamNames10: string[] = data.teamOwnerNames?.[brandId] ?? []
              const hasTeam10 = teamIds10.length > 0 || teamNames10.length > 0
              const visibleStuckOwners = [...new Set(
                (data.stuckLeads || [])
                  .filter((l: any) => !hasTeam10 || teamIds10.includes(l.ownerId) || teamNames10.includes(l.owner))
                  .map((l: any) => l.owner)
              )].sort()
              return (
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, flexWrap:"wrap" as const }}>
              <span style={{ fontSize:11, fontWeight:600, color:MUTED, letterSpacing:".06em", textTransform:"uppercase" as const }}>Salesperson:</span>
              <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} style={{ fontSize:11, padding:"4px 10px", borderRadius:6, border:"1px solid "+BORDER, background:"#fff", color:INK, fontFamily:"inherit", cursor:"pointer" }}>
                <option value="all">All</option>
                {visibleStuckOwners.map((o: any) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
              )
            })()}
            {(() => {
              const teamIds10: string[] = data.teamOwnerIds?.[brandId] ?? []
              const teamNames10: string[] = data.teamOwnerNames?.[brandId] ?? []
              const hasTeam10 = teamIds10.length > 0 || teamNames10.length > 0
              const filteredStuck = (data.stuckLeads || []).filter((l: any) => {
                if (hasTeam10 && !teamIds10.includes(l.ownerId) && !teamNames10.includes(l.owner)) return false
                if (filterOwner !== "all" && l.owner !== filterOwner) return false
                return true
              })
              return (
            <div style={s.tcard}>
              <div style={s.tcardH}>
                <span style={s.tcardT}>Stuck Contacts — 30+ days</span>
                <span style={s.tcardS}>{filteredStuck.length} total{filterOwner !== "all" ? ` · ${filterOwner}` : ""} · excl. Disqualified &amp; Job Applicant</span>
              </div>
              <div style={{ overflowX:"auto", maxHeight:520, overflow:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>
                    <th style={s.th}>#</th>
                    <th style={s.th}>Name</th>
                    <th style={s.th}>Email</th>
                    <th style={s.th}>Lifecycle Stage</th>
                    <th style={s.th}>Lead Status</th>
                    <th style={{ ...s.th, textAlign:"right" as const }}>Days Stuck</th>
                    <th style={s.th}>Salesperson</th>
                    <th style={s.th}>Last Contacted</th>
                    <th style={s.th}>HubSpot</th>
                  </tr></thead>
                  <tbody>
                    {filteredStuck.map((l: any, i: number) => {
                      const rowBg = l.daysInStage >= 180 ? "rgba(224,108,117,.08)" : "rgba(150,128,58,.05)"
                      const dayCol = l.daysInStage >= 180 ? RED : AMBER
                      return (
                        <tr key={l.id} style={{ background:rowBg }}>
                          <td style={s.td}><span style={s.rank}>{i + 1}</span></td>
                          <td style={{ ...s.td, fontWeight:600 }}>{l.name || "—"}</td>
                          <td style={{ ...s.td, color:MUTED }}>{l.email}</td>
                          <td style={s.td}>{l.stage}</td>
                          <td style={{ ...s.td, color:MUTED }}>{l.leadStatus || "—"}</td>
                          <td style={{ ...s.tdr, color:dayCol, fontWeight:700 }}>{l.daysInStage}</td>
                          <td style={s.td}>{l.owner}</td>
                          <td style={{ ...s.td, color:MUTED }}>{fmtDate(l.lastActivity)}</td>
                          <td style={s.td}>
                            <a href={`https://app-eu1.hubspot.com/contacts/${PORTAL}/contact/${l.id}`} target="_blank" rel="noreferrer" style={{ color:BLUE, fontWeight:600, textDecoration:"none", fontSize:12 }}>Open ↗</a>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredStuck.length === 0 && (
                      <tr><td colSpan={9} style={{ ...s.td, textAlign:"center" as const, color:MUTED }}>No stuck contacts</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
              )
            })()}

            {/* §11 Nurture Candidates */}
            <Lbl>Nurture Candidates · Journey Stage — In Nurturing</Lbl>
            <div style={s.tcard}>
              <div style={s.tcardH}>
                <span style={s.tcardT}>Nurture Candidates</span>
                <span style={s.tcardS}>{data.nurtureCandidates?.length || 0} contacts · Journey Stage: In Nurturing</span>
              </div>
              <div style={{ overflowX:"auto", maxHeight:440, overflow:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>
                    <th style={s.th}>#</th>
                    <th style={s.th}>Name</th>
                    <th style={s.th}>Email</th>
                    <th style={s.th}>Lifecycle Stage</th>
                    <th style={s.th}>Lead Status</th>
                    <th style={s.th}>Journey Stage</th>
                    <th style={s.th}>Owner</th>
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
                        <td style={{ ...s.td, color:MUTED }}>{c.leadStatus || "—"}</td>
                        <td style={{ ...s.td, color:TEAL, fontWeight:600 }}>{c.journeyStage || "—"}</td>
                        <td style={s.td}>{c.owner}</td>
                        <td style={{ ...s.td, color:MUTED }}>{fmtDate(c.lastContacted)}</td>
                        <td style={s.td}>
                          <a href={`https://app-eu1.hubspot.com/contacts/${PORTAL}/contact/${c.id}`} target="_blank" rel="noreferrer" style={{ color:BLUE, fontWeight:600, textDecoration:"none", fontSize:12 }}>Open ↗</a>
                        </td>
                      </tr>
                    ))}
                    {(data.nurtureCandidates || []).length === 0 && (
                      <tr><td colSpan={9} style={{ ...s.td, textAlign:"center" as const, color:MUTED }}>No contacts in Journey Stage "In Nurturing"</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
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

          {/* ══ TAB 2 — Contact Quality ════════════════════════════════ */}
          {tab === 2 && (<>
            <Lbl>Contact Scoring Distribution</Lbl>
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
