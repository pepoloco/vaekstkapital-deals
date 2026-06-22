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

// Prefix used in hs_analytics_source_data_2 for each market's paid social campaigns
// HubSpot stores the Meta/LinkedIn ad campaign name here, and all market-specific campaigns
// follow the "BU XX" naming convention (e.g. "bu at - s: direct", "bu se - 150126 ...").
const MARKET_BU_PREFIX: Record<string, string> = {
  dk: "BU DK", se: "BU SE", at: "BU AT", fi: "BU FI", no: "BU NO",
}

const PLATFORMS = ["Google", "LinkedIn", "Meta"] as const
type Platform = typeof PLATFORMS[number] | "Multi-Platform"

const HS_PORTAL_ID = "144061788"

function detectPlatforms(assetNames: string[]): string[] {
  const found = new Set<string>()
  for (const name of assetNames) {
    const lower = name.toLowerCase()
    if (lower.includes('google')) found.add('Google')
    if (lower.includes('linkedin')) found.add('LinkedIn')
    // HubSpot surfaces Meta campaigns as "Facebook Lead Ads: …" or just "Meta"
    if (lower.includes('meta') || lower.includes('facebook') || lower.includes('instagram')) found.add('Meta')
  }
  return [...found]
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

async function hsPost(path: string, body: unknown, attempt = 0): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  if (res.status === 429 && attempt < 5) { await sleep(1500 * (attempt + 1)); return hsPost(path, body, attempt + 1) }
  if (!res.ok) {
    if (res.status === 404) return null
    const bodyText = await res.text().catch(() => "")
    throw new Error(`POST ${path} -> ${res.status}: ${bodyText.slice(0, 300)}`)
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
  startDate: string | null
  endDate: string | null
  hsUrl: string
  adPlatforms: string[]   // individual platforms detected from ad assets
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

  // Only campaigns tied to a tracked market AND starting in 2026 (live sync is only used for the 2026 tab)
  const candidates = allCampaigns.filter(c => {
    if (!BUSINESS_UNIT_MARKET[String(c.businessUnits?.[0]?.id ?? "")]) return false
    const startDate = c.properties?.hs_start_date ?? ''
    return startDate >= '2026-01-01'
  })

  const fetched = await mapConcurrent(candidates, 10, async (c) => {
    const market = BUSINESS_UNIT_MARKET[String(c.businessUnits?.[0]?.id ?? "")]
    const detail = await hsGet(`/marketing/v3/campaigns/${c.id}`)
    const adAssets: { name: string }[] = detail?.assets?.AD_CAMPAIGN?.results ?? []
    if (adAssets.length === 0) return null // no linked ad campaigns → skip

    // Detect platform from: asset type keys (e.g. FACEBOOK_AD_CAMPAIGN), asset names, campaign name.
    // HubSpot sometimes groups assets under platform-specific type keys — check those first.
    const assetTypeKeys = Object.keys(detail?.assets ?? {})
    const platformsFromTypeKeys = detectPlatforms(assetTypeKeys)

    const campaignName: string = c.properties?.hs_name ?? ""
    const adPlatforms = platformsFromTypeKeys.length > 0
      ? platformsFromTypeKeys
      : detectPlatforms([...adAssets.map((a: any) => a.name ?? ''), campaignName])

    // Known market-platform defaults: some markets only run on one platform and
    // their campaign/asset names don't embed platform keywords.
    const MARKET_PLATFORM_DEFAULT: Record<string, string> = { at: "Meta" }

    const platform = adPlatforms.length === 0
      ? (MARKET_PLATFORM_DEFAULT[market] ?? "Other")
      : adPlatforms.length > 1
      ? "Multi-Platform"
      : adPlatforms[0] as Platform

    const revenue = await hsGet(`/marketing/v3/campaigns/${c.id}/reports/revenue`)
    let contacts: number = revenue?.contactsNumber ?? 0
    let deals:    number = revenue?.dealsNumber    ?? 0
    let dealValueClosed: number | null = revenue?.revenueAmount ?? null

    // Revenue endpoint uses strict campaign attribution that may not be configured for all markets.
    // For contacts: try the HubSpot Ads Analytics API (matches what Ads Manager shows — contacts
    // attributed to each linked Meta/LinkedIn/Google ad campaign).
    if (contacts === 0 && adAssets.length > 0) {
      const startDate = c.properties?.hs_start_date?.slice(0, 10) ?? "2026-01-01"
      const endDate   = new Date().toISOString().slice(0, 10)

      // Sum contacts across all linked ad campaigns via the Ads Analytics v3 endpoint
      let adsContacts = 0
      for (const asset of adAssets as any[]) {
        if (!asset.id) continue
        const adsData = await hsGet(
          `/ads/v3/analytics/by-time?portalId=${HS_PORTAL_ID}&adCampaignId=${asset.id}&startDate=${startDate}&endDate=${endDate}&dateRange=CUSTOM&breakdownBy=CAMPAIGN&metrics=CONTACTS_NEW`
        )
        const assetContacts = adsData?.metrics?.find?.((m: any) => m.key === "CONTACTS_NEW")?.value
          ?? adsData?.breakdown?.[0]?.metrics?.CONTACTS_NEW
          ?? adsData?.results?.reduce?.((s: number, r: any) => s + (r.CONTACTS_NEW ?? r.contacts ?? 0), 0)
        if (assetContacts) adsContacts += assetContacts
      }

      // Fall back: contacts-by-type "influenced" (any engagement with this marketing campaign)
      if (adsContacts === 0) {
        const byType = await hsGet(
          `/marketing/v3/campaigns/${c.id}/contacts/by-type?contactType=INFLUENCED_CONTACTS&limit=1`
        )
        if (byType?.total) adsContacts = byType.total
      }

      if (adsContacts > 0) contacts = adsContacts

      // Last resort: CRM contact search by ad campaign attribution.
      // HubSpot stores the Meta/LinkedIn ad campaign name in hs_analytics_source_data_2,
      // so filtering by the market's "BU XX" prefix reliably counts new contacts from
      // market-specific paid social campaigns within the campaign date window.
      if (contacts === 0) {
        const buPrefix = MARKET_BU_PREFIX[market]
        if (buPrefix) {
          const startTs = c.properties?.hs_start_date
            ? new Date(c.properties.hs_start_date).getTime()
            : null
          const endTs = c.properties?.hs_end_date
            ? new Date(c.properties.hs_end_date).getTime()
            : Date.now()
          const dateFilters: any[] = []
          if (startTs) dateFilters.push({ propertyName: 'createdate', operator: 'GTE', value: String(startTs) })
          dateFilters.push({ propertyName: 'createdate', operator: 'LTE', value: String(endTs) })

          const filterGroups: any[] = [
            { filters: [
              { propertyName: 'hs_analytics_source_data_2', operator: 'CONTAINS_TOKEN', value: buPrefix },
              ...dateFilters,
            ]},
          ]

          // AT also has cross-market campaigns (e.g. "General about Vaekstkapital") that attract
          // Austrian contacts without "BU AT" in the campaign name.
          // Supplement with a country-based filter for paid social to catch those.
          if (market === 'at') {
            filterGroups.push({ filters: [
              { propertyName: 'hs_analytics_source', operator: 'EQ', value: 'PAID_SOCIAL' },
              { propertyName: 'country', operator: 'EQ', value: 'Austria' },
              ...dateFilters,
            ]})
          }

          const crmSearch = await hsPost('/crm/v3/objects/contacts/search', {
            filterGroups,
            properties: ['hs_object_id'],
            limit: 1,
          })
          if (crmSearch?.total) contacts = crmSearch.total
        }
      }
    }

    // HubSpot stores hs_spend_items_sum_amount in the portal's home currency (DKK),
    // even when the ad campaign runs in EUR. Convert to the market's display currency.
    const rawSpend = parseFloat(c.properties?.hs_spend_items_sum_amount) || 0
    const displayCurrency = MARKET_CURRENCY[market]
    const portalCurrency  = "DKK"  // this portal's home currency
    // Conversion rates to DKK (same rate used elsewhere in the app)
    const TO_DKK: Record<string, number> = { DKK: 1, EUR: 7.46, SEK: 0.6661, NOK: 0.6435 }
    const totalSpend = displayCurrency !== portalCurrency
      ? rawSpend / (TO_DKK[displayCurrency] ?? 1)
      : rawSpend

    const row: CampaignRow = {
      campaignName: c.properties?.hs_name ?? "(unnamed)",
      platform,
      status: c.properties?.hs_campaign_status ?? "Unknown",
      market,
      totalSpend,
      currency: displayCurrency,
      contacts,
      deals,
      dealValueClosed,
      startDate: c.properties?.hs_start_date ?? null,
      endDate: c.properties?.hs_end_date ?? null,
      hsUrl: `https://app.hubspot.com/campaigns/${HS_PORTAL_ID}/${c.id}`,
      adPlatforms,
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
