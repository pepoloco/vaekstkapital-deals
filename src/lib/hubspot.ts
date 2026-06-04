const BASE = "https://api.hubapi.com"
const KEY = process.env.HUBSPOT_API_KEY!

const DK_WON = [
  "497565675",  // BU DK - VK Mortgage Fund
  "503960545",  // BU DK - SEE Residential A/S
  "517811422",  // BU DK - Sofia Residential Development A/S
  "766320087",  // BU DK - Sofia Residential A/S
  "4500113624", // BU DK - Vaekstkapital Invest A/S
  "4643302624", // BU DK - SRD Landholding
]

const DK_LOST = [
  "497565676",  // BU DK - VK Mortgage Fund
  "503960546",  // BU DK - SEE Residential A/S
  "517811423",  // BU DK - Sofia Residential Development A/S
  "766320088",  // BU DK - Sofia Residential A/S
  "4500113625", // BU DK - Vaekstkapital Invest A/S
  "4643302625", // BU DK - SRD Landholding
]

const DK_OPEN = [
  "497565672",  // BU DK - VK Mortgage Fund
  "503960544",  // BU DK - SEE Residential A/S
  "517811421",  // BU DK - Sofia Residential Development A/S
  "766320086",  // BU DK - Sofia Residential A/S
  "4500113623", // BU DK - Vaekstkapital Invest A/S
  "4643302626", // BU DK - SRD Landholding
]

const DK_NEGOTIATIONS = [
  "5181367541", // BU DK - VK Mortgage Fund
  "5181454546", // BU DK - SEE Residential A/S
  "5181446390", // BU DK - Sofia Residential Development A/S
  "5181367542", // BU DK - Sofia Residential A/S
  "5181446392", // BU DK - Vaekstkapital Invest A/S
  "5181374699", // BU DK - SRD Landholding
]

const CLOSED_WON = new Set(DK_WON)
const CLOSED_LOST = new Set(DK_LOST)

const TEST_DOMAINS = ["vaekstnet.com","vaekstkapital.com","mailinator.com","yopmail.com","example.com"]
function isTestEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const e = email.toLowerCase()
  return TEST_DOMAINS.some(d => e.endsWith("@" + d)) ||
    ["test@","demo@","staging@","sandbox@"].some(p => e.startsWith(p))
}

function isTestDeal(dealname: string | null | undefined): boolean {
  if (!dealname) return false
  const d = dealname.toLowerCase()
  return d.includes("test") || d.includes("demo") || d.includes("staging") || d.includes("sandbox")
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function hsPost(path: string, body: object, attempt = 0): Promise<Record<string, unknown>> {
  await sleep(300)
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  if (res.status === 429 && attempt < 5) {
    await sleep(2000 * (attempt + 1))
    return hsPost(path, body, attempt + 1)
  }
  const data = await res.json()
  if (!res.ok) throw new Error(`HubSpot ${path} ${res.status}: ${JSON.stringify(data)}`)
  return data
}

async function countObjects(objectType: string, filterGroups: object[]): Promise<number> {
  const data = await hsPost(`/crm/v3/objects/${objectType}/search`, {
    filterGroups, properties: ["hs_object_id"], limit: 1,
  })
  return (data.total as number) ?? 0
}

async function searchAll(objectType: string, filterGroups: object[], properties: string[]): Promise<Record<string, string>[]> {
  const results: Record<string, string>[] = []
  let after: string | undefined
  do {
    const body: Record<string, unknown> = { filterGroups, properties, limit: 200 }
    if (after) body.after = after
    const data = await hsPost(`/crm/v3/objects/${objectType}/search`, body)
    const rows = data.results as Array<{ properties: Record<string, string> }>
    if (!rows) throw new Error(`No results in ${objectType}: ${JSON.stringify(data)}`)
    results.push(...rows.map(r => r.properties))
    after = (data.paging as { next?: { after: string } })?.next?.after
  } while (after)
  return results
}

async function getOwners(): Promise<{ byId: Record<string, string>; byUserId: Record<string, string> }> {
  const byId: Record<string, string> = {}
  const byUserId: Record<string, string> = {}
  let after: string | undefined
  do {
    const url = `${BASE}/crm/v3/owners?limit=100${after ? `&after=${after}` : ""}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" })
    const data = await res.json()
    for (const o of data.results ?? []) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(" ")
      if (name) {
        byId[String(o.id)] = name
        if (o.userId) byUserId[String(o.userId)] = name
      }
    }
    after = (data.paging as { next?: { after: string } })?.next?.after
  } while (after)
  return { byId, byUserId }
}

const PHONE_SALES_TEAM = [
  "Alexander Roijen",
  "Brian Jensen",
  "Frank Willis Eilersen",
  "Jan Erik Dahl Hansen",
  "Mathias Bro Jensen",
  "Mikkel Lauridsen",
  "Ole Krabbe",
  "Tobias Pedersen",
]

async function batchReadCompanies(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {}
  const result: Record<string, string> = {}
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    await sleep(300)
    const res = await fetch(`${BASE}/crm/v3/objects/companies/batch/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: chunk.map(id => ({ id })), properties: ["name"] }),
      cache: "no-store",
    })
    if (!res.ok) continue
    const data = await res.json()
    for (const r of (data.results ?? []) as Array<{ id: string; properties: { name: string } }>) {
      result[String(r.id)] = r.properties?.name || ""
    }
  }
  return result
}

function normConsultant(name: string | null | undefined): string | null {
  if (!name) return null
  const s = name.trim().toLowerCase()
  if (!s || s === "n/a" || s === "pkb") return null
  if (s.startsWith("patrick")) return null
  if (s.startsWith("coac") || s.includes("vk administration")) return "COAC"
  if (s === "frank" || s.startsWith("frank w")) return "Frank Willis Eilersen"
  if (s.startsWith("tobias p")) return "Tobias Pedersen"
  if (s.startsWith("mathias")) return "Mathias Bro Jensen"
  if (s.startsWith("alexander") || s === "alexander roijej") return "Alexander Roijen"
  if (s.startsWith("brian")) return "Brian Jensen"
  if (s.startsWith("ole k")) return "Ole Krabbe"
  if (s.startsWith("mikkel l")) return "Mikkel Lauridsen"
  if (s.startsWith("emil")) return "Emil Antonsson"
  if (s.startsWith("jan e")) return "Jan Erik Dahl Hansen"
  if (s.startsWith("thomas n")) return "Thomas Nørby Pedersen"
  return name.trim()
}

const PIPELINE_NAMES_FALLBACK: Record<string, string> = {
  "312277465":  "VK Mortgage Fund",
  "317033164":  "SEE Residential A/S",
  "504393914":  "Sofia Residential A/S",
  "3285556461": "Vaekstkapital Invest A/S",
  "3391038697": "SRD LandHoldings A/S",
}

async function getDealPipelines(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${BASE}/crm/v3/pipelines/deals`, {
      headers: { Authorization: `Bearer ${KEY}` },
      cache: "no-store",
    })
    const data = await res.json()
    const map: Record<string, string> = { ...PIPELINE_NAMES_FALLBACK }
    for (const p of data.results ?? []) {
      if (p.id && p.label) map[String(p.id)] = p.label
    }
    return map
  } catch {
    return PIPELINE_NAMES_FALLBACK
  }
}

const STAGE_NAMES: Record<string, string> = {
  "497565675": "Closed Won", "503960545": "Closed Won", "517811422": "Closed Won",
  "766320087": "Closed Won", "4500113624": "Closed Won", "4643302624": "Closed Won",
  "497565676": "Closed Lost", "503960546": "Closed Lost", "517811423": "Closed Lost",
  "766320088": "Closed Lost", "4500113625": "Closed Lost", "4643302625": "Closed Lost",
  "497565672": "Subscription Form Sent", "503960544": "Subscription Form Sent", "517811421": "Subscription Form Sent",
  "766320086": "Subscription Form Sent", "4500113623": "Subscription Form Sent", "4643302626": "Subscription Form Sent",
  "5181367541": "Negotiations", "5181454546": "Negotiations", "5181446390": "Negotiations",
  "5181367542": "Negotiations", "5181446392": "Negotiations", "5181374699": "Negotiations",
}

export async function fetchAllData() {

  const [{ byId: owners, byUserId: ownersByUserId }, PIPELINE_NAMES] = await Promise.all([
    getOwners(),
    getDealPipelines(),
  ])
  const phoneTeamMembers = PHONE_SALES_TEAM

  const contactsInvested = await countObjects("contacts", [{ filters: [{ propertyName: "invested_in_vaekstnet", operator: "EQ", value: "Yes" }] }])

  const contactsDetail = await searchAll("contacts",
    [{ filters: [{ propertyName: "customer_id", operator: "HAS_PROPERTY" }] }],
    ["signup_time", "onboarding_complete_time", "cash_balance", "total_auc", "email", "firstname", "lastname", "hs_object_id", "hubspot_owner_id", "associatedcompanyid"]
  )
  const contactsReal = contactsDetail.filter(c => !isTestEmail(c.email))

  const companyIds = [...new Set(contactsReal.map(c => c.associatedcompanyid).filter(Boolean))]
  const companyNames = await batchReadCompanies(companyIds)

  const makeVnContact = (c: Record<string, string>) => ({
    name: [c.firstname, c.lastname].filter(Boolean).join(" ") || c.email || "Ukendt",
    company: companyNames[c.associatedcompanyid] || "",
    auc: parseFloat(c.total_auc || "0"),
    signupTime: c.signup_time,
    onboardingTime: c.onboarding_complete_time || null,
    id: c.hs_object_id,
  })

  const vnNotOnboarded = contactsReal
    .filter(c => !c.onboarding_complete_time)
    .sort((a,b) => new Date(b.signup_time).getTime() - new Date(a.signup_time).getTime())
    .map(makeVnContact)

  const vnNotFunded = contactsReal
    .filter(c => c.onboarding_complete_time && parseFloat(c.total_auc||"0") < 1)
    .sort((a,b) => new Date(b.onboarding_complete_time).getTime() - new Date(a.onboarding_complete_time).getTime())
    .map(makeVnContact)

  const vnFunded = contactsReal
    .filter(c => parseFloat(c.total_auc||"0") >= 1)
    .sort((a,b) => new Date(b.onboarding_complete_time || b.signup_time).getTime() - new Date(a.onboarding_complete_time || a.signup_time).getTime())
    .map(makeVnContact)

  const countCreated   = contactsReal.length
  const countOnboarded = contactsReal.filter(c => c.onboarding_complete_time).length
  const countFunded    = contactsReal.filter(c => parseFloat(c.total_auc||"0") >= 1).length

  const notOnboarded = contactsReal
    .filter(c => !c.onboarding_complete_time)
    .sort((a,b) => new Date(b.signup_time).getTime() - new Date(a.signup_time).getTime())
    .map(c => ({
      name: [c.firstname, c.lastname].filter(Boolean).join(" ") || c.email || "Ukendt",
      email: c.email,
      signupTime: c.signup_time,
      owner: owners[c.hubspot_owner_id] || "—",
      id: c.hs_object_id,
    }))

  const notFunded = contactsReal
    .filter(c => c.onboarding_complete_time && parseFloat(c.total_auc||"0") < 1)
    .sort((a,b) => new Date(b.signup_time).getTime() - new Date(a.signup_time).getTime())
    .map(c => ({
      name: [c.firstname, c.lastname].filter(Boolean).join(" ") || c.email || "Ukendt",
      email: c.email,
      signupTime: c.signup_time,
      owner: owners[c.hubspot_owner_id] || "—",
      id: c.hs_object_id,
    }))

  const funded = contactsReal
    .filter(c => parseFloat(c.total_auc||"0") >= 1)
    .sort((a,b) => new Date(b.signup_time).getTime() - new Date(a.signup_time).getTime())
    .map(c => ({
      name: [c.firstname, c.lastname].filter(Boolean).join(" ") || c.email || "Ukendt",
      email: c.email,
      signupTime: c.signup_time,
      owner: owners[c.hubspot_owner_id] || "—",
      id: c.hs_object_id,
    }))

  const now = new Date()
  const months: string[] = []
  let d = new Date(2025, 9, 1)
  while (d.getFullYear() < now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() <= now.getMonth())) {
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`)
    d = new Date(d.getFullYear(), d.getMonth()+1, 1)
  }

  const byMonth = months.map(m => {
    const [y, mo] = m.split("-").map(Number)
    const start = new Date(y, mo - 1, 1).getTime()
    const end   = new Date(y, mo, 1).getTime()
    const created   = contactsReal.filter(c => { const t = new Date(c.signup_time).getTime(); return t >= start && t < end }).length
    const onboarded = contactsReal.filter(c => { if (!c.onboarding_complete_time) return false; const t = new Date(c.onboarding_complete_time).getTime(); return t >= start && t < end }).length
    const fundedM   = contactsReal.filter(c => { const t = new Date(c.signup_time).getTime(); return t >= start && t < end && parseFloat(c.total_auc||"0") >= 1 }).length
    return { month: m, created, onboarded, funded: fundedM }
  })
  let cs = 0, co = 0, cf = 0
  const cumulative = byMonth.map(m => {
    cs += m.created; co += m.onboarded; cf += m.funded
    return { month: m.month, created: cs, onboarded: co, funded: cf, onboardingRate: cs > 0 ? Math.round(co/cs*100) : 0 }
  })

  const [aucContacts, aucCompanies] = await Promise.all([
    searchAll("contacts",
      [{ filters: [{ propertyName: "total_auc", operator: "GT", value: "0" }] }],
      ["total_auc", "vk_auc_in_vk_funds", "cash_balance", "firstname", "lastname", "email", "hubspot_owner_id"]
    ),
    searchAll("companies",
      [{ filters: [{ propertyName: "total_auc", operator: "GT", value: "0" }] }],
      ["total_auc", "vk_auc_in_vk_funds", "cash_balance", "name", "hubspot_owner_id"]
    ),
  ])
  const aucContactsFiltered = aucContacts.filter(c => !isTestEmail(c.email))

  const sumAuc  = (arr: Record<string, string>[]) => arr.reduce((s, c) => s + (parseFloat(c.total_auc) || 0), 0)
  const sumVk   = (arr: Record<string, string>[]) => arr.reduce((s, c) => s + (parseFloat(c.vk_auc_in_vk_funds) || 0), 0)
  const sumCash = (arr: Record<string, string>[]) => arr.reduce((s, c) => s + (parseFloat(c.cash_balance) || 0), 0)

  const aucCT = sumAuc(aucContactsFiltered), aucCC = sumAuc(aucCompanies)
  const vkCT  = sumVk(aucContactsFiltered),  vkCC  = sumVk(aucCompanies)
  const cashCT = sumCash(aucContactsFiltered), cashCC = sumCash(aucCompanies)

  const topCustomers = [
    ...aucContactsFiltered.map(c => ({
      name: [c.firstname, c.lastname].filter(Boolean).join(" ") || "Ukendt",
      type: "Contact" as const,
      consultant: owners[c.hubspot_owner_id] || "—",
      totalAuc: parseFloat(c.total_auc) || 0,
      vkFunds:  parseFloat(c.vk_auc_in_vk_funds) || 0,
      cash:     parseFloat(c.cash_balance) || 0,
      listed:   Math.max(0, (parseFloat(c.total_auc)||0) - (parseFloat(c.vk_auc_in_vk_funds)||0) - (parseFloat(c.cash_balance)||0)),
    })),
    ...aucCompanies.map(c => ({
      name: c.name || "Ukendt",
      type: "Company" as const,
      consultant: owners[c.hubspot_owner_id] || "—",
      totalAuc: parseFloat(c.total_auc) || 0,
      vkFunds:  parseFloat(c.vk_auc_in_vk_funds) || 0,
      cash:     parseFloat(c.cash_balance) || 0,
      listed:   Math.max(0, (parseFloat(c.total_auc)||0) - (parseFloat(c.vk_auc_in_vk_funds)||0) - (parseFloat(c.cash_balance)||0)),
    })),
  ].sort((a, b) => b.totalAuc - a.totalAuc).slice(0, 10)

const wonProps = ["amount", "investment_consultant", "deal_tm_owner", "hubspot_owner_id", "endavu_deal_id", "endavu_subscription_status", "dealstage", "pipeline", "fund_identifier", "closedate", "createdate", "dealname", "hs_object_id", "checked_by_coacs", "signed_via"]
const openProps = ["amount", "investment_consultant", "deal_tm_owner", "hubspot_owner_id", "endavu_deal_id", "endavu_subscription_status", "dealstage", "pipeline", "fund_identifier", "closedate", "createdate", "dealname", "hs_object_id"]

  const wonResults = await Promise.all(DK_WON.map(stageId =>
    searchAll("deals",
      [{ filters: [
        { propertyName: "dealstage", operator: "EQ", value: stageId },
        { propertyName: "closedate", operator: "GTE", value: "2026-01-01" },
      ]}],
      wonProps
    )
  ))
  const allWonYtd = wonResults.flat().filter(d => d.checked_by_coacs === "✔" || d.checked_by_coacs === "true")
  const openResults = await Promise.all(DK_OPEN.map(stageId =>
    searchAll("deals",
      [{ filters: [
        { propertyName: "dealstage", operator: "EQ", value: stageId },
        { propertyName: "createdate", operator: "GTE", value: "2026-01-01" },
      ]}],
      openProps
    )
  ))
  const allOpenYtd = openResults.flat()

  const endavuWon  = allWonYtd.filter(d => d.endavu_deal_id && !isTestDeal(d.dealname) && parseFloat(d.amount) >= 2000)
  const scriveWon  = allWonYtd.filter(d => !d.endavu_deal_id && !isTestDeal(d.dealname))
  const endavuOpen = allOpenYtd.filter(d => d.endavu_deal_id && !isTestDeal(d.dealname) && parseFloat(d.amount) >= 2000)
  const scriveOpen = allOpenYtd.filter(d => !d.endavu_deal_id && !isTestDeal(d.dealname))

  const lostResults = await Promise.all(DK_LOST.map(stageId =>
    searchAll("deals",
      [{ filters: [
        { propertyName: "dealstage", operator: "EQ", value: stageId },
        { propertyName: "closedate", operator: "GTE", value: "2026-01-01" },
      ]}],
      ["amount", "investment_consultant", "deal_tm_owner", "hubspot_owner_id", "endavu_deal_id", "endavu_subscription_status", "dealstage", "pipeline", "fund_identifier", "closedate", "createdate", "dealname", "hs_object_id"]
    )
  ))
  const allLostYtd = lostResults.flat()
  const endavuLost = allLostYtd.filter(d => d.endavu_deal_id && !isTestDeal(d.dealname) && parseFloat(d.amount) >= 2000)

  const negResults = await Promise.all(DK_NEGOTIATIONS.map(stageId =>
    searchAll("deals",
      [{ filters: [
        { propertyName: "dealstage", operator: "EQ", value: stageId },
        { propertyName: "createdate", operator: "GTE", value: "2026-01-01" },
      ]}],
      openProps
    )
  ))
  const allNegYtd = negResults.flat()

  const vnTegnet     = endavuWon.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)
  const vnUnderArbej = endavuOpen.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)

  const vnSellerMap: Record<string, { deals: number; amount: number; dealList: Array<{name: string; amount: number; id: string}> }> = {}
  for (const d of endavuWon) {
  const c = normConsultant(d.investment_consultant) || d.investment_consultant || owners[d.deal_tm_owner] || "Ukendt"
    if (c === "COAC") continue
    if (!vnSellerMap[c]) vnSellerMap[c] = { deals: 0, amount: 0, dealList: [] }
    vnSellerMap[c].deals++
    vnSellerMap[c].amount += parseFloat(d.amount) || 0
    vnSellerMap[c].dealList.push({ name: d.dealname || "Uden navn", amount: parseFloat(d.amount) || 0, id: d.hs_object_id })
  }
  const vnSellers = Object.entries(vnSellerMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount)

  const fundMap: Record<string, { deals: number; amount: number; dealList: Array<{name: string; amount: number; id: string; owner?: string}> }> = {}
  for (const d of endavuWon) {
    const name = PIPELINE_NAMES[d.pipeline] || d.fund_identifier || "Ukendt"
    if (!fundMap[name]) fundMap[name] = { deals: 0, amount: 0, dealList: [] }
    fundMap[name].deals++
    fundMap[name].amount += parseFloat(d.amount) || 0
    fundMap[name].dealList.push({ name: d.dealname || "Uden navn", amount: parseFloat(d.amount) || 0, id: d.hs_object_id, owner: normConsultant(d.investment_consultant) || owners[d.deal_tm_owner] || owners[d.hubspot_owner_id] || d.investment_consultant || "—" })
  }
  const fundBreakdown = Object.entries(fundMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount)

  const fundPendingMap: Record<string, { deals: number; amount: number; dealList: Array<{name: string; amount: number; id: string; owner?: string}> }> = {}
  for (const d of endavuOpen) {
    const name = PIPELINE_NAMES[d.pipeline] || d.fund_identifier || "Ukendt"
    if (!fundPendingMap[name]) fundPendingMap[name] = { deals: 0, amount: 0, dealList: [] }
    fundPendingMap[name].deals++
    fundPendingMap[name].amount += parseFloat(d.amount) || 0
    fundPendingMap[name].dealList.push({ name: d.dealname || "Uden navn", amount: parseFloat(d.amount) || 0, id: d.hs_object_id, owner: normConsultant(d.investment_consultant) || owners[d.deal_tm_owner] || owners[d.hubspot_owner_id] || d.investment_consultant || "—" })
  }
  const fundsPending = Object.entries(fundPendingMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount)

  let scDkDeals = 0, scDkAmount = 0
  const sellerMap: Record<string, { deals: number; amount: number; dealList: Array<{name: string; amount: number; id: string}> }> = {}

  const monthlyScrive: Record<string, number> = {}
  const msStart = new Date(2026, 0, 1)
  let msD = new Date(msStart)
  while (msD.getFullYear() < now.getFullYear() || (msD.getFullYear() === now.getFullYear() && msD.getMonth() <= now.getMonth())) {
    monthlyScrive[`${msD.getFullYear()}-${String(msD.getMonth()+1).padStart(2,"0")}`] = 0
    msD = new Date(msD.getFullYear(), msD.getMonth()+1, 1)
  }

  for (const d of scriveWon) {
    const amt = parseFloat(d.amount) || 0
    const raw = d.investment_consultant?.trim() || ""
    const c = normConsultant(d.investment_consultant) || raw || "Ukendt"
    scDkDeals++; scDkAmount += amt
    if (!sellerMap[c]) sellerMap[c] = { deals: 0, amount: 0, dealList: [] }
    sellerMap[c].deals++; sellerMap[c].amount += amt
    sellerMap[c].dealList.push({ name: d.dealname || "Uden navn", amount: amt, id: d.hs_object_id })
    const mo = (d.closedate || d.createdate)?.substring(0, 7)
    if (mo && monthlyScrive[mo] !== undefined) monthlyScrive[mo]++
  }

  let scDkPendingDeals = 0, scDkPendingAmount = 0
  for (const d of scriveOpen) {
    scDkPendingDeals++
    scDkPendingAmount += parseFloat(d.amount) || 0
  }

  const scriveSellers = Object.entries(sellerMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount)

  const scriveFundMap: Record<string, { deals: number; amount: number; dealList: Array<{name: string; amount: number; id: string; owner?: string}> }> = {}
  for (const d of scriveWon) {
    const name = PIPELINE_NAMES[d.pipeline] || d.fund_identifier || "Ukendt"
    if (!scriveFundMap[name]) scriveFundMap[name] = { deals: 0, amount: 0, dealList: [] }
    scriveFundMap[name].deals++
    scriveFundMap[name].amount += parseFloat(d.amount) || 0
    scriveFundMap[name].dealList.push({ name: d.dealname || "Uden navn", amount: parseFloat(d.amount) || 0, id: d.hs_object_id, owner: normConsultant(d.investment_consultant) || owners[d.deal_tm_owner] || owners[d.hubspot_owner_id] || d.investment_consultant || "—" })
  }
  const scriveFunds = Object.entries(scriveFundMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount)

  const makeDeal = (d: Record<string, string>) => ({
    name: d.dealname || "Uden navn",
    amount: parseFloat(d.amount) || 0,
    pipeline: PIPELINE_NAMES[d.pipeline] || (d.fund_identifier && d.fund_identifier !== "Unknown" ? d.fund_identifier : "") || "—",
    dealStage: STAGE_NAMES[d.dealstage] || "—",
    subscriptionStatus: d.endavu_subscription_status || "—",
    endavuId: d.endavu_deal_id || "",
    checkedByCoacs: d.checked_by_coacs === "true",
    signedVia: d.signed_via || "",
    owner: normConsultant(d.investment_consultant) || owners[String(d.deal_tm_owner)] || owners[String(d.hubspot_owner_id)] || d.investment_consultant || "—",
    createdate: d.createdate,
    closedate: d.closedate,
    id: d.hs_object_id,
  })

  const byCreate = (a: Record<string, string>, b: Record<string, string>) =>
    new Date(b.createdate||"").getTime() - new Date(a.createdate||"").getTime()

  const vnDeals = {
    endavuWon:          allWonYtd.filter(d => d.endavu_deal_id && !isTestDeal(d.dealname)).sort(byCreate).map(makeDeal),
    endavuLost:         allLostYtd.filter(d => d.endavu_deal_id && !isTestDeal(d.dealname)).sort(byCreate).map(makeDeal),
    salesWon:           allWonYtd.filter(d => !d.endavu_deal_id && !isTestDeal(d.dealname)).sort(byCreate).map(makeDeal),
    salesLost:          allLostYtd.filter(d => !d.endavu_deal_id && !isTestDeal(d.dealname)).sort(byCreate).map(makeDeal),
    salesNegotiations:  allNegYtd.filter(d => !isTestDeal(d.dealname)).sort(byCreate).map(makeDeal),
    salesSubscription:  allOpenYtd.filter(d => !isTestDeal(d.dealname)).sort(byCreate).map(makeDeal),
  }

  return {
    fetchedAt: new Date().toISOString(),
    activation: { created: countCreated, onboarded: countOnboarded, funded: countFunded, invested: contactsInvested },
    notOnboarded,
    notFunded,
    funded,
    byMonth,
    cumulative,
    auc: {
      total: aucCT + aucCC, vkFunds: vkCT + vkCC, listed: (aucCT + aucCC) - (vkCT + vkCC), cash: cashCT + cashCC,
      contacts:  { total: aucCT, vkFunds: vkCT, listed: aucCT - vkCT - cashCT, cash: cashCT, count: aucContactsFiltered.length },
      companies: { total: aucCC, vkFunds: vkCC, listed: aucCC - vkCC - cashCC, cash: cashCC, count: aucCompanies.length },
    },
    topCustomers,
    funnel: { created: endavuOpen.length, signed: endavuWon.length, cancelled: endavuLost.length, pendingAmount: vnUnderArbej },
    seller: {
      vn:       { deals: endavuWon.length, amount: vnTegnet, pendingDeals: endavuOpen.length, pendingAmount: vnUnderArbej },
      vnSellers,
      scriveDk: { deals: scDkDeals, amount: scDkAmount, pendingDeals: scDkPendingDeals, pendingAmount: scDkPendingAmount },
      scriveSellers,
      scriveFunds,
      monthlyScrive: Object.entries(monthlyScrive).map(([month, deals]) => ({ month, deals })),
    },
    funds: fundBreakdown,
    fundsPending,
    vnContacts: {
      notOnboarded: vnNotOnboarded,
      notFunded: vnNotFunded,
      funded: vnFunded,
    },
    vnDeals,
    phoneTeamMembers,
  }
}


const CLOSED_PROPS = [
  "amount", "investment_consultant", "deal_tm_owner", "hubspot_owner_id",
  "endavu_deal_id", "endavu_subscription_status", "dealstage", "pipeline",
  "fund_identifier", "closedate", "createdate", "dealname", "hs_object_id", "checked_by_coacs", "signed_via",
]

export async function fetchClosedDeals(from: string, to: string) {
  const [{ byId: owners }, PIPELINE_NAMES] = await Promise.all([
    getOwners(),
    getDealPipelines(),
  ])

  const makeFilter = (stageId: string) => {
    const f: object[] = [{ propertyName: "dealstage", operator: "EQ", value: stageId }]
    if (from) f.push({ propertyName: "closedate", operator: "GTE", value: from })
    if (to)   f.push({ propertyName: "closedate", operator: "LTE", value: to })
    return { filters: f }
  }

  const mapDeal = (d: Record<string, string>) => ({
    name: d.dealname || "Uden navn",
    amount: parseFloat(d.amount) || 0,
    pipeline: PIPELINE_NAMES[d.pipeline] || (d.fund_identifier && d.fund_identifier !== "Unknown" ? d.fund_identifier : "") || "—",
    dealStage: STAGE_NAMES[d.dealstage] || "—",
    subscriptionStatus: d.endavu_subscription_status || "—",
    endavuId: d.endavu_deal_id || "",
    checkedByCoacs: d.checked_by_coacs === "true",
    signedVia: d.signed_via || "",
    owner: normConsultant(d.investment_consultant) || owners[d.deal_tm_owner] || owners[d.hubspot_owner_id] || d.investment_consultant || "—",
    createdate: d.createdate,
    closedate: d.closedate,
    id: d.hs_object_id,
  })

  const byClose = (a: Record<string, string>, b: Record<string, string>) =>
    new Date(b.closedate || "").getTime() - new Date(a.closedate || "").getTime()

  const [wonResults, lostResults] = await Promise.all([
    Promise.all(DK_WON.map(id => searchAll("deals", [makeFilter(id)], CLOSED_PROPS))),
    Promise.all(DK_LOST.map(id => searchAll("deals", [makeFilter(id)], CLOSED_PROPS))),
  ])

  return {
    won: wonResults.flat()
      .filter(d => !isTestDeal(d.dealname) && (d.checked_by_coacs === "✔" || d.checked_by_coacs === "true"))
      .sort(byClose)
      .map(mapDeal),
    lost: lostResults.flat()
      .filter(d => !isTestDeal(d.dealname))
      .sort(byClose)
      .map(mapDeal),
  }
}

// Generic pipeline discovery — filters pipelines whose label contains labelMatch.
// Won deals are identified via hs_is_closed_won so stage label naming doesn't matter.
async function getPipelineData(labelMatch: string): Promise<{
  pipelineIds: string[]; LOST: string[]; OPEN: string[]; NEGOTIATIONS: string[];
}> {
  try {
    const res = await fetch(`${BASE}/crm/v3/pipelines/deals`, {
      headers: { Authorization: `Bearer ${KEY}` },
      cache: "no-store",
    })
    const data = await res.json()
    const pipelineIds: string[] = []
    const LOST: string[] = [], OPEN: string[] = [], NEGOTIATIONS: string[] = []
    for (const p of (data.results ?? []) as Array<{ id: string; label: string; stages?: Array<{ id: string; label: string }> }>) {
      if (!p.label?.toUpperCase().includes(labelMatch.toUpperCase())) continue
      pipelineIds.push(p.id)
      for (const s of p.stages ?? []) {
        const lbl = s.label.toLowerCase()
        if (lbl.includes("lost") || lbl.includes("cancel"))       LOST.push(s.id)
        else if (lbl.includes("negot"))                            NEGOTIATIONS.push(s.id)
        else if (!lbl.includes("won") && !lbl.includes("signed")) OPEN.push(s.id)
      }
    }
    return { pipelineIds, LOST, OPEN, NEGOTIATIONS }
  } catch {
    return { pipelineIds: [], LOST: [], OPEN: [], NEGOTIATIONS: [] }
  }
}

const REGION_PROPS = [
  "amount", "investment_consultant", "deal_tm_owner", "hubspot_owner_id",
  "endavu_deal_id", "dealstage", "pipeline", "fund_identifier",
  "closedate", "createdate", "dealname", "hs_object_id", "signed_via",
]

async function fetchRegionClosedDeals(labelMatch: string, from: string, to: string) {
  const [{ byId: owners }, PIPELINE_NAMES, { pipelineIds, LOST }] = await Promise.all([
    getOwners(), getDealPipelines(), getPipelineData(labelMatch),
  ])

  const wonFilter = (pipelineId: string) => {
    const f: object[] = [
      { propertyName: "pipeline",         operator: "EQ", value: pipelineId },
      { propertyName: "hs_is_closed_won", operator: "EQ", value: "true" },
    ]
    if (from) f.push({ propertyName: "closedate", operator: "GTE", value: from })
    if (to)   f.push({ propertyName: "closedate", operator: "LTE", value: to })
    return { filters: f }
  }
  const lostFilter = (stageId: string) => {
    const f: object[] = [{ propertyName: "dealstage", operator: "EQ", value: stageId }]
    if (from) f.push({ propertyName: "closedate", operator: "GTE", value: from })
    if (to)   f.push({ propertyName: "closedate", operator: "LTE", value: to })
    return { filters: f }
  }

  const mapDeal = (d: Record<string, string>, stageLabel: string) => ({
    name: d.dealname || "Unnamed",
    amount: parseFloat(d.amount) || 0,
    pipeline: PIPELINE_NAMES[d.pipeline] || (d.fund_identifier && d.fund_identifier !== "Unknown" ? d.fund_identifier : "") || "—",
    dealStage: stageLabel,
    subscriptionStatus: "—",
    endavuId: d.endavu_deal_id || "",
    checkedByCoacs: false,
    signedVia: d.signed_via || "",
    owner: normConsultant(d.investment_consultant) || owners[d.deal_tm_owner] || owners[d.hubspot_owner_id] || d.investment_consultant || "—",
    createdate: d.createdate,
    closedate: d.closedate,
    id: d.hs_object_id,
  })

  const byClose = (a: Record<string, string>, b: Record<string, string>) =>
    new Date(b.closedate || "").getTime() - new Date(a.closedate || "").getTime()

  const [wonResults, lostResults] = await Promise.all([
    pipelineIds.length > 0 ? Promise.all(pipelineIds.map(id => searchAll("deals", [wonFilter(id)],  REGION_PROPS))) : Promise.resolve([]),
    LOST.length > 0        ? Promise.all(LOST.map(id        => searchAll("deals", [lostFilter(id)], REGION_PROPS))) : Promise.resolve([]),
  ])

  return {
    won:  wonResults.flat().filter(d => !isTestDeal(d.dealname)).sort(byClose).map(d => mapDeal(d, "Closed Won")),
    lost: lostResults.flat().filter(d => !isTestDeal(d.dealname)).sort(byClose).map(d => mapDeal(d, "Closed Lost")),
  }
}

async function fetchRegionOpenDeals(labelMatch: string) {
  const [{ byId: owners }, PIPELINE_NAMES, { pipelineIds, LOST, OPEN, NEGOTIATIONS }] = await Promise.all([
    getOwners(), getDealPipelines(), getPipelineData(labelMatch),
  ])

  const ytdStart = `${new Date().getFullYear()}-01-01`

  const mapDeal = (d: Record<string, string>, stageLabel: string) => ({
    name: d.dealname || "Unnamed",
    amount: parseFloat(d.amount) || 0,
    pipeline: PIPELINE_NAMES[d.pipeline] || (d.fund_identifier && d.fund_identifier !== "Unknown" ? d.fund_identifier : "") || "—",
    dealStage: stageLabel,
    subscriptionStatus: "—",
    endavuId: d.endavu_deal_id || "",
    checkedByCoacs: false,
    signedVia: d.signed_via || "",
    owner: normConsultant(d.investment_consultant) || owners[String(d.deal_tm_owner)] || owners[String(d.hubspot_owner_id)] || d.investment_consultant || "—",
    createdate: d.createdate,
    closedate: d.closedate || "",
    id: d.hs_object_id,
  })

  const byCreate = (a: Record<string, string>, b: Record<string, string>) =>
    new Date(b.createdate || "").getTime() - new Date(a.createdate || "").getTime()

  const openFilter  = (id: string) => ({ filters: [{ propertyName: "dealstage",       operator: "EQ",  value: id }, { propertyName: "createdate",        operator: "GTE", value: ytdStart }]})
  const wonFilter   = (id: string) => ({ filters: [{ propertyName: "pipeline",         operator: "EQ",  value: id }, { propertyName: "hs_is_closed_won", operator: "EQ",  value: "true"  }, { propertyName: "closedate", operator: "GTE", value: ytdStart }]})
  const lostFilter  = (id: string) => ({ filters: [{ propertyName: "dealstage",       operator: "EQ",  value: id }, { propertyName: "closedate",         operator: "GTE", value: ytdStart }]})

  const clean = (rows: Record<string, string>[], lbl: string) =>
    rows.filter(d => !isTestDeal(d.dealname)).sort(byCreate).map(d => mapDeal(d, lbl))

  const [negResults, subResults, wonResults, lostResults] = await Promise.all([
    NEGOTIATIONS.length > 0 ? Promise.all(NEGOTIATIONS.map(id => searchAll("deals", [openFilter(id)], REGION_PROPS))) : Promise.resolve([]),
    OPEN.length > 0         ? Promise.all(OPEN.map(id         => searchAll("deals", [openFilter(id)], REGION_PROPS))) : Promise.resolve([]),
    pipelineIds.length > 0  ? Promise.all(pipelineIds.map(id  => searchAll("deals", [wonFilter(id)],  REGION_PROPS))) : Promise.resolve([]),
    LOST.length > 0         ? Promise.all(LOST.map(id         => searchAll("deals", [lostFilter(id)], REGION_PROPS))) : Promise.resolve([]),
  ])

  return {
    negotiations:         clean(negResults.flat(),  "Negotiations"),
    subscriptionFormSent: clean(subResults.flat(),  "Subscription Form Sent"),
    closedWon:            clean(wonResults.flat(),  "Closed Won"),
    closedLost:           clean(lostResults.flat(), "Closed Lost"),
  }
}

export const fetchSEClosedDeals   = (from: string, to: string) => fetchRegionClosedDeals("BU SE",   from, to)
export const fetchSEOpenDeals     = ()                          => fetchRegionOpenDeals("BU SE")
export const fetchShipClosedDeals = (from: string, to: string) => fetchRegionClosedDeals("BU SHIP", from, to)
export const fetchShipOpenDeals   = ()                          => fetchRegionOpenDeals("BU SHIP")
export const fetchATClosedDeals   = (from: string, to: string) => fetchRegionClosedDeals("BU AT",   from, to)
export const fetchATOpenDeals     = ()                          => fetchRegionOpenDeals("BU AT")
export const fetchFIClosedDeals   = (from: string, to: string) => fetchRegionClosedDeals("BU FI",   from, to)
export const fetchFIOpenDeals     = ()                          => fetchRegionOpenDeals("BU FI")
export const fetchNOClosedDeals   = (from: string, to: string) => fetchRegionClosedDeals("BU NO",   from, to)
export const fetchNOOpenDeals     = ()                          => fetchRegionOpenDeals("BU NO")

export async function fetchOpenDeals() {
  const [{ byId: owners }, PIPELINE_NAMES] = await Promise.all([
    getOwners(),
    getDealPipelines(),
  ])

  const ytdStart = `${new Date().getFullYear()}-01-01`

  const PIPELINE_PROPS = [
    "amount", "investment_consultant", "deal_tm_owner", "hubspot_owner_id",
    "endavu_deal_id", "endavu_subscription_status", "dealstage", "pipeline",
    "fund_identifier", "closedate", "createdate", "dealname", "hs_object_id",
    "checked_by_coacs", "signed_via",
  ]

  const mapDeal = (d: Record<string, string>) => ({
    name: d.dealname || "Uden navn",
    amount: parseFloat(d.amount) || 0,
    pipeline: PIPELINE_NAMES[d.pipeline] || (d.fund_identifier && d.fund_identifier !== "Unknown" ? d.fund_identifier : "") || "—",
    dealStage: STAGE_NAMES[d.dealstage] || "—",
    subscriptionStatus: d.endavu_subscription_status || "—",
    endavuId: d.endavu_deal_id || "",
    checkedByCoacs: d.checked_by_coacs === "true",
    signedVia: d.signed_via || "",
    owner: normConsultant(d.investment_consultant) || owners[String(d.deal_tm_owner)] || owners[String(d.hubspot_owner_id)] || d.investment_consultant || "—",
    createdate: d.createdate,
    closedate: d.closedate || "",
    id: d.hs_object_id,
  })

  const byCreate = (a: Record<string, string>, b: Record<string, string>) =>
    new Date(b.createdate || "").getTime() - new Date(a.createdate || "").getTime()

  // Open stages: filter by createdate (deals started this year)
  const openFilter = (stageId: string) => ({
    filters: [
      { propertyName: "dealstage", operator: "EQ", value: stageId },
      { propertyName: "createdate", operator: "GTE", value: ytdStart },
    ],
  })
  // Closed stages: filter by closedate (deals won/lost this year, regardless of when created)
  const closedFilter = (stageId: string) => ({
    filters: [
      { propertyName: "dealstage", operator: "EQ", value: stageId },
      { propertyName: "closedate", operator: "GTE", value: ytdStart },
    ],
  })

  const [negResults, subResults, wonResults, lostResults] = await Promise.all([
    Promise.all(DK_NEGOTIATIONS.map(id => searchAll("deals", [openFilter(id)],   PIPELINE_PROPS))),
    Promise.all(DK_OPEN.map(id         => searchAll("deals", [openFilter(id)],   PIPELINE_PROPS))),
    Promise.all(DK_WON.map(id          => searchAll("deals", [closedFilter(id)], PIPELINE_PROPS))),
    Promise.all(DK_LOST.map(id         => searchAll("deals", [closedFilter(id)], PIPELINE_PROPS))),
  ])

  const clean = (rows: Record<string, string>[]) =>
    rows.filter(d => !isTestDeal(d.dealname)).sort(byCreate).map(mapDeal)
  const cleanClosed = (rows: Record<string, string>[]) =>
    rows.filter(d => !isTestDeal(d.dealname) && (d.checked_by_coacs === "✔" || d.checked_by_coacs === "true")).sort(byCreate).map(mapDeal)

  return {
    negotiations:         clean(negResults.flat()),
    subscriptionFormSent: clean(subResults.flat()),
    closedWon:            cleanClosed(wonResults.flat()),
    closedLost:           cleanClosed(lostResults.flat()),
  }
}
