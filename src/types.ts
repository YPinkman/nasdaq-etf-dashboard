export type MarketSnapshot = {
  code: string
  name: string
  price: number
  iopv: number
  iopvChangePercent: number | null
  etfChangePercent: number
  nasdaq100FuturesChangePercent: number | null
  source: string
  updatedAt: string
}

export type NasdaqEtf = {
  id: string
  code: string
  name: string
  secid: string
  market: '深市' | '沪市'
}

export type FuturesSnapshot = {
  name: string
  changePercent: number
  source: string
  updatedAt: string
}

export type PositionLot = {
  id: string
  type: 'buy' | 'sell'
  shares: number
  avgPrice: number
  fee: number
  createdAt: string
}

export type PortfolioSummary = {
  totalShares: number
  totalInvested: number
  averageCost: number
  marketValue: number
  floatingProfitLoss: number
  realizedProfitLoss: number
  totalProfitLoss: number
  totalFees: number
  totalBuyAmount: number
  totalSellProceeds: number
  returnRate: number
}

export type AggregatePortfolioRow = {
  etfId: string
  snapshot: MarketSnapshot
  summary: PortfolioSummary
  premiumRate: number
}

export type AggregatePortfolioSummary = {
  rows: AggregatePortfolioRow[]
  totalInvested: number
  marketValue: number
  floatingProfitLoss: number
  realizedProfitLoss: number
  totalProfitLoss: number
  totalFees: number
  totalBuyAmount: number
  returnRate: number
}

export type PremiumLevel = 'expensive' | 'caution' | 'normal' | 'comfortable' | 'discount'

export type PremiumDecision = {
  label: string
  message: string
  level: PremiumLevel
}
