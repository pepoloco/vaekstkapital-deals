export type DateRangeOption = '7d' | '30d' | '90d' | 'ytd' | '12m'

export interface DashboardFilterState {
  dateRange: DateRangeOption
  country: string
  channel: string
  campaign: string
}

export interface KpiCardData {
  id: string
  label: string
  value: string
  rawValue?: number
  delta?: number
  deltaLabel?: string
  trend?: 'up' | 'down' | 'neutral'
  helperText?: string
}

export interface TimeSeriesDatum {
  date: string
  value: number
  secondaryValue?: number
}

export interface BarChartDatum {
  label: string
  value: number
  secondaryValue?: number
}

export interface PieChartDatum {
  name: string
  value: number
}

export interface CampaignPerformanceRow {
  id: string
  campaignName: string
  channel: string
  sessions: number
  leads: number
  conversionRate: number
  influencedRevenue?: number
}

export interface CountryMarketingOverviewData {
  country: string
  kpis: KpiCardData[]
  sessionsTrend: TimeSeriesDatum[]
  leadsTrend: TimeSeriesDatum[]
  sourceMix: PieChartDatum[]
  topCampaigns: CampaignPerformanceRow[]
  emailMetrics: KpiCardData[]
}

export interface DashboardData {
  globalKpis: KpiCardData[]
  trafficTrend: TimeSeriesDatum[]
  leadsTrend: TimeSeriesDatum[]
  conversionTrend: TimeSeriesDatum[]
  sourcePerformance: BarChartDatum[]
  campaignPerformance: CampaignPerformanceRow[]
  countries: CountryMarketingOverviewData[]
}
