const BASE = "https://api.hubapi.com"
const KEY  = process.env.HUBSPOT_API_KEY!
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Business unit ID -> market key (matches pipeline-sync's BRAND_IDS)
const BUSINESS_UNIT_MARKET: Record<string, string> = {
  "0":        "dk",
  "17424990": "se",
  "18387361": "at",
  "17065112": "fi",
  "17435297": "no",
}

const MARKET_CURRENCY: Record<string, string> = {
  dk: "DKK", se: "SEK", at: "EUR", fi: "EUR", no: "NOK",
}

const MARKET_LABEL: Record<string, string> = {
  dk: "DK", se: "SE", at: "AT", fi: "FI", no: "NO",
}

const PLATFORMS = ["Google", "LinkedIn", "Meta"] as const
type Platform = typeof PLATFORMS[number] | "Multi-Platform"

function detectPlatform(assetNames: string[]): Platform | null {
  const found = new Set<string>()
  for (const name of assetNames) {
    for (const p of PLATFORMS) {
      if (name.toLowerCase().includes(p.toLowerCase())) found.add(p)
    }
  }
  if (found.size === 0) return null
  if (found.size > 1) return "Multi-Platform"
  return [...found][0] as Platform
}

async function hsGet(path: string, attempt = 0): Promise<any> {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" })
  if (res.status === 429 && attempt < 5) { await sleep(1500 * (attempt + 1)); return hsGet(path, attempt + 1) }
  if (!res.ok) {
    if (res.status === 404) return null
    const body = await res.text().catch(() => "")
    throw new Error(`GET ${path} -> ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

// Run async tasks with bounded concurrency to stay fast without tripping HubSpot rate limits
async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function fetchAllCampaigns(): Promise<any[]> {
  const results: any[] = []
  let after: string | undefined
  const props = "hs_name,hs_spend_items_sum_amount,hs_currency_code,hs_campaign_status,hs_start_date,hs_end_date"
  do {
    let path = `/marketing/v3/campaigns?limit=100&properties=${props}`
    if (after) path += `&after=${after}`
    const data = await hsGet(path)
    results.push(...(data?.results ?? []))
    after = data?.paging?.next?.after
  } while (after)
  return results
}

export interface CampaignRow {
  campaignName: string
  platform: string
  status: string
  market: string
  totalSpend: number
  currency: string
  contacts: number
  deals: number
  dealValueClosed: number | null
}

export interface MarketPlatformRow {
  platform: string
  totalSpend: number
  leads: number
  deals: number
  dealValueClosed: number | null
}

export interface MarketSync {
  id: string
  market: string
  currency: string
  rows: MarketPlatformRow[]
  campaigns: CampaignRow[]
}

export interface MarketingSyncResult {
  markets: MarketSync[]
  generatedAt: string
}

export async function runMarketingSync(): Promise<MarketingSyncResult> {
  const allCampaigns = await fetchAllCampaigns()

  // Only campaigns tied to a tracked market are worth the extra detail/revenue calls
  const candidates = allCampaigns.filter(c => BUSINESS_UNIT_MARKET[String(c.businessUnits?.[0]?.id ?? "")])

  const fetched = await mapConcurrent(candidates, 10, async (c) => {
    const market = BUSINESS_UNIT_MARKET[String(c.businessUnits?.[0]?.id ?? "")]
    const detail = await hsGet(`/marketing/v3/campaigns/${c.id}`)
    const adAssets: { name: string }[] = detail?.assets?.AD_CAMPAIGN?.results ?? []
    const platform = detectPlatform(adAssets.map(a => a.name))
    if (!platform) return null // not a paid-ads campaign, skip

    const revenue = await hsGet(`/marketing/v3/campaigns/${c.id}/reports/revenue`)

    const row: CampaignRow = {
      campaignName: c.properties?.hs_name ?? "(unnamed)",
      platform,
      status: c.properties?.hs_campaign_status ?? "Unknown",
      market,
      totalSpend: parseFloat(c.properties?.hs_spend_items_sum_amount) || 0,
      currency: c.properties?.hs_currency_code || MARKET_CURRENCY[market],
      contacts: revenue?.contactsNumber ?? 0,
      deals: revenue?.dealsNumber ?? 0,
      dealValueClosed: revenue?.revenueAmount ?? null,
    }
    return row
  })

  const rows: CampaignRow[] = fetched.filter((r): r is CampaignRow => r !== null)

  const markets: MarketSync[] = Object.keys(MARKET_LABEL).map(id => {
    const marketCampaigns = rows.filter(r => r.market === id)

    const byPlatform: Record<string, MarketPlatformRow> = {}
    for (const r of marketCampaigns) {
      if (!byPlatform[r.platform]) {
        byPlatform[r.platform] = { platform: r.platform, totalSpend: 0, leads: 0, deals: 0, dealValueClosed: null }
      }
      const agg = byPlatform[r.platform]
      agg.totalSpend += r.totalSpend
      agg.leads      += r.contacts
      agg.deals      += r.deals
      if (r.dealValueClosed !== null) agg.dealValueClosed = (agg.dealValueClosed ?? 0) + r.dealValueClosed
    }

    return {
      id,
      market: MARKET_LABEL[id],
      currency: MARKET_CURRENCY[id],
      rows: Object.values(byPlatform),
      campaigns: marketCampaigns,
    }
  })

  return { markets, generatedAt: new Date().toISOString() }
}
