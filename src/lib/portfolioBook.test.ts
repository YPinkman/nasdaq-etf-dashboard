import { describe, expect, it } from 'vitest'
import {
  addPositionLot,
  createPositionLot,
  getLotsForEtf,
  removePositionLot,
  updatePositionLotFee,
} from './portfolioBook'

describe('portfolioBook', () => {
  it('creates a position lot from user-entered shares and cost', () => {
    expect(
      createPositionLot({
        shares: 400,
        avgPrice: 1.585,
        fee: 0.8,
        createdAt: '2026-05-29T08:00:00.000Z',
      }),
    ).toEqual({
      id: 'buy-20260529T080000000Z-400-1.585-0.8',
      type: 'buy',
      shares: 400,
      avgPrice: 1.585,
      fee: 0.8,
      createdAt: '2026-05-29T08:00:00.000Z',
    })
  })

  it('creates a sell transaction from user-entered shares, price, and fee', () => {
    expect(
      createPositionLot({
        type: 'sell',
        shares: 100,
        avgPrice: 1.7,
        fee: 0.5,
        createdAt: '2026-05-29T09:00:00.000Z',
      }),
    ).toMatchObject({
      id: 'sell-20260529T090000000Z-100-1.7-0.5',
      type: 'sell',
      shares: 100,
      avgPrice: 1.7,
      fee: 0.5,
    })
  })

  it('stores position lots independently for each ETF', () => {
    const firstLot = createPositionLot({
      shares: 400,
      avgPrice: 1.585,
      fee: 0,
      createdAt: '2026-05-29T08:00:00.000Z',
    })
    const secondLot = createPositionLot({
      shares: 300,
      avgPrice: 1.633,
      fee: 0,
      createdAt: '2026-05-29T08:05:00.000Z',
    })

    const book = addPositionLot(
      addPositionLot({}, '159941', firstLot),
      '513100',
      secondLot,
    )

    expect(getLotsForEtf(book, '159941')).toEqual([firstLot])
    expect(getLotsForEtf(book, '513100')).toEqual([secondLot])
    expect(getLotsForEtf(book, '159513')).toEqual([])
  })

  it('removes one add-on lot without changing the rest of the book', () => {
    const firstLot = createPositionLot({
      shares: 400,
      avgPrice: 1.585,
      fee: 0,
      createdAt: '2026-05-29T08:00:00.000Z',
    })
    const secondLot = createPositionLot({
      shares: 300,
      avgPrice: 1.633,
      fee: 0,
      createdAt: '2026-05-29T08:05:00.000Z',
    })
    const book = addPositionLot(
      addPositionLot({}, '159941', firstLot),
      '159941',
      secondLot,
    )

    expect(removePositionLot(book, '159941', firstLot.id)).toEqual({
      '159941': [secondLot],
    })
  })

  it('updates the fee for one transaction without changing the rest of the book', () => {
    const firstLot = createPositionLot({
      shares: 400,
      avgPrice: 1.585,
      fee: 0,
      createdAt: '2026-05-29T08:00:00.000Z',
    })
    const secondLot = createPositionLot({
      type: 'sell',
      shares: 300,
      avgPrice: 1.75,
      fee: 0,
      createdAt: '2026-06-01T02:16:00.000Z',
    })
    const book = addPositionLot(
      addPositionLot({}, '159941', firstLot),
      '159941',
      secondLot,
    )

    expect(updatePositionLotFee(book, '159941', secondLot.id, 0.75)).toEqual({
      '159941': [
        firstLot,
        {
          ...secondLot,
          fee: 0.75,
        },
      ],
    })
  })
})
