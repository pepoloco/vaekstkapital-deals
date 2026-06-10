import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

const BASE = "https://api-eu1.hubspot.com"
const KEY  = process.env.HUBSPOT_API_KEY!
const UPSTASH_URL   = process.env.KV_REST_API_URL   ?? process.env.UPSTASH_REST_API_URL
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REST_API_TOKEN
const CACHE_KEY = "vk-pipeline-data"

// Brand IDs for hs_all_assigned_business_unit_ids property
const BRAND_IDS: Record<string, { id: string; label: string }> = {
  dk:   { id: "0",        label: "Vaekstkapital DK (Denmark)" },
  se:   { id: "17424990", label: "Vaekstkapital SE (Sweden)" },
  ship: { id: "17893427", label: "Vaekstkapital Shipping" },
  at:   { id: "18387361", label: "Vaekstkapital AT (Austria)" },
  fi:   { id: "17065112", label: "Vaekstkapital FI (Finland)" },
  no:   { id: "17435297", label: "Vaekstkapital NO (Norway)" },
}

let memCache: Record<string, unknown> = {}

async function writeCache(key: string, data: unknown) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) { memCache[key] = data; return }
  await fetch(`${UPSTASH_URL}/set/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(JSON.stringify(data)),
    cache: "no-store",
  })
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const TEST_DOMAINS = ["vaekstnet.com","vaekstkapital.com","vaekstkapital.dk","mailinator.com","yopmail.com","example.com"]
function isTestContact(email: string) {
  if (!email) return false
  return TEST_DOMAINS.includes(email.split("@")[1]?.toLowerCase())
}

function median(arr: number[]): number {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return Math.round(sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2)
}

async function hsGet(path: string, attempt = 0): Promise<any> {
  await sleep(80)
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" })
  if (res.status === 429 && attempt < 5) { await sleep(2000 * (attempt + 1)); return hsGet(path, attempt + 1) }
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json()
}

async function hsPost(path: string, body: object, attempt = 0): Promise<any> {
  await sleep(80)
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
    let path = `/crm/v3/objects/contacts?limit=200&properties=${propsParam}`
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
    await sleep(100)
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

async function getOwners(): Promise<{ names: Record<string, string>; userIdToOwnerId: Record<string, string> }> {
  const data = await hsGet("/crm/v3/owners?limit=100")
  const names: Record<string, string> = {}
  const userIdToOwnerId: Record<string, string> = {}
  for (const o of data.results ?? []) {
    names[String(o.id)] = [o.firstName, o.lastName].filter(Boolean).join(" ")
    if (o.userId) userIdToOwnerId[String(o.userId)] = String(o.id)
  }
  return { names, userIdToOwnerId }
}

// Returns: brandId -> { ownerIds, ownerNames } for team members (parent + all sub-teams)
async function getTeamOwnerIds(
  userIdToOwnerId: Record<string, string>,
  owners: Record<string, string>
): Promise<{ teamOwnerIds: Record<string, string[]>; teamOwnerNames: Record<string, string[]> }> {
  const TEAM_PATTERNS: Array<{ prefix: string; brandId: string }> = [
    { prefix: "team denmark",  brandId: "0" },
    { prefix: "bu dk",         brandId: "0" },
    { prefix: "team sweden",   brandId: "17424990" },
    { prefix: "bu se",         brandId: "17424990" },
    { prefix: "team shipping", brandId: "17893427" },
    { prefix: "bu ship",       brandId: "17893427" },
    { prefix: "team austria",  brandId: "18387361" },
    { prefix: "bu at",         brandId: "18387361" },
    { prefix: "team finland",  brandId: "17065112" },
    { prefix: "bu fi",         brandId: "17065112" },
    { prefix: "team norway",   brandId: "17435297" },
    { prefix: "bu no",         brandId: "17435297" },
  ]
  const resultIds: Record<string, Set<string>> = {}
  const resultNames: Record<string, Set<string>> = {}
  try {
    const data = await hsGet("/settings/v3/users/teams?includeMembers=true")
    console.log(`[sync] Teams API: ${data.results?.length ?? 0} teams found`)
    for (const team of data.results ?? []) {
      const key = (team.name || "").toLowerCase()
      const match = TEAM_PATTERNS.find(p => key.startsWith(p.prefix))
      if (!match) continue
      if (!resultIds[match.brandId]) { resultIds[match.brandId] = new Set(); resultNames[match.brandId] = new Set() }
      const userIds: string[] = team.userIds ?? team.memberUserIds ?? []
      let mapped = 0
      for (const userId of userIds) {
        const ownerId = userIdToOwnerId[String(userId)]
        if (ownerId) {
          resultIds[match.brandId].add(ownerId)
          const name = owners[ownerId]
          if (name) resultNames[match.brandId].add(name)
          mapped++
        }
      }
      console.log(`[sync]   "${team.name}" → brandId=${match.brandId}, members=${userIds.length}, mapped to owners=${mapped}`)
    }
  } catch (e) { console.error("[sync] getTeamOwnerIds error:", e) }
  const teamOwnerIds = Object.fromEntries(Object.entries(resultIds).map(([k, v]) => [k, Array.from(v)]))
  const teamOwnerNames = Object.fromEntries(Object.entries(resultNames).map(([k, v]) => [k, Array.from(v)]))
  console.log(`[sync] Team summary: ${Object.keys(teamOwnerIds).map(k => k + ":" + (teamOwnerIds[k].length) + " owners").join(", ")}`)
  return { teamOwnerIds, teamOwnerNames }
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

// Canonical lifecycle stages — IDs verified against HubSpot property settings.
// "Attempted / Connected" (773079518) exists in HubSpot but is excluded from the
// main funnel/donut; contacts with that stage are counted under "Other".
const LIFECYCLE_STAGES = [
  { id: "lead",                   label: "Lead" },
  { id: "marketingqualifiedlead", label: "MQL Cold" },
  { id: "770940371",              label: "MQL Hot" },
  { id: "salesqualifiedlead",     label: "SQL" },
  { id: "opportunity",            label: "Opportunity / Potential Investor" },
  { id: "customer",               label: "Customer / Existing Investor" },
  { id: "evangelist",             label: "Evangelist" },
  { id: "1874186475",             label: "Disqualified" },
  { id: "3529709812",             label: "Job Applicant" },
  { id: "other",                  label: "Other" },
]

// Extra stage IDs that exist in HubSpot but are not shown in the main funnel/donut.
// Their contacts are counted under "Other" and labeled correctly elsewhere (e.g. stuck table).
const EXTRA_STAGE_LABELS: Record<string, string> = {
  "773079518": "Attempted / Connected",
}

// Ordered stage IDs used in the activation funnel (Lead → Customer progression)
const FUNNEL_STAGE_ORDER = [
  "lead", "marketingqualifiedlead", "770940371", "salesqualifiedlead", "opportunity", "customer",
]

// Actual hs_lead_status values from HubSpot (stored as uppercase keys)
const LEAD_STATUS_OPTIONS = [
  { value: "NEW",                  label: "New" },
  { value: "OPEN",                 label: "Open" },
  { value: "IN_PROGRESS",         label: "In Progress" },
  { value: "OPEN_DEAL",            label: "Open Deal" },
  { value: "UNQUALIFIED",          label: "Unqualified" },
  { value: "ATTEMPTED_TO_CONTACT", label: "Attempted to Contact" },
  { value: "CONNECTED",            label: "Connected" },
  { value: "BAD_TIMING",           label: "Bad Timing" },
]
const LEAD_STATUS_ORDER = LEAD_STATUS_OPTIONS.map(o => o.value)
const LEAD_STATUS_LABELS: Record<string, string> = Object.fromEntries(LEAD_STATUS_OPTIONS.map(o => [o.value, o.label]))


// ── Reusable contact metrics computation (called for global AND per-brand) ──────
function computeContactMetrics(
  contacts: any[],
  owners: Record<string, string>,
  knownLabelMap: Record<string, string>,
  lifecycleHistory: Record<string, any[]>,
  now: number,
) {
  const stageLabel = (id: string) => knownLabelMap[id] || id
  const normStatus = (s: string) => s.trim().toLowerCase()

  // Stage counts
  const stageCounts: Record<string, number> = {}
  for (const c of contacts) if (c.lifecyclestage) stageCounts[c.lifecyclestage] = (stageCounts[c.lifecyclestage] || 0) + 1

  // Stage counts list for donut (roll unknowns into Other)
  const knownIds = new Set(LIFECYCLE_STAGES.map(s => s.id))
  const unknownCount = Object.entries(stageCounts).filter(([id]) => !knownIds.has(id)).reduce((sum, [, n]) => sum + n, 0)
  const stageCountsList = LIFECYCLE_STAGES.map(s => ({
    id: s.id, label: s.label,
    count: (stageCounts[s.id] || 0) + (s.id === "other" ? unknownCount : 0),
  }))

  // Transition durations (date props + history for MQL Hot)
  const transitionDurations: Record<string, number[]> = {
    "Lead → MQL Cold": [], "MQL Cold → MQL Hot": [], "MQL Hot → SQL": [],
    "SQL → Opportunity": [], "Opportunity → Customer": [], "Lead → Customer (total)": [],
  }
  const pushDur = (arr: number[], fromMs: number | null, toMs: number | null) => {
    if (fromMs && toMs && toMs > fromMs) { const d = (toMs - fromMs) / 86400000; if (d > 0 && d < 1825) arr.push(d) }
  }
  for (const c of contacts) {
    const ld  = c.hs_lifecyclestage_lead_date                   ? new Date(c.hs_lifecyclestage_lead_date).getTime()                   : null
    const mcd = c.hs_lifecyclestage_marketingqualifiedlead_date ? new Date(c.hs_lifecyclestage_marketingqualifiedlead_date).getTime() : null
    const sqd = c.hs_lifecyclestage_salesqualifiedlead_date     ? new Date(c.hs_lifecyclestage_salesqualifiedlead_date).getTime()     : null
    const opd = c.hs_lifecyclestage_opportunity_date            ? new Date(c.hs_lifecyclestage_opportunity_date).getTime()            : null
    const cud = c.hs_lifecyclestage_customer_date               ? new Date(c.hs_lifecyclestage_customer_date).getTime()               : null
    pushDur(transitionDurations["Lead → MQL Cold"],        ld,  mcd)
    pushDur(transitionDurations["SQL → Opportunity"],      sqd, opd)
    pushDur(transitionDurations["Opportunity → Customer"], opd, cud)
    pushDur(transitionDurations["Lead → Customer (total)"],ld,  cud)
  }
  for (const history of Object.values(lifecycleHistory)) {
    if (!history?.length) continue
    const stageTimes: Record<string, Date> = {}
    for (const e of history as any[]) if (e.value && e.ts && !stageTimes[e.value]) stageTimes[e.value] = e.ts
    const mc = stageTimes["marketingqualifiedlead"], mh = stageTimes["770940371"], sq = stageTimes["salesqualifiedlead"]
    if (mc && mh && mh > mc) { const d = (mh.getTime() - mc.getTime()) / 86400000; if (d > 0 && d < 1825) transitionDurations["MQL Cold → MQL Hot"].push(d) }
    if (mh && sq && sq > mh) { const d = (sq.getTime() - mh.getTime()) / 86400000; if (d > 0 && d < 1825) transitionDurations["MQL Hot → SQL"].push(d) }
  }
  const avgDaysPerTransition: Record<string, { avg: number; median: number; count: number }> = {}
  for (const [key, durations] of Object.entries(transitionDurations)) {
    avgDaysPerTransition[key] = {
      avg: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      median: median(durations), count: durations.length,
    }
  }

  // Time in current stage
  const stageDatePropMap: Record<string, string> = {
    lead: "hs_lifecyclestage_lead_date",
    marketingqualifiedlead: "hs_lifecyclestage_marketingqualifiedlead_date",
    salesqualifiedlead: "hs_lifecyclestage_salesqualifiedlead_date",
    opportunity: "hs_lifecyclestage_opportunity_date",
    customer: "hs_lifecyclestage_customer_date",
  }
  const avgDaysInCurrentStage: Record<string, { label: string; avg: number; median: number; count: number }> = {}
  for (const stage of LIFECYCLE_STAGES) {
    if (stage.id === "1874186475" || stage.id === "3529709812") continue
    const inStage = contacts.filter(c => c.lifecyclestage === stage.id)
    if (!inStage.length) continue
    const dateProp = stageDatePropMap[stage.id]
    const days: number[] = []
    for (const c of inStage) {
      if (dateProp && c[dateProp]) { const d = (now - new Date(c[dateProp]).getTime()) / 86400000; if (d > 0 && d < 3650) { days.push(d); continue } }
      const hist = lifecycleHistory[c._id] as any[] | undefined
      if (hist) { const entries = hist.filter((h: any) => h.value === stage.id); if (entries.length) { const d = (now - new Date(entries[entries.length - 1].ts).getTime()) / 86400000; if (d > 0 && d < 3650) { days.push(d); continue } } }
      if (c.createdate) { const d = (now - new Date(c.createdate).getTime()) / 86400000; if (d > 0) days.push(d) }
    }
    avgDaysInCurrentStage[stage.id] = { label: stage.label, avg: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0, median: median(days), count: days.length }
  }

  // Activation funnel — actual contacts currently at each stage
  const funnelData = FUNNEL_STAGE_ORDER.map(id => ({
    id, stage: stageLabel(id),
    count: contacts.filter(c => c.lifecyclestage === id).length,
  }))

  // Stuck contacts
  const stuckLeads = contacts
    .filter(c => { const s = c.lifecyclestage; if (!s || s === "customer" || s === "1874186475" || s === "3529709812") return false; const ref = c.hs_last_sales_activity_timestamp || c.createdate; if (!ref) return false; const d = (now - new Date(ref).getTime()) / 86400000; return d > 30 && d < 1825 })
    .map(c => { const ref = c.hs_last_sales_activity_timestamp || c.createdate; const oid = c.hubspot_owner_id || ""; return { id: c._id, name: [c.firstname, c.lastname].filter(Boolean).join(" ") || c.email, email: c.email, company: c.company || "", stage: stageLabel(c.lifecyclestage), leadStatus: c.hs_lead_status || "—", daysInStage: ref ? Math.round((now - new Date(ref).getTime()) / 86400000) : null, ownerId: oid, owner: owners[oid] || "Unknown", lastActivity: c.hs_last_sales_activity_timestamp || null } })
    .sort((a, b) => (b.daysInStage || 0) - (a.daysInStage || 0))
  const stuckOwnerMap: Record<string, number> = {}
  for (const l of stuckLeads) stuckOwnerMap[l.owner] = (stuckOwnerMap[l.owner] || 0) + 1
  const stuckPerOwner = Object.entries(stuckOwnerMap).map(([owner, stuck]) => ({ owner, stuck })).sort((a, b) => b.stuck - a.stuck)

  // Nurture candidates — contacts in Journey Stage "In Nurturing"
  const nurtureCandidates = contacts
    .filter(c => {
      const js = (c.journey_stage || "").toLowerCase()
      return js === "in nurturing" || js === "nurturing" || js === "in_nurturing"
    })
    .map(c => ({ id: c._id, name: [c.firstname, c.lastname].filter(Boolean).join(" ") || c.email, email: c.email, stage: stageLabel(c.lifecyclestage) || "—", leadStatus: c.hs_lead_status || "—", journeyStage: c.journey_stage || "—", lastContacted: c.notes_last_contacted || c.hs_last_sales_activity_timestamp || null, owner: owners[c.hubspot_owner_id] || "Unknown" }))
    .sort((a, b) => { if (!a.lastContacted) return -1; if (!b.lastContacted) return 1; return new Date(a.lastContacted).getTime() - new Date(b.lastContacted).getTime() })

  // Lead Status Distribution (use display labels as keys)
  const statusCountMap: Record<string, number> = {}
  for (const c of contacts) if (c.hs_lead_status) statusCountMap[c.hs_lead_status] = (statusCountMap[c.hs_lead_status] || 0) + 1
  const leadStatusDistribution = LEAD_STATUS_OPTIONS.map(({ value, label }) => ({
    status: label,
    count: statusCountMap[value] || 0,
  }))

  // Stage × Status matrix (columns use display labels)
  const stageStatusMatrix = LIFECYCLE_STAGES.filter(s => s.id !== "other").map(stage => {
    const row: Record<string, any> = { stage: stage.label }
    for (const { value, label } of LEAD_STATUS_OPTIONS) {
      row[label] = contacts.filter(c => c.lifecyclestage === stage.id && c.hs_lead_status === value).length
    }
    row["_total"] = contacts.filter(c => c.lifecyclestage === stage.id).length
    return row
  }).filter(row => row["_total"] > 0)

  // By owner
  const ownerMap: Record<string, any> = {}
  for (const c of contacts) {
    const oid = c.hubspot_owner_id || ""
    const n = owners[oid] || "Unknown"
    if (!ownerMap[n]) ownerMap[n] = { name: n, ownerId: oid, lead: 0, mqlCold: 0, mqlHot: 0, sql: 0, opportunity: 0, customer: 0, disqualified: 0 }
    const s = c.lifecyclestage
    if (s === "lead") ownerMap[n].lead++
    else if (s === "marketingqualifiedlead") ownerMap[n].mqlCold++
    else if (s === "770940371") ownerMap[n].mqlHot++
    else if (s === "salesqualifiedlead") ownerMap[n].sql++
    else if (s === "opportunity") ownerMap[n].opportunity++
    else if (s === "customer") ownerMap[n].customer++
    else if (s === "1874186475") ownerMap[n].disqualified++
  }
  const byOwner = Object.values(ownerMap).sort((a: any, b: any) => (b.customer + b.opportunity) - (a.customer + a.opportunity))

  // Monthly contacts — fixed 18-month window so the current month always appears
  const monthlyMap: Record<string, number> = {}
  for (const c of contacts) if (c.createdate) { const m = c.createdate.slice(0, 7); monthlyMap[m] = (monthlyMap[m] || 0) + 1 }
  const nowDate = new Date(now)
  const fixedMonths: string[] = []
  for (let i = 17; i >= 0; i--) {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1)
    fixedMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  const byMonth = fixedMonths.map(month => ({ month, count: monthlyMap[month] || 0 }))

  // Lead quality
  const scoreDistribution = [
    { bucket: "0–14", min: 0, max: 15 }, { bucket: "15–39", min: 15, max: 40 },
    { bucket: "40–59", min: 40, max: 60 }, { bucket: "60–100", min: 60, max: 10000 },
  ].map(b => ({ bucket: b.bucket, count: contacts.filter(c => { const s = parseFloat(c.hubspotscore); return !isNaN(s) && s >= b.min && s < b.max }).length }))
  const scoreByStage = LIFECYCLE_STAGES.filter(s => s.id !== "1874186475").map(s => {
    const scores = contacts.filter(c => c.lifecyclestage === s.id && c.hubspotscore).map(c => parseFloat(c.hubspotscore)).filter(n => !isNaN(n))
    return { id: s.id, stage: s.label, avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0, count: scores.length }
  })
  const gradeMap: Record<string, number> = {}
  for (const c of contacts) { const g = (c.global_grade || "Unknown").toUpperCase(); gradeMap[g] = (gradeMap[g] || 0) + 1 }
  const gradeDistribution = Object.entries(gradeMap).sort(([a], [b]) => a.localeCompare(b)).map(([grade, count]) => ({ grade, count }))
  const topScoring = contacts.filter(c => c.hubspotscore && parseFloat(c.hubspotscore) > 0).sort((a, b) => parseFloat(b.hubspotscore) - parseFloat(a.hubspotscore)).slice(0, 50)
    .map(c => ({ id: c._id, name: [c.firstname, c.lastname].filter(Boolean).join(" ") || c.email || "Unknown", email: c.email || "", score: Math.round(parseFloat(c.hubspotscore)), stage: stageLabel(c.lifecyclestage) || "—", status: c.hs_lead_status || "—", owner: owners[c.hubspot_owner_id] || "—", lastContacted: c.notes_last_contacted || c.hs_last_sales_activity_timestamp || null }))
  const sourceMap: Record<string, { total: number; customers: number }> = {}
  for (const c of contacts) { const src = c.hs_lead_source || "Unknown"; if (!sourceMap[src]) sourceMap[src] = { total: 0, customers: 0 }; sourceMap[src].total++; if (c.lifecyclestage === "customer") sourceMap[src].customers++ }
  const conversionBySource = Object.entries(sourceMap).sort(([, a], [, b]) => b.total - a.total).map(([source, { total, customers }]) => ({ source, total, customers, pct: total > 0 ? Math.round((customers / total) * 100) : 0 })).slice(0, 15)
  const leadQuality = { scoreDistribution, scoreByStage, gradeDistribution, topScoring, conversionBySource }

  return {
    totalContacts: contacts.length,
    stageCounts, stageCountsList, avgDaysPerTransition, avgDaysInCurrentStage,
    funnelData, stuckLeads, stuckPerOwner, nurtureCandidates,
    leadStatusDistribution, stageStatusMatrix, leadStatusCols: LEAD_STATUS_OPTIONS.map(o => o.label),
    byOwner, byMonth, leadQuality,
  }
}

type ReinvesteringResult = { medianDays: number; avgDays: number; reinvestRate: number; totalCustomers: number; reinvestedCount: number; within90days: number; within180days: number }
const emptyReinv = (totalCustomers: number): ReinvesteringResult => ({ medianDays: 0, avgDays: 0, reinvestRate: 0, totalCustomers, reinvestedCount: 0, within90days: 0, within180days: 0 })
function calcReinv(contactDealDates: Record<string, Date[]>, customerIds: Set<string>): ReinvesteringResult {
  const totalCustomers = customerIds.size
  const daysToReinvest: number[] = []; let w90 = 0, w180 = 0
  for (const [cid, dates] of Object.entries(contactDealDates)) {
    if (!customerIds.has(cid)) continue
    if (dates.length < 2) continue
    const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
    const d = (sorted[1].getTime() - sorted[0].getTime()) / 86400000
    if (d >= 1 && d < 3650) { daysToReinvest.push(d); if (d <= 90) w90++; if (d <= 180) w180++ }
  }
  const count = daysToReinvest.length
  return {
    medianDays: median(daysToReinvest),
    avgDays: count ? Math.round(daysToReinvest.reduce((a, b) => a + b, 0) / count) : 0,
    reinvestRate: totalCustomers ? Math.round((count / totalCustomers) * 100) : 0,
    totalCustomers, reinvestedCount: count, within90days: w90, within180days: w180,
  }
}

async function fetchPipelineData() {
  console.log("[sync] ── START fetchPipelineData ──")
  const { names: owners, userIdToOwnerId } = await getOwners()
  console.log(`[sync] Owners loaded: ${Object.keys(owners).length}`)
  const { teamOwnerIds, teamOwnerNames } = await getTeamOwnerIds(userIdToOwnerId, owners)

  const knownLabelMap: Record<string, string> = {
    ...Object.fromEntries(LIFECYCLE_STAGES.map(s => [s.id, s.label])),
    ...EXTRA_STAGE_LABELS,
  }

  const allContacts = await getAllContacts([
    "email","firstname","lastname","lifecyclestage","hs_lead_status",
    "createdate","hs_last_sales_activity_timestamp","hubspot_owner_id","endavu_deal_id","phone","company",
    "hubspotscore","hs_lead_source","global_grade","notes_last_contacted",
    "lead_engagement_score_total","hs_analytics_source",
    "hs_all_assigned_business_unit_ids",
    "hs_lifecyclestage_lead_date",
    "hs_lifecyclestage_marketingqualifiedlead_date",
    "hs_lifecyclestage_salesqualifiedlead_date",
    "hs_lifecyclestage_opportunity_date",
    "hs_lifecyclestage_customer_date",
    "journey_stage",
  ])
  const contacts = allContacts.filter(c => !isTestContact(c.email || "") && !c.endavu_deal_id)
  console.log(`[sync] Total contacts fetched: ${allContacts.length}, after filter: ${contacts.length}`)

  // Fetch lifecycle history once for contacts that passed through MQL Hot
  const mqlHotIds = contacts
    .filter(c => ["770940371","salesqualifiedlead","opportunity","customer","evangelist"].includes(c.lifecyclestage))
    .map(c => c._id)
  console.log(`[sync] Fetching lifecycle history for ${mqlHotIds.length} MQL Hot+ contacts...`)
  const lifecycleHistory = await getLifecycleHistory(mqlHotIds)
  console.log(`[sync] Lifecycle history fetched for ${Object.keys(lifecycleHistory).length} contacts`)
  const now = Date.now()

  // Global metrics
  console.log("[sync] Computing global metrics...")
  const globalMetrics = { ...computeContactMetrics(contacts, owners, knownLabelMap, lifecycleHistory, now), teamOwnerIds, teamOwnerNames }
  console.log(`[sync] Global metrics done. totalContacts=${globalMetrics.totalContacts}`)

  // Per-brand metrics (reuses the already-fetched history)
  const _brandsMetrics: Record<string, ReturnType<typeof computeContactMetrics>> = {}
  for (const [region, brand] of Object.entries(BRAND_IDS)) {
    const brandContacts = contacts.filter(c => {
      const buIds = String(c.hs_all_assigned_business_unit_ids || "").split(";").map((s: string) => s.trim())
      return buIds.includes(brand.id)
    })
    console.log(`[sync] Brand ${region} (${brand.id}): ${brandContacts.length} contacts`)
    const brandContactIds = new Set(brandContacts.map(c => c._id))
    const brandHistory: Record<string, any[]> = {}
    for (const [id, hist] of Object.entries(lifecycleHistory)) {
      if (brandContactIds.has(id)) brandHistory[id] = hist
    }
    _brandsMetrics[brand.id] = computeContactMetrics(brandContacts, owners, knownLabelMap, brandHistory, now)
  }

  const globalCustomerIds = new Set(contacts.filter(c => c.lifecyclestage === "customer").map(c => c._id))
  let reinvestering: ReinvesteringResult = emptyReinv(globalCustomerIds.size)
  const contactDealDatesGlobal: Record<string, Date[]> = {}

  try {
    const WON_STAGES = ["closedwon","497565675","503960545","517811422","766320087","4500113624","4643302624"]
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
    for (let i = 0; i < dealIds.length; i += 100) {
      await sleep(200)
      try {
        const assocData = await hsPost("/crm/v4/associations/deals/contacts/batch/read", { inputs: dealIds.slice(i, i + 100).map(id => ({ id })) })
        for (const r of assocData.results || []) {
          const deal = allWonDeals.find(d => d.id === r.from?.id)
          if (!deal?.properties?.closedate) continue
          const cd = new Date(deal.properties.closedate)
          for (const a of r.to || []) {
            const cid = String(a.toObjectId || a.id)
            if (!contactDealDatesGlobal[cid]) contactDealDatesGlobal[cid] = []
            contactDealDatesGlobal[cid].push(cd)
          }
        }
      } catch { /* skip */ }
    }
    reinvestering = calcReinv(contactDealDatesGlobal, globalCustomerIds)
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
    ...globalMetrics,
    reinvestering,
    dealStats,
    activityByOwner,
    _brandsMetrics,
    _contactDealDates: contactDealDatesGlobal,
    _contacts: contacts,
  }
}

export const maxDuration = 300

export async function GET(req: NextRequest) {
  // Allow Vercel cron requests (identified by CRON_SECRET) or authenticated sessions
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`
  if (!isCron) {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const data = await fetchPipelineData()
    const { _brandsMetrics, _contactDealDates, _contacts, ...globalData } = data

    // Write global data (strip internal fields)
    console.log(`[sync] Writing global cache key: ${CACHE_KEY} (${globalData.totalContacts} contacts)`)
    await writeCache(CACHE_KEY, globalData)
    console.log(`[sync] ✓ Global cache written`)

    // Write per-brand data (brand-specific contact metrics + per-brand reinvestment)
    for (const [region, brand] of Object.entries(BRAND_IDS)) {
      const brandMetrics = _brandsMetrics[brand.id]
      if (!brandMetrics) { console.log(`[sync] ⚠ No metrics for brand ${region} (${brand.id}) — writing empty cache`); }
      // Per-brand reinvestment: filter contactDealDates to customers of this brand
      const brandCustomerIds = new Set(
        (_contacts || [])
          .filter((c: any) => c.lifecyclestage === "customer" && String(c.hs_all_assigned_business_unit_ids || "").split(";").map((s: string) => s.trim()).includes(brand.id))
          .map((c: any) => c._id)
      )
      const brandReinvestering = _contactDealDates
        ? calcReinv(_contactDealDates, brandCustomerIds)
        : emptyReinv(brandCustomerIds.size)
      const brandKey = `vk-pipeline-data-${brand.id}`
      console.log(`[sync] Writing brand cache key: ${brandKey} (${brandMetrics?.totalContacts ?? 0} contacts, ${brandCustomerIds.size} customers)`)
      await writeCache(brandKey, {
        fetchedAt: globalData.fetchedAt,
        dealStats: globalData.dealStats,
        activityByOwner: globalData.activityByOwner,
        teamOwnerIds: globalData.teamOwnerIds,
        teamOwnerNames: globalData.teamOwnerNames,
        reinvestering: brandReinvestering,
        ...brandMetrics,
        brand: brand.label,
        brandId: brand.id,
        region,
      })
      console.log(`[sync] ✓ Brand ${region} written`)
    }

    console.log("[sync] ── DONE ──")
    return NextResponse.json({ ok: true, fetchedAt: globalData.fetchedAt, contacts: globalData.totalContacts })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
