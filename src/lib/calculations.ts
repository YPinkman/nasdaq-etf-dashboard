import type {
  AggregatePortfolioSummary,
  MarketSnapshot,
  PortfolioSummary,
  PositionLot,
  PremiumDecision,
} from '../types'

export function calculatePremiumRate(price: number, iopv: number): number {
  return ((price - iopv) / iopv) * 100
}

export function getPremiumDecision(premiumRate: number): PremiumDecision {
  if (premiumRate > 6) {
    return {
      label: '明显偏贵',
      message: '建议观望',
      level: 'expensive',
    }
  }

  if (premiumRate >= 4) {
    return {
      label: '偏贵',
      message: '谨慎买入',
      level: 'caution',
    }
  }

  if (premiumRate >= 2) {
    return {
      label: '正常',
      message: '可小额分批',
      level: 'normal',
    }
  }

  if (premiumRate >= 0) {
    return {
      label: '较舒服',
      message: '可考虑买入',
      level: 'comfortable',
    }
  }

  return {
    label: '折价',
    message: '优先关注',
    level: 'discount',
  }
}

export function calculatePortfolioSummary(
  lots: PositionLot[],
  currentPrice: number,
): PortfolioSummary {
  let totalShares = 0
  let costBasis = 0
  let realizedProfitLoss = 0
  let totalFees = 0
  let totalBuyAmount = 0
  let totalSellProceeds = 0

  for (const lot of lots) {
    const fee = lot.fee ?? 0
    const grossAmount = lot.shares * lot.avgPrice

    totalFees += fee

    if (lot.type === 'sell') {
      const sellShares = Math.min(lot.shares, totalShares)
      const averageCostBeforeSell = totalShares > 0 ? costBasis / totalShares : 0
      const removedCostBasis = averageCostBeforeSell * sellShares
      const netProceeds = grossAmount - fee

      totalShares -= sellShares
      costBasis -= removedCostBasis
      realizedProfitLoss += netProceeds - removedCostBasis
      totalSellProceeds += netProceeds
    } else {
      const netCost = grossAmount + fee

      totalShares += lot.shares
      costBasis += netCost
      totalBuyAmount += netCost
    }
  }

  const totalInvested = costBasis
  const averageCost = totalShares > 0 ? costBasis / totalShares : 0
  const marketValue = currentPrice * totalShares
  const floatingProfitLoss = marketValue - totalInvested
  const totalProfitLoss = floatingProfitLoss + realizedProfitLoss
  const returnRate =
    totalBuyAmount > 0 ? (totalProfitLoss / totalBuyAmount) * 100 : 0

  return {
    totalShares,
    totalInvested,
    averageCost,
    marketValue,
    floatingProfitLoss,
    realizedProfitLoss,
    totalProfitLoss,
    totalFees,
    totalBuyAmount,
    totalSellProceeds,
    returnRate,
  }
}

export function calculateAggregatePortfolio(
  book: Record<string, PositionLot[]>,
  snapshots: Record<string, MarketSnapshot | undefined>,
): AggregatePortfolioSummary {
  const rows = Object.entries(book)
    .map(([etfId, lots]) => {
      const snapshot = snapshots[etfId]

      if (!snapshot) {
        return null
      }

      return {
        etfId,
        snapshot,
        summary: calculatePortfolioSummary(lots, snapshot.price),
        premiumRate: calculatePremiumRate(snapshot.price, snapshot.iopv),
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .filter((row) => row.summary.totalShares > 0 || row.summary.totalBuyAmount > 0)

  const totalInvested = rows.reduce(
    (sum, row) => sum + row.summary.totalInvested,
    0,
  )
  const marketValue = rows.reduce((sum, row) => sum + row.summary.marketValue, 0)
  const floatingProfitLoss = rows.reduce(
    (sum, row) => sum + row.summary.floatingProfitLoss,
    0,
  )
  const realizedProfitLoss = rows.reduce(
    (sum, row) => sum + row.summary.realizedProfitLoss,
    0,
  )
  const totalProfitLoss = rows.reduce(
    (sum, row) => sum + row.summary.totalProfitLoss,
    0,
  )
  const totalFees = rows.reduce((sum, row) => sum + row.summary.totalFees, 0)
  const totalBuyAmount = rows.reduce(
    (sum, row) => sum + row.summary.totalBuyAmount,
    0,
  )
  const returnRate =
    totalBuyAmount > 0 ? (totalProfitLoss / totalBuyAmount) * 100 : 0

  return {
    rows,
    totalInvested,
    marketValue,
    floatingProfitLoss,
    realizedProfitLoss,
    totalProfitLoss,
    totalFees,
    totalBuyAmount,
    returnRate,
  }
}
