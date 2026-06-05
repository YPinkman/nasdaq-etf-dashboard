import { describe, expect, it } from 'vitest'
import {
  calculateAggregatePortfolio,
  calculatePortfolioSummary,
  calculatePremiumRate,
  getPremiumDecision,
} from './calculations'

const examplePortfolioLots = [
  {
    id: 'lot-1',
    type: 'buy' as const,
    shares: 400,
    avgPrice: 1.585,
    fee: 0,
    createdAt: '2026-05-29T08:00:00.000Z',
  },
  {
    id: 'lot-2',
    type: 'buy' as const,
    shares: 300,
    avgPrice: 1.633,
    fee: 0,
    createdAt: '2026-05-29T08:05:00.000Z',
  },
]

describe('calculatePremiumRate', () => {
  it('calculates ETF premium percentage from market price and IOPV', () => {
    expect(calculatePremiumRate(1.72, 1.63)).toBeCloseTo(5.5215, 4)
  })
})

describe('getPremiumDecision', () => {
  it.each([
    [6.01, '明显偏贵', '建议观望'],
    [5, '偏贵', '谨慎买入'],
    [3, '正常', '可小额分批'],
    [1, '较舒服', '可考虑买入'],
    [-0.01, '折价', '优先关注'],
  ])('classifies %s%% premium as %s', (premiumRate, label, message) => {
    expect(getPremiumDecision(premiumRate)).toMatchObject({
      label,
      message,
    })
  })
})

describe('calculatePortfolioSummary', () => {
  it('summarizes the fixture lots and current holding performance', () => {
    const summary = calculatePortfolioSummary(examplePortfolioLots, 1.72)

    expect(summary.totalShares).toBe(700)
    expect(summary.totalInvested).toBeCloseTo(1123.9, 2)
    expect(summary.averageCost).toBeCloseTo(1.605571, 6)
    expect(summary.marketValue).toBeCloseTo(1204, 2)
    expect(summary.floatingProfitLoss).toBeCloseTo(80.1, 2)
    expect(summary.realizedProfitLoss).toBeCloseTo(0, 2)
    expect(summary.totalProfitLoss).toBeCloseTo(80.1, 2)
    expect(summary.totalFees).toBeCloseTo(0, 2)
    expect(summary.returnRate).toBeCloseTo(7.12697, 5)
  })

  it('updates market value, profit, and return when the current price changes', () => {
    const lowerPriceSummary = calculatePortfolioSummary(examplePortfolioLots, 1.6)

    expect(lowerPriceSummary.marketValue).toBeCloseTo(1120, 2)
    expect(lowerPriceSummary.floatingProfitLoss).toBeCloseTo(-3.9, 2)
    expect(lowerPriceSummary.returnRate).toBeCloseTo(-0.347, 3)
  })

  it('deducts buy and sell fees and tracks sell transactions', () => {
    const summary = calculatePortfolioSummary(
      [
        {
          id: 'buy-1',
          type: 'buy',
          shares: 1000,
          avgPrice: 1,
          fee: 1,
          createdAt: '2026-05-29T08:00:00.000Z',
        },
        {
          id: 'sell-1',
          type: 'sell',
          shares: 400,
          avgPrice: 1.2,
          fee: 1,
          createdAt: '2026-05-29T09:00:00.000Z',
        },
      ],
      1.3,
    )

    expect(summary.totalShares).toBe(600)
    expect(summary.totalInvested).toBeCloseTo(600.6, 2)
    expect(summary.averageCost).toBeCloseTo(1.001, 3)
    expect(summary.marketValue).toBeCloseTo(780, 2)
    expect(summary.realizedProfitLoss).toBeCloseTo(78.6, 2)
    expect(summary.floatingProfitLoss).toBeCloseTo(179.4, 2)
    expect(summary.totalProfitLoss).toBeCloseTo(258, 2)
    expect(summary.totalFees).toBeCloseTo(2, 2)
    expect(summary.totalBuyAmount).toBeCloseTo(1001, 2)
    expect(summary.totalSellProceeds).toBeCloseTo(479, 2)
  })
})

describe('calculateAggregatePortfolio', () => {
  it('summarizes holdings across multiple ETF snapshots', () => {
    const aggregate = calculateAggregatePortfolio(
      {
        '159941': examplePortfolioLots,
        '513100': [
          {
            id: 'buy-3',
            type: 'buy',
            shares: 100,
            avgPrice: 2,
            fee: 1,
            createdAt: '2026-05-29T08:30:00.000Z',
          },
        ],
      },
      {
        '159941': {
          code: '159941',
          name: '纳指ETF广发',
          price: 1.72,
          iopv: 1.63,
          iopvChangePercent: 0.4,
          etfChangePercent: 2.92,
          nasdaq100FuturesChangePercent: 0.1,
          source: 'HaoETF',
          updatedAt: '2026-05-29T08:00:00.000Z',
        },
        '513100': {
          code: '513100',
          name: '纳指ETF国泰',
          price: 2.2,
          iopv: 2.1,
          iopvChangePercent: 0.3,
          etfChangePercent: 1,
          nasdaq100FuturesChangePercent: 0.1,
          source: 'HaoETF',
          updatedAt: '2026-05-29T08:00:00.000Z',
        },
      },
    )

    expect(aggregate.marketValue).toBeCloseTo(1424, 2)
    expect(aggregate.totalInvested).toBeCloseTo(1324.9, 2)
    expect(aggregate.floatingProfitLoss).toBeCloseTo(99.1, 2)
    expect(aggregate.totalProfitLoss).toBeCloseTo(99.1, 2)
    expect(aggregate.totalFees).toBeCloseTo(1, 2)
    expect(aggregate.returnRate).toBeCloseTo(7.4798, 4)
    expect(aggregate.rows.map((row) => row.etfId)).toEqual(['159941', '513100'])
  })
})
