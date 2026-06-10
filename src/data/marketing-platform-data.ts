export interface PlatformRow {
  platform: 'Google' | 'LinkedIn' | 'Meta'
  totalSpend: number
  leads: number
  meetingsBooked: number
  gradeD: number
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
      { platform: 'Google',   totalSpend:    1972.51, leads:    0, meetingsBooked:   0, gradeD:   0, deals: 0, dealValueClosed: null          },
      { platform: 'LinkedIn', totalSpend:  196691.31, leads:   89, meetingsBooked:  11, gradeD:  19, deals: 0, dealValueClosed: null          },
      { platform: 'Meta',     totalSpend:  964619.86, leads: 4684, meetingsBooked: 460, gradeD: 789, deals: 2, dealValueClosed: 60352981.52  },
    ],
  },
  {
    id: 'dk',
    market: 'DK',
    currency: 'DKK',
    rows: [
      { platform: 'LinkedIn', totalSpend:  132150.25, leads:   62, meetingsBooked:   3, gradeD:  15, deals: 0, dealValueClosed: null          },
      { platform: 'Meta',     totalSpend:  395443.03, leads: 1582, meetingsBooked:  77, gradeD: 296, deals: 2, dealValueClosed: 16640238.20  },
    ],
  },
  {
    id: 'se',
    market: 'SE',
    currency: 'SEK',
    rows: [
      { platform: 'LinkedIn', totalSpend:  195840.00, leads:   52, meetingsBooked:   7, gradeD:  18, deals: 0, dealValueClosed: null          },
      { platform: 'Meta',     totalSpend:  894280.00, leads: 2148, meetingsBooked: 184, gradeD: 384, deals: 3, dealValueClosed: 52400000.00  },
    ],
  },
  {
    id: 'at',
    market: 'AT',
    currency: 'EUR',
    rows: [
      { platform: 'LinkedIn', totalSpend:   48720.00, leads:   31, meetingsBooked:   4, gradeD:   9, deals: 0, dealValueClosed: null          },
      { platform: 'Meta',     totalSpend:  218340.50, leads:  856, meetingsBooked:  68, gradeD: 142, deals: 1, dealValueClosed:  9840000.00  },
    ],
  },
  {
    id: 'fi',
    market: 'FI',
    currency: 'EUR',
    rows: [
      { platform: 'LinkedIn', totalSpend:   32450.00, leads:   18, meetingsBooked:   2, gradeD:   5, deals: 0, dealValueClosed: null          },
      { platform: 'Meta',     totalSpend:  142680.00, leads:  524, meetingsBooked:  42, gradeD:  86, deals: 0, dealValueClosed: null          },
    ],
  },
  {
    id: 'no',
    market: 'NO',
    currency: 'NOK',
    rows: [
      { platform: 'LinkedIn', totalSpend:  182400.00, leads:   38, meetingsBooked:   5, gradeD:  11, deals: 0, dealValueClosed: null          },
      { platform: 'Meta',     totalSpend:  812650.00, leads: 1642, meetingsBooked: 124, gradeD: 268, deals: 2, dealValueClosed: 28750000.00  },
    ],
  },
]
