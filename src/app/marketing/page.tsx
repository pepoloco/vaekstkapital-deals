'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { MarketOverview, PlatformRow, CampaignRow as StaticCampaignRow } from '@/data/marketing-platform-data'
import { PLATFORM_DATA_2025, PLATFORM_DATA_2026 } from '@/data/marketing-platform-data'

const ALLOWED_DOMAINS = new Set(['vkfunddistribution.com', 'vaekstholdings.com'])

function canAccess(email?: string | null): boolean {
  if (!email) return false
  const domain = email.toLowerCase().split('@')[1] ?? ''
  return ALLOWED_DOMAINS.has(domain)
}

// ── Live sync data types (mirrors src/lib/marketing-sync.ts output) ─────────

interface LiveCampaignRow {
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
  adPlatforms: string[]
}

interface LivePlatformRow {
  platform: string
  totalSpend: number
  leads: number
  deals: number
  dealValueClosed: number | null
}

interface LiveMarketSync {
  id: string
  market: string
  currency: string
  rows: LivePlatformRow[]
  campaigns: LiveCampaignRow[]
}

interface MarketingSyncResult {
  markets: LiveMarketSync[]
  generatedAt: string
}

// ── Design tokens (HubSpot palette) ─────────────────────────────────────────

const T = {
  bg:          '#f5f8fa',
  white:       '#ffffff',
  border:      '#dfe3eb',
  borderLight: '#eaf0fb',
  teal:        '#0091ae',
  dark:        '#33475b',
  mid:         '#516f90',
  muted:       '#99acc2',
  rowHover:    '#f5f8fa',
  totalBg:     '#fafbfc',
  headerBg:    '#f5f8fa',
}

// ── Currency formatter ───────────────────────────────────────────────────────

function fmtCurrency(n: number, currency: string): string {
  const locale = currency === 'SEK' || currency === 'NOK' ? 'nb-NO' : 'da-DK'
  return `${currency} ${n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtInt(n: number): string {
  return n.toLocaleString('da-DK')
}

// ── Column definitions ───────────────────────────────────────────────────────

type SortKey = keyof PlatformRow

interface Column {
  key: SortKey
  label: string
  tooltip?: string
  align: 'left' | 'right'
}

const COLUMNS: Column[] = [
  { key: 'platform',        label: 'Platform',          align: 'left'  },
  { key: 'totalSpend',      label: 'Total Spend',       tooltip: 'Total ad spend on this platform',           align: 'right' },
  { key: 'leads',           label: '# Leads',           tooltip: 'Contacts created via this platform',        align: 'right' },
  { key: 'gradeD',          label: '# Grade D+',        tooltip: 'Contacts scored Grade D or higher',         align: 'right' },
  { key: 'deals',           label: '# Deals',           align: 'right' },
  { key: 'dealValueClosed', label: 'Deal Value Closed', align: 'right' },
]

// ── SortIcon ─────────────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span style={{ fontSize: 9, marginLeft: 4, color: active ? T.teal : T.muted, verticalAlign: 'middle' }}>
      {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  )
}

// ── MarketTable ───────────────────────────────────────────────────────────────

function MarketTable({ data }: { data: MarketOverview }) {
  const [sortKey, setSortKey] = useState<SortKey>('platform')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...data.rows].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    if (typeof av === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  const total: PlatformRow & { platform: string } = {
    platform:        'Report Total' as PlatformRow['platform'],
    totalSpend:      data.rows.reduce((s, r) => s + r.totalSpend, 0),
    leads:           data.rows.reduce((s, r) => s + r.leads, 0),

    gradeD:          data.rows.reduce((s, r) => s + r.gradeD, 0),
    deals:           data.rows.reduce((s, r) => s + r.deals, 0),
    dealValueClosed: data.rows.some(r => r.dealValueClosed !== null)
      ? data.rows.reduce((s, r) => s + (r.dealValueClosed ?? 0), 0)
      : null,
  }

  const cellVal = (row: PlatformRow, col: Column): string => {
    const v = row[col.key]
    if (col.key === 'platform') return row.platform
    if (col.key === 'totalSpend') return fmtCurrency(v as number, data.currency)
    if (col.key === 'dealValueClosed') return v !== null ? fmtCurrency(v as number, data.currency) : '—'
    return fmtInt(v as number)
  }

  const cellColor = (row: PlatformRow, col: Column, isTotal: boolean): string => {
    if (isTotal || col.key === 'platform') return T.dark
    const v = row[col.key]
    if (v === null || v === 0) return col.key === 'dealValueClosed' ? T.muted : T.dark
    return T.teal
  }

  const thS = (col: Column): React.CSSProperties => ({
    padding: '8px 16px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '.05em',
    textTransform: 'uppercase',
    color: T.mid,
    textAlign: col.align,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    borderBottom: `1px solid ${T.border}`,
    background: T.headerBg,
    userSelect: 'none',
  })

  const tdS = (align: 'left' | 'right', bold = false): React.CSSProperties => ({
    padding: '10px 16px',
    fontSize: 13,
    textAlign: align,
    fontWeight: bold ? 700 : 400,
    whiteSpace: 'nowrap',
    borderBottom: `1px solid ${T.borderLight}`,
  })

  return (
    <div style={{
      background: T.white,
      border: `1px solid ${T.border}`,
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 24,
      boxShadow: '0 1px 4px rgba(45,62,80,.06)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', borderBottom: `1px solid ${T.borderLight}`,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.dark }}>
          Marketing Overview — {data.market}
        </span>
        <span style={{ fontSize: 12, color: T.muted }}>{data.currency}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {COLUMNS.map(col => (
                <th key={col.key} style={thS(col)} onClick={() => handleSort(col.key)}>
                  {col.label}
                  {col.tooltip && (
                    <span style={{ fontSize: 10, color: T.muted, marginLeft: 3, cursor: 'help' }}
                      title={col.tooltip}>ⓘ</span>
                  )}
                  <SortIcon active={sortKey === col.key} dir={sortDir} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr key={row.platform}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.rowHover }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                {COLUMNS.map(col => (
                  <td key={col.key} style={{ ...tdS(col.align), color: cellColor(row, col, false) }}>
                    {cellVal(row, col)}
                  </td>
                ))}
              </tr>
            ))}
            <tr style={{ background: T.totalBg, borderTop: `2px solid ${T.border}` }}>
              {COLUMNS.map(col => (
                <td key={col.key} style={{ ...tdS(col.align, true), color: T.dark, borderBottom: 'none' }}>
                  {cellVal(total as unknown as PlatformRow, col)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── CampaignBreakdownTable (Austria) ─────────────────────────────────────────

const CAM_COLS: { key: string; label: string; tooltip?: string; align: 'left' | 'right' }[] = [
  { key: 'platform',        label: 'Platform',          align: 'left'  },
  { key: 'campaignName',    label: 'Campaign',          align: 'left'  },
  { key: 'totalSpend',      label: 'Total Spend',       align: 'right' },
  { key: 'contacts',        label: '# Contacts',        tooltip: 'New contacts created via this campaign', align: 'right' },
  { key: 'costPerContact',  label: 'Cost / Contact',    align: 'right' },
  { key: 'gradeD',          label: '# Grade D+',        tooltip: 'Contacts scored Grade D or higher',      align: 'right' },
  { key: 'deals',           label: '# Deals',           align: 'right' },
  { key: 'costPerDeal',     label: 'Cost / Deal',       align: 'right' },
  { key: 'dealValueClosed', label: 'Deal Value Closed', align: 'right' },
]

function CampaignBreakdownTable({ data }: { data: MarketOverview }) {
  const campaigns = data.campaigns!
  const platforms = [...new Set(campaigns.map(c => c.platform))]
  const costCur = data.costCurrency ?? data.currency
  const costRate = data.costConversionRate ?? 1

  const thS: React.CSSProperties = {
    padding: '8px 16px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '.05em',
    textTransform: 'uppercase',
    color: T.mid,
    whiteSpace: 'nowrap',
    borderBottom: `1px solid ${T.border}`,
    background: T.headerBg,
  }

  const tdS = (align: 'left' | 'right', bold = false, color = T.dark): React.CSSProperties => ({
    padding: '10px 16px',
    fontSize: 13,
    textAlign: align,
    fontWeight: bold ? 700 : 400,
    whiteSpace: 'nowrap',
    color,
    borderBottom: `1px solid ${T.borderLight}`,
  })

  function fmt(val: number | null, key: string): string {
    if (key === 'campaignName') return ''
    if (key === 'totalSpend' || key === 'dealValueClosed') {
      return val !== null ? fmtCurrency(val, data.currency) : '—'
    }
    if (key === 'costPerContact' || key === 'costPerDeal') {
      return val !== null ? fmtCurrency(val, costCur) : '—'
    }
    return val !== null ? fmtInt(val) : '—'
  }

  function cellColor(val: number | null, key: string): string {
    if (key === 'campaignName') return T.dark
    if (val === null || val === 0) return key === 'dealValueClosed' || key === 'costPerContact' || key === 'costPerDeal' ? T.muted : T.dark
    return T.teal
  }

  return (
    <div style={{
      background: T.white,
      border: `1px solid ${T.border}`,
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 24,
      boxShadow: '0 1px 4px rgba(45,62,80,.06)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', borderBottom: `1px solid ${T.borderLight}`,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.dark }}>
          Marketing Overview — {data.market}
        </span>
        <span style={{ fontSize: 12, color: T.muted }}>{data.currency}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {CAM_COLS.map(col => (
                <th key={col.key} style={{ ...thS, textAlign: col.align }}>
                  {col.label}
                  {col.tooltip && (
                    <span style={{ fontSize: 10, color: T.muted, marginLeft: 3, cursor: 'help' }}
                      title={col.tooltip}>ⓘ</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {platforms.map(platform => {
              const rows: StaticCampaignRow[] = campaigns.filter(c => c.platform === platform)

              const totSpend    = rows.reduce((s, r) => s + r.totalSpend, 0)
              const totContacts = rows.reduce((s, r) => s + r.contacts, 0)
              const totGradeD   = rows.reduce((s, r) => s + r.gradeD, 0)
              const totDeals    = rows.reduce((s, r) => s + r.deals, 0)
              const totValue    = rows.some(r => r.dealValueClosed !== null)
                ? rows.reduce((s, r) => s + (r.dealValueClosed ?? 0), 0)
                : null
              const totCPC = totContacts > 0 ? (totSpend * costRate) / totContacts : null
              const totCPD = totDeals    > 0 ? (totSpend * costRate) / totDeals    : null

              const totVals: Record<string, number | null> = {
                totalSpend: totSpend, contacts: totContacts, gradeD: totGradeD,
                deals: totDeals, costPerContact: totCPC, costPerDeal: totCPD,
                dealValueClosed: totValue,
              }

              return (
                <React.Fragment key={platform}>
                  {/* Campaign rows — platform cell spans all rows via rowspan */}
                  {rows.map((row, rowIdx) => {
                    const cpc = row.contacts > 0 ? (row.totalSpend * costRate) / row.contacts : null
                    const cpd = row.deals    > 0 ? (row.totalSpend * costRate) / row.deals    : null

                    const vals: Record<string, number | null> = {
                      totalSpend:      row.totalSpend,
                      contacts:        row.contacts,
                      gradeD:          row.gradeD,
                      deals:           row.deals,
                      costPerContact:  cpc,
                      costPerDeal:     cpd,
                      dealValueClosed: row.dealValueClosed,
                    }

                    return (
                      <tr key={row.campaignName}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.rowHover }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                        {rowIdx === 0 && (
                          <td rowSpan={rows.length} style={{
                            padding: '10px 16px',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '.06em',
                            textTransform: 'uppercase',
                            color: T.teal,
                            verticalAlign: 'middle',
                            borderBottom: `1px solid ${T.border}`,
                            borderLeft: `3px solid ${T.teal}`,
                            whiteSpace: 'nowrap',
                          }}>
                            {platform}
                          </td>
                        )}
                        {CAM_COLS.filter(col => col.key !== 'platform').map(col => (
                          <td key={col.key} style={tdS(col.align, false, col.key === 'campaignName' ? T.dark : cellColor(vals[col.key] ?? null, col.key))}>
                            {col.key === 'campaignName'
                              ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {row.campaignName}
                                  <span style={{
                                    fontSize: 10, fontWeight: 600, letterSpacing: '.04em',
                                    padding: '2px 7px', borderRadius: 10,
                                    background: row.status === 'Active' ? 'rgba(0,164,91,.12)' : 'rgba(153,172,194,.18)',
                                    color: row.status === 'Active' ? '#00a45b' : T.muted,
                                  }}>
                                    {row.status}
                                  </span>
                                </span>
                              )
                              : fmt(vals[col.key] ?? null, col.key)}
                          </td>
                        ))}
                      </tr>
                    )
                  })}

                  {/* Platform total */}
                  <tr style={{ background: T.totalBg, borderTop: `2px solid ${T.border}` }}>
                    <td colSpan={2} style={{ ...tdS('left', true), borderBottom: 'none', color: T.dark, borderLeft: `3px solid ${T.teal}` }}>
                      {platform} Total
                    </td>
                    {CAM_COLS.filter(col => col.key !== 'platform' && col.key !== 'campaignName').map(col => (
                      <td key={col.key} style={{ ...tdS(col.align, true), borderBottom: 'none' }}>
                        {fmt(totVals[col.key] ?? null, col.key)}
                      </td>
                    ))}
                  </tr>
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Live sync tables ──────────────────────────────────────────────────────────

function LiveMarketTable({ data }: { data: LiveMarketSync }) {
  if (data.rows.length === 0) return null

  const total: LivePlatformRow = {
    platform:        'Report Total',
    totalSpend:      data.rows.reduce((s, r) => s + r.totalSpend, 0),
    leads:           data.rows.reduce((s, r) => s + r.leads, 0),
    deals:           data.rows.reduce((s, r) => s + r.deals, 0),
    dealValueClosed: data.rows.some(r => r.dealValueClosed !== null)
      ? data.rows.reduce((s, r) => s + (r.dealValueClosed ?? 0), 0)
      : null,
  }

  const cols: { key: keyof LivePlatformRow; label: string; align: 'left' | 'right' }[] = [
    { key: 'platform',        label: 'Platform',          align: 'left'  },
    { key: 'totalSpend',      label: 'Total Spend',       align: 'right' },
    { key: 'leads',           label: '# Contacts',        align: 'right' },
    { key: 'deals',           label: '# Deals',           align: 'right' },
    { key: 'dealValueClosed', label: 'Deal Value Closed', align: 'right' },
  ]

  const cellVal = (row: LivePlatformRow, key: keyof LivePlatformRow): string => {
    const v = row[key]
    if (key === 'platform') return row.platform
    if (key === 'totalSpend') return fmtCurrency(v as number, data.currency)
    if (key === 'dealValueClosed') return v !== null ? fmtCurrency(v as number, data.currency) : '—'
    return fmtInt(v as number)
  }

  const thS: React.CSSProperties = {
    padding: '8px 16px', fontSize: 11, fontWeight: 600, letterSpacing: '.05em',
    textTransform: 'uppercase', color: T.mid, whiteSpace: 'nowrap',
    borderBottom: `1px solid ${T.border}`, background: T.headerBg,
  }
  const tdS = (align: 'left' | 'right', bold = false): React.CSSProperties => ({
    padding: '10px 16px', fontSize: 13, textAlign: align, fontWeight: bold ? 700 : 400,
    whiteSpace: 'nowrap', borderBottom: `1px solid ${T.borderLight}`,
  })

  return (
    <div style={{
      background: T.white, border: `1px solid ${T.border}`, borderRadius: 6,
      overflow: 'hidden', marginBottom: 16, boxShadow: '0 1px 4px rgba(45,62,80,.06)',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.borderLight}`, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.dark }}>Live — {data.market}</span>
        <span style={{ fontSize: 12, color: T.muted }}>{data.currency}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{cols.map(c => <th key={c.key} style={{ ...thS, textAlign: c.align }}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {data.rows.map(row => (
              <tr key={row.platform}>
                {cols.map(c => <td key={c.key} style={{ ...tdS(c.align), color: c.key === 'platform' ? T.dark : T.teal }}>{cellVal(row, c.key)}</td>)}
              </tr>
            ))}
            <tr style={{ background: T.totalBg, borderTop: `2px solid ${T.border}` }}>
              {cols.map(c => <td key={c.key} style={{ ...tdS(c.align, true), borderBottom: 'none' }}>{cellVal(total, c.key)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LiveCampaignTable({ data }: { data: LiveMarketSync }) {
  if (data.campaigns.length === 0) return null

  const cols: { key: string; label: string; align: 'left' | 'right' }[] = [
    { key: 'platform',        label: 'Platform',          align: 'left'  },
    { key: 'campaignName',    label: 'Campaign',          align: 'left'  },
    { key: 'totalSpend',      label: 'Total Spend',       align: 'right' },
    { key: 'contacts',        label: '# Contacts',        align: 'right' },
    { key: 'deals',           label: '# Deals',           align: 'right' },
    { key: 'dealValueClosed', label: 'Deal Value Closed', align: 'right' },
  ]

  const thS: React.CSSProperties = {
    padding: '8px 16px', fontSize: 11, fontWeight: 600, letterSpacing: '.05em',
    textTransform: 'uppercase', color: T.mid, whiteSpace: 'nowrap',
    borderBottom: `1px solid ${T.border}`, background: T.headerBg,
  }
  const tdS: React.CSSProperties = {
    padding: '10px 16px', fontSize: 13, whiteSpace: 'nowrap', borderBottom: `1px solid ${T.borderLight}`,
  }

  return (
    <div style={{
      background: T.white, border: `1px solid ${T.border}`, borderRadius: 6,
      overflow: 'hidden', marginBottom: 24, boxShadow: '0 1px 4px rgba(45,62,80,.06)',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.borderLight}` }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.dark }}>Live Campaigns — {data.market}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{cols.map(c => <th key={c.key} style={{ ...thS, textAlign: c.align }}>{c.label}</th>)}</tr></thead>
          <tbody>
            {data.campaigns.map((c, i) => (
              <tr key={c.campaignName + i}>
                <td style={{ ...tdS, color: T.teal, fontWeight: 600 }}>{c.platform}</td>
                <td style={{ ...tdS, color: T.dark }}>{c.campaignName}</td>
                <td style={{ ...tdS, textAlign: 'right' }}>{fmtCurrency(c.totalSpend, c.currency)}</td>
                <td style={{ ...tdS, textAlign: 'right', color: T.teal }}>{fmtInt(c.contacts)}</td>
                <td style={{ ...tdS, textAlign: 'right', color: T.teal }}>{fmtInt(c.deals)}</td>
                <td style={{ ...tdS, textAlign: 'right' }}>{c.dealValueClosed !== null ? fmtCurrency(c.dealValueClosed, c.currency) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Live Quarter Section (generic — used for AT, DK, SE, etc.) ───────────────

function LiveQuarterSection({ marketId, liveData }: { marketId: string; liveData: MarketingSyncResult }) {
  const market = liveData.markets.find(m => m.id === marketId)
  if (!market || market.campaigns.length === 0) return null

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  function quarterKey(name: string): string {
    const m = name.match(/Q(\d)\s*(\d{4})/i)
    return m ? `Q${m[1]} ${m[2]}` : 'Other'
  }

  const quarterMap = new Map<string, LiveCampaignRow[]>()
  for (const c of market.campaigns) {
    const k = quarterKey(c.campaignName)
    if (!quarterMap.has(k)) quarterMap.set(k, [])
    quarterMap.get(k)!.push(c)
  }

  const quarters = [...quarterMap.keys()].sort((a, b) => {
    const parse = (q: string) => { const m = q.match(/Q(\d)\s*(\d{4})/); return m ? +m[2] * 4 + +m[1] : 0 }
    return parse(a) - parse(b)
  })

  const thS: React.CSSProperties = {
    padding: '8px 16px', fontSize: 11, fontWeight: 600, letterSpacing: '.05em',
    textTransform: 'uppercase', color: T.mid, whiteSpace: 'nowrap',
    borderBottom: `1px solid ${T.border}`, background: T.headerBg,
  }
  const tdS = (align: 'left' | 'right', bold = false): React.CSSProperties => ({
    padding: '10px 16px', fontSize: 13, textAlign: align, fontWeight: bold ? 700 : 400,
    whiteSpace: 'nowrap', borderBottom: `1px solid ${T.borderLight}`,
  })

  const allCampaigns = market.campaigns
  const currency = allCampaigns[0].currency
  const isActiveAll = allCampaigns.some(c => c.status === 'Active')
  const startDateAll = allCampaigns.reduce<string | null>((b, c) => !b ? c.startDate : !c.startDate ? b : c.startDate < b ? c.startDate : b, null)
  const endDateAll   = allCampaigns.reduce<string | null>((b, c) => !b ? c.endDate   : !c.endDate   ? b : c.endDate   > b ? c.endDate   : b, null)

  return (
    <div style={{
      background: T.white, border: `1px solid ${T.border}`, borderRadius: 6,
      overflow: 'hidden', marginBottom: 24, boxShadow: '0 1px 4px rgba(45,62,80,.06)',
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: `1px solid ${T.borderLight}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.dark }}>Live — {market.market}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '.04em', padding: '2px 8px', borderRadius: 10,
            background: isActiveAll ? 'rgba(0,164,91,.12)' : 'rgba(153,172,194,.18)',
            color: isActiveAll ? '#00a45b' : T.muted,
          }}>
            {isActiveAll ? 'Active' : 'Paused'}
          </span>
          {(startDateAll || endDateAll) && (
            <span style={{ fontSize: 12, color: T.muted }}>
              {fmtDate(startDateAll)} → {fmtDate(endDateAll)}
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: T.muted }}>{currency}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thS, textAlign: 'left' }}>Quarter</th>
              <th style={{ ...thS, textAlign: 'left' }}>Platform</th>
              <th style={{ ...thS, textAlign: 'left' }}>Campaign</th>
              <th style={{ ...thS, textAlign: 'right' }}>Total Spend</th>
              <th style={{ ...thS, textAlign: 'right' }}># Contacts</th>
              <th style={{ ...thS, textAlign: 'right' }}># Deals</th>
              <th style={{ ...thS, textAlign: 'right' }}>Deal Value Closed</th>
            </tr>
          </thead>
          <tbody>
            {quarters.map(quarter => {
              const qc = quarterMap.get(quarter)!
              const totSpend    = qc.reduce((s, c) => s + c.totalSpend, 0)
              const totContacts = qc.reduce((s, c) => s + c.contacts, 0)
              const totDeals    = qc.reduce((s, c) => s + c.deals, 0)
              const totValue    = qc.some(c => c.dealValueClosed !== null)
                ? qc.reduce((s, c) => s + (c.dealValueClosed ?? 0), 0) : null

              return (
                <React.Fragment key={quarter}>
                  {qc.map((c, rowIdx) => (
                    <tr key={c.campaignName + rowIdx}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.rowHover }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                      {rowIdx === 0 && (
                        <td rowSpan={qc.length} style={{
                          padding: '10px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
                          textTransform: 'uppercase', color: T.teal, verticalAlign: 'middle',
                          borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${T.teal}`,
                          whiteSpace: 'nowrap',
                        }}>
                          {quarter}
                        </td>
                      )}
                      <td style={{ ...tdS('left'), color: T.mid }}>{c.platform}</td>
                      <td style={tdS('left')}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {c.hsUrl
                            ? <a href={c.hsUrl} target="_blank" rel="noreferrer"
                                style={{ color: T.dark, textDecoration: 'none', borderBottom: `1px solid ${T.borderLight}` }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.teal }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.dark }}>
                                {c.campaignName}
                              </a>
                            : <span style={{ color: T.dark }}>{c.campaignName}</span>
                          }
                          <span style={{
                            fontSize: 10, fontWeight: 600, letterSpacing: '.04em', padding: '2px 7px', borderRadius: 10,
                            background: c.status === 'Active' ? 'rgba(0,164,91,.12)' : 'rgba(153,172,194,.18)',
                            color: c.status === 'Active' ? '#00a45b' : T.muted,
                          }}>
                            {c.status}
                          </span>
                        </span>
                      </td>
                      <td style={{ ...tdS('right'), color: c.totalSpend > 0 ? T.teal : T.muted }}>
                        {fmtCurrency(c.totalSpend, currency)}
                      </td>
                      <td style={{ ...tdS('right'), color: c.contacts > 0 ? T.teal : T.muted }}>
                        {fmtInt(c.contacts)}
                      </td>
                      <td style={{ ...tdS('right'), color: c.deals > 0 ? T.teal : T.muted }}>
                        {fmtInt(c.deals)}
                      </td>
                      <td style={{ ...tdS('right'), color: T.muted }}>
                        {c.dealValueClosed !== null ? fmtCurrency(c.dealValueClosed, currency) : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: T.totalBg, borderTop: `2px solid ${T.border}` }}>
                    <td colSpan={3} style={{ ...tdS('left', true), borderBottom: 'none', color: T.dark, borderLeft: `3px solid ${T.teal}` }}>
                      {quarter} Total
                    </td>
                    <td style={{ ...tdS('right', true), borderBottom: 'none' }}>{fmtCurrency(totSpend, currency)}</td>
                    <td style={{ ...tdS('right', true), borderBottom: 'none' }}>{fmtInt(totContacts)}</td>
                    <td style={{ ...tdS('right', true), borderBottom: 'none' }}>{fmtInt(totDeals)}</td>
                    <td style={{ ...tdS('right', true), borderBottom: 'none' }}>
                      {totValue !== null ? fmtCurrency(totValue, currency) : '—'}
                    </td>
                  </tr>
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Year = '2025' | '2026'

const YEAR_META: Record<Year, { label: string; range: string; data: MarketOverview[] }> = {
  '2025': { label: '2025', range: '1 Jan 2025 – 31 Dec 2025', data: PLATFORM_DATA_2025 },
  '2026': { label: '2026', range: '1 Jan 2026 – 10 Jun 2026', data: PLATFORM_DATA_2026 },
}

export default function MarketingDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [year, setYear] = useState<Year>('2026')

  const [liveData, setLiveData] = useState<MarketingSyncResult | null>(null)
  const [liveLoading, setLiveLoading] = useState(true)
  const [liveSyncing, setLiveSyncing] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && !canAccess(session?.user?.email)) router.push('/')
  }, [status, session, router])

  async function loadLiveData() {
    setLiveLoading(true)
    setLiveError(null)
    try {
      const res = await fetch('/api/marketing-data')
      if (res.status === 404) { setLiveData(null); return }
      const json = await res.json()
      if (json.error) { setLiveError(json.error); return }
      setLiveData(json)
    } catch (e: any) {
      setLiveError(e.message)
    } finally {
      setLiveLoading(false)
    }
  }

  async function runLiveSync() {
    setLiveSyncing(true)
    setLiveError(null)
    try {
      const res = await fetch('/api/marketing-sync', { method: 'POST' })
      const json = await res.json()
      if (json.error) { setLiveError(json.error); return }
      await loadLiveData()
    } catch (e: any) {
      setLiveError(e.message)
    } finally {
      setLiveSyncing(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated' && canAccess(session?.user?.email)) loadLiveData()
  }, [status])

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: T.muted, fontFamily: 'Space Grotesk, sans-serif' }}>
        Loading…
      </div>
    )
  }

  if (!canAccess(session?.user?.email)) return null

  const { range, data } = YEAR_META[year]

  return (
    <>
      <nav style={{
        background: '#121428', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <a href="/" style={{
            fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.45)',
            letterSpacing: '.06em', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 6,
            borderRight: '1px solid rgba(255,255,255,.1)', paddingRight: 18,
          }}>
            ← Dashboard
          </a>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
            Marketing Reports
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.28)' }}>
          {session?.user?.email}
        </span>
      </nav>

      <div style={{ background: T.bg, minHeight: 'calc(100vh - 54px)' }}>
        <main style={{ maxWidth: 1440, margin: '0 auto', padding: '28px 40px 60px' }}>

          {/* Year tabs */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: `2px solid ${T.border}` }}>
              {(['2025', '2026'] as Year[]).map(y => {
                const active = y === year
                return (
                  <button
                    key={y}
                    onClick={() => setYear(y)}
                    style={{
                      padding: '10px 24px',
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      color: active ? T.teal : T.mid,
                      background: 'none',
                      border: 'none',
                      borderBottom: active ? `2px solid ${T.teal}` : '2px solid transparent',
                      marginBottom: -2,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      letterSpacing: '.01em',
                      transition: 'color .15s',
                    }}
                  >
                    {YEAR_META[y].label}
                  </button>
                )
              })}
            </div>
            <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12, color: T.muted }}>
              {range}
            </p>
          </div>

          {year === '2025' && data.map(market =>
            market.campaigns
              ? <CampaignBreakdownTable key={`${year}-${market.id}`} data={market} />
              : <MarketTable           key={`${year}-${market.id}`} data={market} />
          )}

          {/* ── Live HubSpot sync — 2026 only (Contacts/Deals/Value only — Spend manual, Grade D+ unavailable) ── */}
          {year === '2026' && <>
          <div style={{ marginTop: 44, marginBottom: 16, paddingTop: 28, borderTop: `2px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: T.dark, margin: 0 }}>Live Campaign Sync</h2>
                <p style={{ fontSize: 12, color: T.muted, margin: '4px 0 0' }}>
                  Pulled live from HubSpot Campaigns (Contacts/Deals/Value) · Total Spend is manually entered in HubSpot ·
                  Most ad campaigns aren't linked to this hierarchy yet, so coverage is currently partial
                  {liveData && <> · Last synced: {new Date(liveData.generatedAt).toLocaleString('en-GB')}</>}
                </p>
              </div>
              <button onClick={runLiveSync} disabled={liveSyncing}
                style={{
                  padding: '9px 20px', borderRadius: 6, border: 'none', background: T.teal, color: '#fff',
                  fontSize: 13, fontWeight: 600, cursor: liveSyncing ? 'default' : 'pointer', fontFamily: 'inherit',
                  opacity: liveSyncing ? 0.7 : 1,
                }}>
                {liveSyncing ? 'Syncing…' : 'Sync now'}
              </button>
            </div>
          </div>

          {liveError && (
            <div style={{
              padding: '14px 18px', borderRadius: 6, background: 'rgba(255,122,76,.1)',
              border: '1px solid rgba(255,122,76,.3)', color: '#c0392b', fontSize: 13, marginBottom: 20,
            }}>
              ⚠ {liveError}
            </div>
          )}

          {liveLoading && (
            <div style={{ padding: 24, textAlign: 'center', color: T.muted, fontSize: 13 }}>Loading live data…</div>
          )}

          {!liveLoading && !liveData && !liveError && (
            <div style={{ padding: 24, textAlign: 'center', color: T.muted, fontSize: 13 }}>
              No live data synced yet — click "Sync now".
            </div>
          )}

          {liveData && liveData.markets
            .filter(m => m.id !== 'at' && m.id !== 'se' && m.id !== 'dk')
            .map(market => (
              <React.Fragment key={market.id}>
                <LiveMarketTable data={market} />
                <LiveCampaignTable data={market} />
              </React.Fragment>
            ))
          }
          {liveData && <LiveQuarterSection marketId="dk" liveData={liveData} />}
          {liveData && <LiveQuarterSection marketId="se" liveData={liveData} />}
          {liveData && <LiveQuarterSection marketId="at" liveData={liveData} />}
          </>}
        </main>
      </div>
    </>
  )
}
