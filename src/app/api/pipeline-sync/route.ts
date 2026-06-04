import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

const BASE = "https://api-eu1.hubspot.com"
const KEY  = process.env.HUBSPOT_API_KEY!
const UPSTASH_URL   = process.env.KV_REST_API_URL   ?? process.env.UPSTASH_REST_API_URL
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REST_API_TOKEN
const CACHE_KEY = "vk-pipeline-data"

let memCache: unknown = null

async function writeCache(data: unknown) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) { memCache = data; return }
  await fetch(`${UPSTASH_URL}/set/${CACHE_KEY}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(JSON.stringify(data)),
    cache: "no-store",
  })
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const TEST_DOMAINS = ["vaekstnet.com","vaekstkapital.com","vaekstkapital.dk","mailinator.com","yopmail.com","example.com"]
function isTestContact(email: string) {
  if (!email) return true
  return TEST_DOMAINS.includes(email.split("@")[1]?.toLowerCase())
}

function median(arr: number[]): number {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return Math.round(sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2)
}

async function hsGet(path: string, attempt = 0): Promise<any> {
  await sleep(150)
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" })
  if (res.status === 429 && attempt < 5) { await sleep(2000 * (attempt + 1)); return hsGet(path, attempt + 1) }
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json()
}

async function hsPost(path: string, body: object, attempt = 0): Promise<any> {
  await sleep(150)
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  if (res.status === 429 && attempt < 5) { await sleep(2000 * (attempt + 1)); return hsPost(path, body, attempt + 1) }
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`)
  return res.json()
}

async function getAllContacts(properties: string[]): Promise<any[]> {
  const results: any[] = []
  let after: string | undefined
  const propsParam = properties.join(",")
  do {
    let path = `/crm/v3/objects/contacts?limit=100&properties=${propsParam}`
    if (after) path += `&after=${after}`
    const data = await hsGet(path)
    results.push(...(data.results || []).map((r: any) => ({ ...r.properties, _id: r.id })))
    after = data.paging?.next?.after
  } while (after)
  return results
}

async function getLifecycleHistory(ids: string[]): Promise<Record<string, any[]>> {
  const result: Record<string, any[]> = {}
  for (let i = 0; i < ids.length; i += 100) {
    await sleep(200)
    try {
      const data = await hsPost("/crm/v3/objects/contacts/batch/read", {
        inputs: ids.slice(i, i + 100).map(id => ({ id })),
        properties: ["lifecyclestage"],
        propertiesWithHistory: ["lifecyclestage"],
      })
      for (const c of data.results || []) {
        result[c.id] = (c.propertiesWithHistory?.lifecyclestage || [])
          .filter((h: any) => h.timestamp)
          .map((h: any) => ({ value: h.value, ts: new Date(h.timestamp) }))
          .sort((a: any, b: any) => a.ts - b.ts)
      }
    } catch { /* skip batch */ }
  }
  return result
}

async function getOwners(): Promise<Record<string, string>> {
  const data = await hsGet("/crm/v3/owners?limit=100")
  const map: Record<string, string> = {}
  for (const o of data.results ?? []) {
    map[String(o.id)] = [o.firstName, o.lastName].filter(Boolean).join(" ")
  }
  return map
}

async function getDealStageNames(): Promise<Record<string, string>> {
  try {
    const data = await hsGet("/crm/v3/pipelines/deals")
    const map: Record<string, string> = {}
    for (const pipeline of data.results || []) {
      for (const stage of pipeline.stages || []) {
        map[stage.id] = stage.label
      }
    }
    return map
  } catch { return {} }
}

// Fetch all lifecycle stage options from HubSpot to handle custom stages
async function getLifecycleStageLabels(): Promise<Record<string, string>> {
  try {
    const data = await hsGet("/crm/v3/properties/contacts/lifecyclestage")
    const map: Record<string, string> = {}
    for (const opt of (data.options || [])) {
      if (opt.value) map[opt.value] = opt.label || opt.value
    }
    return map
  } catch { return {} }
}

async function fetchAllDeals(props: string[]): Promise<any[]> {
  const results: any[] = []
  let after: string | undefined
  const propsParam = props.join(",")
  do {
    let path = `/crm/v3/objects/deals?limit=100&properties=${propsParam}`
    if (after) path += `&after=${after}`
    const data = await hsGet(path)
    results.push(...(data.results || []).map((r: any) => ({ ...r.properties, _id: r.id })))
    after = data.paging?.next?.after
  } while (after)
  return results
}

async function fetchActivitiesByOwner(sinceMs: number): Promise<Record<string, { calls: number; emails: number; meetings: number }>> {
  const result: Record<string, { calls: number; emails: number; meetings: number }> = {}
  const sinceISO = new Date(sinceMs).toISOString()
  for (const type of ["calls", "emails", "meetings"] as const) {
    let after: string | undefined
    do {
      await sleep(200)
      try {
        const body: any = {
          filterGroups: [{ filters: [{ propertyName: "hs_createdate", operator: "GTE", value: sinceISO }] }],
          properties: ["hubspot_owner_id"],
          limit: 100,
        }
        if (after) body.after = after
        const data = await hsPost(`/crm/v3/objects/${type}/search`, body)
        for (const r of data.results || []) {
          const ownerId = r.properties?.hubspot_owner_id
          if (!ownerId) continue
          if (!result[ownerId]) result[ownerId] = { calls: 0, emails: 0, meetings: 0 }
          result[ownerId][type]++
        }
        after = data.paging?.next?.after
      } catch { after = undefined; break }
    } while (after)
  }
  return result
}

// Known lifecycle stages in display order.
const LIFECYCLE_STAGES = [
  { id: "lead",                   label: "Lead" },
  { id: "marketingqualifiedlead", label: "MQL Cold" },
  { id: "770940371",              label: "MQL Hot" },
  { id: "salesqualifiedlead",     label: "SQL" },
  { id: "opportunity",            label: "Opportunity / Potential Investor" },
  { id: "customer",               label: "Customer / Existing Investor" },
  { id: "1874186475",             label: "Disqualified" },
  { id: "jobapplicant",           label: "Job Applicant" },
  { id: "other",                  label: "Other" },
]

// Ordered stage IDs used in the activation funnel (Lead → Customer progression)
const FUNNEL_STAGE_ORDER = [
  "lead", "marketingqualifiedlead", "770940371", "salesqualifiedlead", "opportunity", "customer",
]

// Lead Status values in display order
const LEAD_STATUS_ORDER = [
  "Canvas", "Attempting", "Connected", "Meeting",
  "Potential Investor", "Existing Investor", "Nurture", "Grade E", "Grade F",
]

const stageDateProps: Record<string, string> = {
  lead: "hs_lifecyclestage_lead_date",
  marketingqualifiedlead: "hs_lifecyclestage_marketingqualifiedlead_date",
  salesqualifiedlead: "hs_lifecyclestage_salesqualifiedlead_date",
  opportunity: "hs_lifecyclestage_opportunity_date",
  customer: "hs_lifecyclestage_customer_date",
}

async function fetchPipelineData() {
  const owners = await getOwners()

  const knownLabelMap: Record<string, string> = Object.fromEntries(LIFECYCLE_STAGES.map(s => [s.id, s.label]))
  function stageLabel(id: string): string {
    return knownLabelMap[id] || id
  }

  const allContacts = await getAllContacts([
    "email","firstname","lastname","lifecyclestage","hs_lead_status",
    "createdate","hs_last_sales_activity_timestamp","hubspot_owner_id","endavu_deal_id","phone","company",
    "hubspotscore","hs_lead_source","global_grade","notes_last_contacted",
  ])
  const contacts = allContacts.filter(c => !isTestContact(c.email || "") && !c.endavu_deal_id)

  // ── Stage counts (all stages including dynamic) ──
  const stageCounts: Record<string, number> = {}
  for (const c of contacts) {
    if (c.lifecyclestage) stageCounts[c.lifecyclestage] = (stageCounts[c.lifecyclestage] || 0) + 1
  }

  // ── Ordered stage counts list for donut chart ──
  // Only show the 9 canonical lifecycle stages; roll unknown IDs into "Other"
  const knownIds = new Set(LIFECYCLE_STAGES.map(s => s.id))
  const unknownCount = Object.entries(stageCounts)
    .filter(([id]) => !knownIds.has(id))
    .reduce((sum, [, n]) => sum + n, 0)
  const stageCountsList = LIFECYCLE_STAGES.map(s => ({
    id: s.id,
    label: s.label,
    count: (stageCounts[s.id] || 0) + (s.id === "other" ? unknownCount : 0),
  }))

  // ── Lifecycle history (for transition timing) ──
  const advancedIds = contacts
    .filter(c => ["opportunity","customer","salesqualifiedlead"].includes(c.lifecyclestage))
    .map(c => c._id)
  const lifecycleHistory = await getLifecycleHistory(advancedIds)

  // ── Transition durations ──
  const transitionDurations: Record<string, number[]> = {
    "Lead → MQL Cold": [],
    "MQL Cold → MQL Hot": [],
    "MQL Hot → SQL": [],
    "SQL → Opportunity": [],
    "Opportunity → Customer": [],
    "Lead → Customer (total)": [],
  }
  for (const history of Object.values(lifecycleHistory)) {
    if (!history?.length) continue
    const stageTimes: Record<string, Date> = {}
    for (const e of history as any[]) if (e.value && e.ts && !stageTimes[e.value]) stageTimes[e.value] = e.ts
    const get = (id: string) => stageTimes[id] ?? null
    const pairs = [
      { key: "Lead → MQL Cold",    from: "lead",                   to: "marketingqualifiedlead" },
      { key: "MQL Cold → MQL Hot", from: "marketingqualifiedlead", to: "770940371" },
      { key: "MQL Hot → SQL",      from: "770940371",              to: "salesqualifiedlead" },
      { key: "SQL → Opportunity",  from: "salesqualifiedlead",     to: "opportunity" },
      { key: "Opportunity → Customer", from: "opportunity",        to: "customer" },
    ]
    for (const p of pairs) {
      const from = get(p.from); const to = get(p.to)
      if (from && to && to > from) { const d = (to.getTime() - from.getTime()) / 86400000; if (d < 1825) transitionDurations[p.key].push(d) }
    }
    const l = get("lead"); const k = get("customer")
    if (l && k && k > l) { const d = (k.getTime() - l.getTime()) / 86400000; if (d < 1825) transitionDurations["Lead → Customer (total)"].push(d) }
  }

  const avgDaysPerTransition: Record<string, { avg: number; median: number; count: number }> = {}
  for (const [key, durations] of Object.entries(transitionDurations)) {
    avgDaysPerTransition[key] = {
      avg: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      median: median(durations), count: durations.length,
    }
  }

  // ── Time in current stage ──
  const now = Date.now()
  const avgDaysInCurrentStage: Record<string, { label: string; avg: number; median: number; count: number; dataSource: string }> = {}
  for (const stage of LIFECYCLE_STAGES) {
    if (stage.id === "1874186475") continue // skip Disqualified
    const inStage = contacts.filter(c => c.lifecyclestage === stage.id)
    if (!inStage.length) continue
    const isCustom = !stageDateProps[stage.id]
    let days: number[]
    let dataSource: string
    if (isCustom) {
      days = inStage.map(c => { const ref = c.hs_last_sales_activity_timestamp || c.createdate; return ref ? (now - new Date(ref).getTime()) / 86400000 : 0 }).filter(d => d > 0)
      dataSource = "last_activity_approx"
    } else {
      const fromHist: number[] = []; const fromFall: number[] = []
      for (const c of inStage) {
        const hist = lifecycleHistory[c._id] as any[]
        if (hist) {
          const entries = hist.filter((h: any) => h.value === stage.id)
          if (entries.length) { const d = (now - new Date(entries[entries.length - 1].ts).getTime()) / 86400000; if (d > 0 && d < 3650) { fromHist.push(d); continue } }
        }
        if (c.createdate) { const d = (now - new Date(c.createdate).getTime()) / 86400000; if (d > 0) fromFall.push(d) }
      }
      days = [...fromHist, ...fromFall]
      dataSource = fromHist.length > fromFall.length ? "property_history" : "createdate_approx"
    }
    avgDaysInCurrentStage[stage.id] = {
      label: stage.label,
      avg: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0,
      median: median(days), count: days.length, dataSource,
    }
  }

  // ── Activation Funnel (cumulative: contacts at stage OR later) ──
  const funnelData = FUNNEL_STAGE_ORDER.map(id => ({
    stage: stageLabel(id),
    count: contacts.filter(c => FUNNEL_STAGE_ORDER.indexOf(c.lifecyclestage) >= FUNNEL_STAGE_ORDER.indexOf(id)).length,
  }))

  // ── Stuck contacts (30+ days no sales activity, excl. Customer / Disqualified) ──
  const stuckLeads = contacts
    .filter(c => {
      const s = c.lifecyclestage
      if (!s || s === "customer" || s === "1874186475") return false
      const ref = c.hs_last_sales_activity_timestamp || c.createdate
      if (!ref) return false
      const d = (now - new Date(ref).getTime()) / 86400000
      return d > 30 && d < 1825
    })
    .map(c => {
      const ref = c.hs_last_sales_activity_timestamp || c.createdate
      return {
        id: c._id,
        name: [c.firstname, c.lastname].filter(Boolean).join(" ") || c.email,
        email: c.email,
        company: c.company || "",
        stage: stageLabel(c.lifecyclestage),
        daysInStage: ref ? Math.round((now - new Date(ref).getTime()) / 86400000) : null,
        owner: owners[c.hubspot_owner_id] || "Unknown",
        lastActivity: c.hs_last_sales_activity_timestamp || null,
      }
    })
    .sort((a, b) => (b.daysInStage || 0) - (a.daysInStage || 0))

  // ── Stuck per owner ──
  const stuckOwnerMap: Record<string, number> = {}
  for (const l of stuckLeads) {
    stuckOwnerMap[l.owner] = (stuckOwnerMap[l.owner] || 0) + 1
  }
  const stuckPerOwner = Object.entries(stuckOwnerMap)
    .map(([owner, stuck]) => ({ owner, stuck }))
    .sort((a, b) => b.stuck - a.stuck)

  // ── Nurture candidates: 180+ days no activity, excl. Nurture/Existing Investor/Grade E-F/Customer/Disqualified ──
  const EXCLUDE_STATUSES = new Set(["nurture","existing investor","grade e","grade f"])
  const nurtureCandidates = contacts
    .filter(c => {
      const ref = c.hs_last_sales_activity_timestamp || c.createdate
      if (!ref) return false
      if ((now - new Date(ref).getTime()) / 86400000 < 180) return false
      const ls = c.lifecyclestage
      if (ls === "customer" || ls === "1874186475") return false
      const status = (c.hs_lead_status || "").toLowerCase().trim()
      if (EXCLUDE_STATUSES.has(status)) return false
      return true
    })
    .map(c => ({
      id: c._id,
      name: [c.firstname, c.lastname].filter(Boolean).join(" ") || c.email,
      email: c.email,
      stage: stageLabel(c.lifecyclestage) || "—",
      lastContacted: c.notes_last_contacted || c.hs_last_sales_activity_timestamp || null,
      owner: owners[c.hubspot_owner_id] || "Unknown",
    }))
    .sort((a, b) => {
      // Sort by lastContacted ascending (longest ago first)
      if (!a.lastContacted) return -1
      if (!b.lastContacted) return 1
      return new Date(a.lastContacted).getTime() - new Date(b.lastContacted).getTime()
    })

  // ── Lead Status Distribution ──
  const statusCountMap: Record<string, number> = {}
  for (const c of contacts) {
    if (c.hs_lead_status) {
      statusCountMap[c.hs_lead_status] = (statusCountMap[c.hs_lead_status] || 0) + 1
    }
  }
  // Match case-insensitively against the canonical order
  const normStatus = (s: string) => s.trim().toLowerCase()
  const leadStatusDistribution = LEAD_STATUS_ORDER.map(status => {
    const count = Object.entries(statusCountMap)
      .filter(([k]) => normStatus(k) === normStatus(status))
      .reduce((sum, [, v]) => sum + v, 0)
    return { status, count }
  })

  // ── Stage vs Status cross-table ──
  const stageStatusMatrix = LIFECYCLE_STAGES
    .filter(s => s.id !== "other") // keep matrix focused on main stages
    .map(stage => {
      const row: Record<string, any> = { stage: stage.label }
      for (const status of LEAD_STATUS_ORDER) {
        row[status] = contacts.filter(c =>
          c.lifecyclestage === stage.id &&
          normStatus(c.hs_lead_status || "") === normStatus(status)
        ).length
      }
      // Total contacts in this stage (all statuses)
      row["_total"] = contacts.filter(c => c.lifecyclestage === stage.id).length
      return row
    })
    .filter(row => row["_total"] > 0)

  // ── By owner (split MQL Cold / MQL Hot) ──
  const ownerMap: Record<string, { name: string; lead: number; mqlCold: number; mqlHot: number; sql: number; opportunity: number; customer: number }> = {}
  for (const c of contacts) {
    const n = owners[c.hubspot_owner_id] || "Unknown"
    if (!ownerMap[n]) ownerMap[n] = { name: n, lead: 0, mqlCold: 0, mqlHot: 0, sql: 0, opportunity: 0, customer: 0 }
    const s = c.lifecyclestage
    if (s === "lead") ownerMap[n].lead++
    else if (s === "marketingqualifiedlead") ownerMap[n].mqlCold++
    else if (s === "770940371") ownerMap[n].mqlHot++
    else if (s === "salesqualifiedlead") ownerMap[n].sql++
    else if (s === "opportunity") ownerMap[n].opportunity++
    else if (s === "customer") ownerMap[n].customer++
  }
  const byOwner = Object.values(ownerMap).sort((a, b) => (b.customer + b.opportunity) - (a.customer + a.opportunity))

  // ── Monthly created ──
  const monthlyMap: Record<string, number> = {}
  for (const c of contacts) { if (c.createdate) { const m = c.createdate.slice(0, 7); monthlyMap[m] = (monthlyMap[m] || 0) + 1 } }
  const byMonth = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).slice(-18).map(([month, count]) => ({ month, count }))

  // ── Lead quality ──
  const scoreDistribution = [
    { bucket: "0–14",   min: 0,  max: 15 },
    { bucket: "15–39",  min: 15, max: 40 },
    { bucket: "40–59",  min: 40, max: 60 },
    { bucket: "60–100", min: 60, max: 10000 },
  ].map(b => ({
    bucket: b.bucket,
    count: contacts.filter(c => { const s = parseFloat(c.hubspotscore); return !isNaN(s) && s >= b.min && s < b.max }).length,
  }))

  const scoreByStage = LIFECYCLE_STAGES.filter(s => s.id !== "1874186475").map(s => {
    const scores = contacts.filter(c => c.lifecyclestage === s.id && c.hubspotscore).map(c => parseFloat(c.hubspotscore)).filter(n => !isNaN(n))
    return { stage: s.label, avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0, count: scores.length }
  })

  const gradeMap: Record<string, number> = {}
  for (const c of contacts) { const g = (c.global_grade || "Unknown").toUpperCase(); gradeMap[g] = (gradeMap[g] || 0) + 1 }
  const gradeDistribution = Object.entries(gradeMap).sort(([a], [b]) => a.localeCompare(b)).map(([grade, count]) => ({ grade, count }))

  const topScoring = contacts
    .filter(c => c.hubspotscore && parseFloat(c.hubspotscore) > 0)
    .sort((a, b) => parseFloat(b.hubspotscore) - parseFloat(a.hubspotscore))
    .slice(0, 50)
    .map(c => ({
      id: c._id,
      name: [c.firstname, c.lastname].filter(Boolean).join(" ") || c.email || "Unknown",
      email: c.email || "",
      score: Math.round(parseFloat(c.hubspotscore)),
      stage: stageLabel(c.lifecyclestage) || "—",
      status: c.hs_lead_status || "—",
      owner: owners[c.hubspot_owner_id] || "—",
      lastContacted: c.notes_last_contacted || c.hs_last_sales_activity_timestamp || null,
    }))

  const sourceMap: Record<string, { total: number; customers: number }> = {}
  for (const c of contacts) {
    const src = c.hs_lead_source || "Unknown"
    if (!sourceMap[src]) sourceMap[src] = { total: 0, customers: 0 }
    sourceMap[src].total++
    if (c.lifecyclestage === "customer") sourceMap[src].customers++
  }
  const conversionBySource = Object.entries(sourceMap)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([source, { total, customers }]) => ({ source, total, customers, pct: total > 0 ? Math.round((customers / total) * 100) : 0 }))
    .slice(0, 15)

  const leadQuality = { scoreDistribution, scoreByStage, gradeDistribution, topScoring, conversionBySource }

  // ── Reinvestering ──
  const customers = contacts.filter(c => c.lifecyclestage === "customer")
  let reinvestering = { medianDays: 0, avgDays: 0, reinvestRate: 0, totalCustomers: customers.length, reinvestedCount: 0, within90days: 0, within180days: 0 }
  try {
    const WON_STAGES = ["497565675","503960545","517811422","766320087","4500113624","4643302624"]
    const allWonDeals: any[] = []
    for (const stageId of WON_STAGES) {
      let after: string | undefined
      do {
        const body: any = { filterGroups: [{ filters: [{ propertyName: "dealstage", operator: "EQ", value: stageId }] }], properties: ["closedate","amount"], limit: 200 }
        if (after) body.after = after
        const data = await hsPost("/crm/v3/objects/deals/search", body)
        allWonDeals.push(...(data.results || [])); after = data.paging?.next?.after
      } while (after)
      await sleep(300)
    }
    const dealIds = allWonDeals.map(d => d.id)
    const contactDealDates: Record<string, Date[]> = {}
    for (let i = 0; i < dealIds.length; i += 100) {
      await sleep(200)
      try {
        const assocData = await hsPost("/crm/v4/associations/deals/contacts/batch/read", { inputs: dealIds.slice(i, i + 100).map(id => ({ id })) })
        for (const r of assocData.results || []) {
          const deal = allWonDeals.find(d => d.id === r.from?.id)
          if (!deal?.properties?.closedate) continue
          const cd = new Date(deal.properties.closedate)
          for (const a of r.to || []) { const cid = String(a.toObjectId || a.id); if (!contactDealDates[cid]) contactDealDates[cid] = []; contactDealDates[cid].push(cd) }
        }
      } catch { /* skip */ }
    }
    const daysToReinvest: number[] = []; let w90 = 0, w180 = 0
    for (const dates of Object.values(contactDealDates)) {
      if (dates.length < 2) continue
      const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
      const d = (sorted[1].getTime() - sorted[0].getTime()) / 86400000
      if (d >= 30 && d < 1825) { daysToReinvest.push(d); if (d <= 90) w90++; if (d <= 180) w180++ }
    }
    const count = daysToReinvest.length
    reinvestering = {
      medianDays: median(daysToReinvest), avgDays: count ? Math.round(daysToReinvest.reduce((a, b) => a + b, 0) / count) : 0,
      reinvestRate: customers.length ? Math.round((count / customers.length) * 100) : 0,
      totalCustomers: customers.length, reinvestedCount: count, within90days: w90, within180days: w180,
    }
  } catch { /* skip */ }

  // ── Deal stats ──
  let dealStats = {
    totalPipeline: 0, closedWon: 0, avgDealSize: 0, winRate: 0, totalDeals: 0, closedWonCount: 0,
    byStage: [] as Array<{ stage: string; count: number; value: number }>,
    byMonth: [] as Array<{ month: string; created: number; closedWon: number }>,
    topPerformers: [] as Array<{ owner: string; created: number; closed: number; revenue: number; avgDays: number }>,
  }
  try {
    const [stageNames, allDeals] = await Promise.all([
      getDealStageNames(),
      fetchAllDeals(["amount","dealstage","pipeline","closedate","createdate","hubspot_owner_id"]),
    ])
    const WON_IDS = new Set(["closedwon","497565675","503960545","517811422","766320087","4500113624","4643302624"])
    const LOST_IDS = new Set(["closedlost","497565676","503960546","517811423","766320088","4500113625","4643302625"])
    const openDeals = allDeals.filter(d => !WON_IDS.has(d.dealstage) && !LOST_IDS.has(d.dealstage) && d.amount)
    const wonDeals  = allDeals.filter(d => WON_IDS.has(d.dealstage))
    dealStats.totalPipeline  = openDeals.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)
    dealStats.closedWon      = wonDeals.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)
    dealStats.totalDeals     = allDeals.length
    dealStats.closedWonCount = wonDeals.length
    dealStats.winRate        = allDeals.length > 0 ? Math.round((wonDeals.length / allDeals.length) * 100) : 0
    dealStats.avgDealSize    = wonDeals.length > 0 ? Math.round(dealStats.closedWon / wonDeals.length) : 0
    const stageGroup: Record<string, { count: number; value: number }> = {}
    for (const d of allDeals) {
      const sn = stageNames[d.dealstage] || d.dealstage || "Unknown"
      if (!stageGroup[sn]) stageGroup[sn] = { count: 0, value: 0 }
      stageGroup[sn].count++; stageGroup[sn].value += parseFloat(d.amount) || 0
    }
    dealStats.byStage = Object.entries(stageGroup).map(([stage, { count, value }]) => ({ stage, count, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 10)
    const nowD = new Date()
    const months18: string[] = []
    for (let i = 17; i >= 0; i--) { const d = new Date(nowD.getFullYear(), nowD.getMonth() - i, 1); months18.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`) }
    dealStats.byMonth = months18.map(m => ({ month: m, created: allDeals.filter(d => d.createdate?.slice(0, 7) === m).length, closedWon: wonDeals.filter(d => d.closedate?.slice(0, 7) === m).length }))
    const perfMap: Record<string, { owner: string; created: number; closed: number; revenue: number; durations: number[] }> = {}
    for (const d of allDeals) {
      const ownerName = owners[d.hubspot_owner_id] || "Unknown"
      if (!perfMap[ownerName]) perfMap[ownerName] = { owner: ownerName, created: 0, closed: 0, revenue: 0, durations: [] }
      perfMap[ownerName].created++
      if (WON_IDS.has(d.dealstage)) {
        perfMap[ownerName].closed++; perfMap[ownerName].revenue += parseFloat(d.amount) || 0
        if (d.createdate && d.closedate) { const dur = (new Date(d.closedate).getTime() - new Date(d.createdate).getTime()) / 86400000; if (dur > 0 && dur < 1825) perfMap[ownerName].durations.push(dur) }
      }
    }
    dealStats.topPerformers = Object.values(perfMap).map(p => ({ owner: p.owner, created: p.created, closed: p.closed, revenue: Math.round(p.revenue), avgDays: p.durations.length ? Math.round(p.durations.reduce((a, b) => a + b, 0) / p.durations.length) : 0 })).sort((a, b) => b.revenue - a.revenue)
  } catch (e) { console.error("Deal stats error:", e) }

  // ── Activity (last 30 days) ──
  let activityByOwner: Array<{ owner: string; calls: number; emails: number; meetings: number; total: number }> = []
  try {
    const raw = await fetchActivitiesByOwner(now - 30 * 86400000)
    activityByOwner = Object.entries(raw).map(([ownerId, counts]) => ({
      owner: owners[ownerId] || ownerId, ...counts, total: counts.calls + counts.emails + counts.meetings,
    })).sort((a, b) => b.total - a.total)
  } catch (e) { console.error("Activity error:", e) }

  return {
    fetchedAt: new Date().toISOString(),
    totalContacts: contacts.length,
    stageCounts,
    stageCountsList,
    avgDaysPerTransition,
    avgDaysInCurrentStage,
    funnelData,
    stuckLeads,
    stuckPerOwner,
    nurtureCandidates,
    leadStatusDistribution,
    stageStatusMatrix,
    leadStatusCols: LEAD_STATUS_ORDER,
    byOwner,
    byMonth,
    reinvestering,
    leadQuality,
    dealStats,
    activityByOwner,
  }
}

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const data = await fetchPipelineData()
    await writeCache(data)
    return NextResponse.json({ ok: true, fetchedAt: data.fetchedAt, contacts: data.totalContacts })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
