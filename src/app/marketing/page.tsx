'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { MarketOverview, PlatformRow, CampaignRow } from '@/data/marketing-platform-data'
import { PLATFORM_DATA_2025, PLATFORM_DATA_2026 } from '@/data/marketing-platform-data'

const ALLOWED_DOMAINS = new Set(['vkfunddistribution.com', 'vaekstholdings.com'])

function canAccess(email?: string | null): boolean {
  if (!email) return false
  const domain = email.toLowerCase().split('@')[1] ?? ''
  return ALLOWED_DOMAINS.has(domain)
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
  { key: 'campaignName',    label: 'Campaign',          align: 'left'  },
  { key: 'totalSpend',      label: 'Total Spend',       align: 'right' },
  { key: 'contacts',        label: '# Contacts',        tooltip: 'New contacts created via this campaign', align: 'right' },
  { key: 'gradeD',          label: '# Grade D+',        tooltip: 'Contacts scored Grade D or higher',      align: 'right' },
  { key: 'deals',           label: '# Deals',           align: 'right' },
  { key: 'costPerContact',  label: 'Cost / Contact',    align: 'right' },
  { key: 'costPerDeal',     label: 'Cost / Deal',       align: 'right' },
  { key: 'dealValueClosed', label: 'Deal Value Closed', align: 'right' },
]

function CampaignBreakdownTable({ data }: { data: MarketOverview }) {
  const campaigns = data.campaigns!
  const platforms = [...new Set(campaigns.map(c => c.platform))]

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
    if (key === 'totalSpend' || key === 'costPerContact' || key === 'costPerDeal' || key === 'dealValueClosed') {
      return val !== null ? fmtCurrency(val, data.currency) : '—'
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
              const rows: CampaignRow[] = campaigns.filter(c => c.platform === platform)

              const totSpend   = rows.reduce((s, r) => s + r.totalSpend, 0)
              const totContacts = rows.reduce((s, r) => s + r.contacts, 0)
              const totGradeD  = rows.reduce((s, r) => s + r.gradeD, 0)
              const totDeals   = rows.reduce((s, r) => s + r.deals, 0)
              const totValue   = rows.some(r => r.dealValueClosed !== null)
                ? rows.reduce((s, r) => s + (r.dealValueClosed ?? 0), 0)
                : null
              const totCPC = totContacts > 0 ? totSpend / totContacts : null
              const totCPD = totDeals    > 0 ? totSpend / totDeals    : null

              return (
                <React.Fragment key={platform}>
                  {/* Platform header */}
                  <tr style={{ background: 'rgba(0,145,174,.06)' }}>
                    <td colSpan={CAM_COLS.length} style={{
                      padding: '7px 16px',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      color: T.teal,
                      borderBottom: `1px solid ${T.borderLight}`,
                      borderLeft: `3px solid ${T.teal}`,
                    }}>
                      {platform}
                    </td>
                  </tr>

                  {/* Campaign rows */}
                  {rows.map(row => {
                    const cpc = row.contacts > 0 ? row.totalSpend / row.contacts : null
                    const cpd = row.deals    > 0 ? row.totalSpend / row.deals    : null

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
                        {CAM_COLS.map(col => (
                          <td key={col.key} style={tdS(col.align, false, col.key === 'campaignName' ? T.dark : cellColor(vals[col.key] ?? null, col.key))}>
                            {col.key === 'campaignName'
                              ? row.campaignName
                              : fmt(vals[col.key] ?? null, col.key)}
                          </td>
                        ))}
                      </tr>
                    )
                  })}

                  {/* Platform total */}
                  <tr style={{ background: T.totalBg, borderTop: `2px solid ${T.border}` }}>
                    {CAM_COLS.map(col => {
                      const totVals: Record<string, number | null> = {
                        totalSpend: totSpend, contacts: totContacts, gradeD: totGradeD,
                        deals: totDeals, costPerContact: totCPC, costPerDeal: totCPD,
                        dealValueClosed: totValue,
                      }
                      return (
                        <td key={col.key} style={{ ...tdS(col.align, true), borderBottom: 'none' }}>
                          {col.key === 'campaignName'
                            ? `${platform} Total`
                            : fmt(totVals[col.key] ?? null, col.key)}
                        </td>
                      )
                    })}
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

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && !canAccess(session?.user?.email)) router.push('/')
  }, [status, session, router])

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

          {data.map(market =>
            market.campaigns
              ? <CampaignBreakdownTable key={`${year}-${market.id}`} data={market} />
              : <MarketTable           key={`${year}-${market.id}`} data={market} />
          )}
        </main>
      </div>
    </>
  )
}
