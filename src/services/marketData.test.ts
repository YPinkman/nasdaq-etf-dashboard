import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  availableNasdaqEtfs,
  getMarketSnapshot,
  parseHaoEtfValuation,
  parseEastmoneyEtfQuote,
  parseEastmoneyFuturesQuote,
} from './marketData'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('availableNasdaqEtfs', () => {
  it('includes multiple on-exchange Nasdaq ETF choices', () => {
    expect(availableNasdaqEtfs.map((etf) => etf.code)).toEqual([
      '159941',
      '513100',
      '159513',
      '159501',
      '513300',
      '513390',
    ])
  })
})

describe('parseEastmoneyEtfQuote', () => {
  it('maps ETF price fields into a quote shape', () => {
    const quote = parseEastmoneyEtfQuote(
      {
        rc: 0,
        data: {
          f43: 1694,
          f57: '159941',
          f58: '纳指ETF广发',
          f60: 1646,
          f71: 1682,
          f86: 1780038246,
          f169: 48,
          f170: 292,
        },
      },
      availableNasdaqEtfs[0],
    )

    expect(quote.code).toBe('159941')
    expect(quote.name).toBe('纳指ETF广发')
    expect(quote.price).toBeCloseTo(1.694, 3)
    expect(quote.etfChangePercent).toBeCloseTo(2.92, 2)
    expect(quote.updatedAt).toBe('2026-05-29T07:04:06.000Z')
    expect(quote.source).toBe('东方财富')
  })

  it('rejects ETF quotes without a usable price field', () => {
    expect(() =>
      parseEastmoneyEtfQuote(
        {
          rc: 0,
          data: {
            f43: 1694,
            f57: '159941',
            f58: '纳指ETF广发',
            f170: 292,
          },
        },
        availableNasdaqEtfs[0],
      ),
    ).not.toThrow()

    expect(() =>
      parseEastmoneyEtfQuote(
        {
          rc: 0,
          data: {
            f43: 0,
            f57: '159941',
            f58: '纳指ETF广发',
            f170: 292,
          },
        },
        availableNasdaqEtfs[0],
      ),
    ).toThrow('price')
  })
})

describe('parseHaoEtfValuation', () => {
  it('maps HaoETF real-time valuation, price, and futures from the QDII page table', () => {
    const valuation = parseHaoEtfValuation(`
      <p>数据更新时间：2026-05-29 15:25:25</p>
      <tbody>
      <tr class="text-right">
      <td>159941</td>
      <td>纳指ETF</td>
      <td>1.5423</td>
      <td class="text-danger">9.84%</td>
      <td>1.5438</td>
      <td>9.73%</td>
      <td>05-28</td>
      <td><a href="http://stocks.sina.cn/fund/?code=159941">1.694</a></td>
      <td class="text-danger">2.92%</td>
      <!--<td>1357.32</td>-->
      <td>228269.42</td>
      <td>2245651</td>
      <td>130</td>
      <td>1.5328</td>
      <td>05-27</td>
      <td class="text-danger">0.84%</td>
      </tr>
      </tbody>
      <h5>相关期货</h5>
      <tbody>
      <tr>
      <td>NQ</td>
      <td>纳斯达克100指数期货</td>
      <td>30302.592</td>
      <td class="text-success">-0.01%</td>
      <td>30328.0</td>
      <td>30307.0</td>
      <td>2026-05-29 15:26:04</td>
      </tr>
      </tbody>
    `)

    expect(valuation.realtimeValuation).toBeCloseTo(1.5423, 4)
    expect(valuation.realtimePremiumRate).toBeCloseTo(9.84, 2)
    expect(valuation.price).toBeCloseTo(1.694, 3)
    expect(valuation.etfChangePercent).toBeCloseTo(2.92, 2)
    expect(valuation.iopvChangePercent).toBeCloseTo(0.84, 2)
    expect(valuation.futuresChangePercent).toBeCloseTo(-0.01, 2)
    expect(valuation.updatedAt).toBe('2026-05-29T07:25:25.000Z')
    expect(valuation.source).toBe('HaoETF')
  })

  it('falls back to latest valuation when weekend real-time valuation is unavailable', () => {
    const valuation = parseHaoEtfValuation(`
      <p>数据更新时间：2026-05-30 09:00:00</p>
      <tbody>
      <tr class="text-right">
      <td>159941</td>
      <td>纳指ETF</td>
      <td>-</td>
      <td>-</td>
      <td>1.5445</td>
      <td class="text-danger">9.68%</td>
      <td>05-28</td>
      <td><a href="http://stocks.sina.cn/fund/?code=159941">1.694</a></td>
      <td class="text-danger">2.92%</td>
      <!--<td>1357.32</td>-->
      <td>228269.42</td>
      <td>2245651</td>
      <td>130</td>
      <td>1.5328</td>
      <td>05-27</td>
      <td class="text-danger">0.84%</td>
      </tr>
      </tbody>
    `)

    expect(valuation.realtimeValuation).toBeCloseTo(1.5445, 4)
    expect(valuation.realtimePremiumRate).toBeCloseTo(9.68, 2)
    expect(valuation.iopvChangePercent).toBeCloseTo(0.84, 2)
    expect(valuation.source).toBe('HaoETF最新估值')
  })

  it('rejects a HaoETF page without a real-time valuation table row', () => {
    expect(() => parseHaoEtfValuation('159513 not found')).toThrow(
      'HaoETF real-time valuation',
    )
  })
})

describe('parseEastmoneyFuturesQuote', () => {
  it('maps Nasdaq futures change percentage from Eastmoney quote fields', () => {
    expect(
      parseEastmoneyFuturesQuote({
        rc: 0,
        data: {
          f43: 3033808,
          f57: 'NQ00Y',
          f58: '小型纳指当月连续',
          f86: 1780038302,
          f170: 10,
        },
      }),
    ).toMatchObject({
      name: '小型纳指当月连续',
      changePercent: 0.1,
      updatedAt: '2026-05-29T07:05:02.000Z',
      source: '东方财富',
    })
  })
})

describe('getMarketSnapshot', () => {
  it('uses HaoETF data without requiring Eastmoney to be reachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/haoetf/qdii/159941')) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(`
                <p>数据更新时间：2026-05-29 15:25:25</p>
                <tbody>
                <tr class="text-right">
                <td>159941</td>
                <td>纳指ETF</td>
                <td>1.5423</td>
                <td class="text-danger">9.84%</td>
                <td>1.5438</td>
                <td>9.73%</td>
                <td>05-28</td>
                <td><a href="http://stocks.sina.cn/fund/?code=159941">1.694</a></td>
                <td class="text-danger">2.92%</td>
                </tr>
                </tbody>
              `),
          })
        }

        return Promise.resolve({
          ok: false,
          status: 502,
        })
      }),
    )

    await expect(getMarketSnapshot('159941')).resolves.toMatchObject({
      code: '159941',
      name: '纳指ETF广发',
      price: 1.694,
      iopv: 1.5423,
      iopvChangePercent: null,
      etfChangePercent: 2.92,
      source: 'HaoETF',
    })
  })

  it('does not fall back to mock data when the valuation source fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }),
    )

    await expect(getMarketSnapshot('159941')).rejects.toThrow(
      'HaoETF request failed with 503',
    )
  })
})
