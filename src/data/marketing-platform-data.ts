// Platform attribution data — HubSpot Ads Campaign Manager export
// Date range: 1 Apr 2026 – 9 Jun 2026  |  Attribution: Last ad interaction
// meetingsBooked: not tracked in Ads Campaign Manager
// SE dealValueClosed: converted from DKK using rate derived from campaign spend (≈1.4993 SEK/DKK)

export interface PlatformRow {
  platform: 'Google' | 'LinkedIn' | 'Meta'
  totalSpend: number
  leads: number
  meetingsBooked: number
  gradeD: number         // "# Grade D+" — MQL from HubSpot
  deals: number
  dealValueClosed: number | null
}

export interface MarketOverview {
  id: string
  market: string
  currency: 'DKK' | 'EUR' | 'SEK' | 'NOK'
  rows: PlatformRow[]
}

export const PLATFORM_DATA: MarketOverview[] = [
  {
    id: 'all',
    market: 'All Markets',
    currency: 'DKK',
    rows: [
      // LinkedIn: all campaigns 0 spend in period (DK, SE, FI, NO accounts)
      { platform: 'LinkedIn', totalSpend:       0.00, leads:  0, meetingsBooked: 0, gradeD:   0, deals: 0, dealValueClosed: null          },
      // Meta: DK 105 810.10 + SE 65 813.34 + AT 74 629.77 (all converted to DKK)
      { platform: 'Meta',     totalSpend:  246253.21, leads: 30, meetingsBooked: 0, gradeD: 163, deals: 3, dealValueClosed: 3538460.00    },
    ],
  },
  {
    id: 'dk',
    market: 'DK',
    currency: 'DKK',
    rows: [
      { platform: 'LinkedIn', totalSpend:       0.00, leads:  0, meetingsBooked: 0, gradeD:  0, deals: 0, dealValueClosed: null           },
      { platform: 'Meta',     totalSpend:  105810.10, leads:  7, meetingsBooked: 0, gradeD: 37, deals: 2, dealValueClosed: 2000000.00     },
    ],
  },
  {
    id: 'se',
    market: 'SE',
    currency: 'SEK',
    rows: [
      { platform: 'LinkedIn', totalSpend:       0.00, leads:  0, meetingsBooked: 0, gradeD:   0, deals: 0, dealValueClosed: null          },
      { platform: 'Meta',     totalSpend:   98670.67, leads: 21, meetingsBooked: 0, gradeD: 100, deals: 1, dealValueClosed: 2307000.00    },
    ],
  },
  {
    id: 'at',
    market: 'AT',
    currency: 'EUR',
    rows: [
      // No AT LinkedIn account in HubSpot Ads Manager
      { platform: 'Meta',     totalSpend:   10003.99, leads:  2, meetingsBooked: 0, gradeD: 26, deals: 0, dealValueClosed: null           },
    ],
  },
  {
    id: 'fi',
    market: 'FI',
    currency: 'EUR',
    rows: [
      { platform: 'LinkedIn', totalSpend:       0.00, leads:  0, meetingsBooked: 0, gradeD:  0, deals: 0, dealValueClosed: null           },
      { platform: 'Meta',     totalSpend:       0.00, leads:  0, meetingsBooked: 0, gradeD:  0, deals: 0, dealValueClosed: null           },
    ],
  },
  {
    id: 'no',
    market: 'NO',
    currency: 'NOK',
    rows: [
      { platform: 'LinkedIn', totalSpend:       0.00, leads:  0, meetingsBooked: 0, gradeD:  0, deals: 0, dealValueClosed: null           },
      { platform: 'Meta',     totalSpend:       0.00, leads:  0, meetingsBooked: 0, gradeD:  0, deals: 0, dealValueClosed: null           },
    ],
  },
]
