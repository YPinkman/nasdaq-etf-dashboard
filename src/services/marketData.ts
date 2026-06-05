import type { FuturesSnapshot, MarketSnapshot, NasdaqEtf } from '../types'

type EastmoneyResponse = {
  rc?: number
  data?: Record<string, unknown> | null
}

const HAOETF_QDII_PATH = '/haoetf/qdii'
const EASTMONEY_SOURCE = '东方财富'
const HAOETF_SOURCE = 'HaoETF'

export const availableNasdaqEtfs: NasdaqEtf[] = [
  {
    id: '159941',
    code: '159941',
    name: '纳指ETF广发',
    secid: '0.159941',
    market: '深市',
  },
  {
    id: '513100',
    code: '513100',
    name: '纳指ETF国泰',
    secid: '1.513100',
    market: '沪市',
  },
  {
    id: '159513',
    code: '159513',
    name: '纳斯达克100ETF大成',
    secid: '0.159513',
    market: '深市',
  },
  {
    id: '159501',
    code: '159501',
    name: '纳指ETF嘉实',
    secid: '0.159501',
    market: '深市',
  },
  {
    id: '513300',
    code: '513300',
    name: '纳斯达克ETF华夏',
    secid: '1.513300',
    market: '沪市',
  },
  {
    id: '513390',
    code: '513390',
    name: '纳指100ETF博时',
    secid: '1.513390',
    market: '沪市',
  },
]

type EastmoneyEtfQuote = Omit<
  MarketSnapshot,
  'iopv' | 'iopvChangePercent' | 'nasdaq100FuturesChangePercent'
>

type HaoEtfValuation = {
  price: number
  realtimeValuation: number
  realtimePremiumRate: number
  iopvChangePercent: number | null
  etfChangePercent: number
  futuresChangePercent: number | null
  source: string
  updatedAt: string
}

function getNumberField(data: Record<string, unknown>, field: string): number {
  const value = data[field]

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  throw new Error(`Eastmoney field ${field} is missing or invalid`)
}

function getStringField(
  data: Record<string, unknown>,
  field: string,
  fallback: string,
): string {
  const value = data[field]

  if (typeof value === 'string' && value.trim() !== '') {
    return value
  }

  return fallback
}

function eastmoneyTimestampToIso(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return new Date().toISOString()
  }

  return new Date(value * 1000).toISOString()
}

function assertEastmoneyData(response: EastmoneyResponse): Record<string, unknown> {
  if (response.rc !== 0 || !response.data) {
    throw new Error('Eastmoney response does not contain usable quote data')
  }

  return response.data
}

export function parseEastmoneyEtfQuote(
  response: EastmoneyResponse,
  etf: NasdaqEtf,
): EastmoneyEtfQuote {
  const data = assertEastmoneyData(response)
  const price = getNumberField(data, 'f43') / 1000

  if (price <= 0) {
    throw new Error('Eastmoney ETF quote does not contain a usable price value')
  }

  return {
    code: getStringField(data, 'f57', etf.code),
    name: getStringField(data, 'f58', etf.name),
    price,
    etfChangePercent: getNumberField(data, 'f170') / 100,
    source: EASTMONEY_SOURCE,
    updatedAt: eastmoneyTimestampToIso(data.f86),
  }
}

function parseChinaLocalDateTime(value: string): string {
  const match = value.match(
    /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})\s+(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})/,
  )

  if (!match?.groups) {
    return new Date().toISOString()
  }

  const { year, month, day, hour, minute, second } = match.groups

  return new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`,
  ).toISOString()
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim()
}

function parsePercent(value: string | undefined): number {
  const parsed = Number(value?.replace('%', '').trim())

  if (!Number.isFinite(parsed)) {
    throw new Error('percentage value is missing or invalid')
  }

  return parsed
}

function parseOptionalNumber(value: string | undefined): number | null {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function parseOptionalPercent(value: string | undefined): number | null {
  const parsed = Number(value?.replace('%', '').trim())

  return Number.isFinite(parsed) ? parsed : null
}

function parseTableCells(rowHtml: string): string[] {
  const uncommentedRowHtml = rowHtml.replace(/<!--[\s\S]*?-->/g, '')

  return [...uncommentedRowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(
    (match) => stripHtml(match[1]),
  )
}

function parseHaoEtfFuturesChangePercent(html: string): number | null {
  const futuresSection = html.match(/<h5>相关期货<\/h5>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)

  if (!futuresSection) {
    return null
  }

  const rowMatch = futuresSection[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/)

  if (!rowMatch) {
    return null
  }

  const cells = parseTableCells(rowMatch[1])

  try {
    return parsePercent(cells[3])
  } catch {
    return null
  }
}

export function parseHaoEtfValuation(html: string): HaoEtfValuation {
  const updatedAtMatch = html.match(/数据更新时间：([\d\s:-]+)/)
  const rowMatch = html.match(/<tr class="text-right">([\s\S]*?)<\/tr>/)

  if (!rowMatch) {
    throw new Error('HaoETF real-time valuation row is missing')
  }

  const cells = parseTableCells(rowMatch[1])
  const realtimeValuation = parseOptionalNumber(cells[2])
  const realtimePremiumRate = parseOptionalPercent(cells[3])
  const latestValuation = parseOptionalNumber(cells[4])
  const latestPremiumRate = parseOptionalPercent(cells[5])
  const valuation = realtimeValuation ?? latestValuation
  const premiumRate = realtimePremiumRate ?? latestPremiumRate
  const price = Number(cells[7])
  const etfChangePercent = parsePercent(cells[8])
  const iopvChangePercent = parseOptionalPercent(cells[14])

  if (!valuation || valuation <= 0) {
    throw new Error('HaoETF real-time valuation is missing or invalid')
  }

  if (premiumRate === null) {
    throw new Error('HaoETF premium rate is missing or invalid')
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('HaoETF market price is missing or invalid')
  }

  return {
    price,
    realtimeValuation: valuation,
    realtimePremiumRate: premiumRate,
    iopvChangePercent,
    etfChangePercent,
    futuresChangePercent: parseHaoEtfFuturesChangePercent(html),
    source: realtimeValuation === null ? `${HAOETF_SOURCE}最新估值` : HAOETF_SOURCE,
    updatedAt: updatedAtMatch
      ? parseChinaLocalDateTime(updatedAtMatch[1])
      : new Date().toISOString(),
  }
}

export function parseEastmoneyFuturesQuote(
  response: EastmoneyResponse,
): FuturesSnapshot {
  const data = assertEastmoneyData(response)

  return {
    name: getStringField(data, 'f58', '小型纳指当月连续'),
    changePercent: getNumberField(data, 'f170') / 100,
    source: EASTMONEY_SOURCE,
    updatedAt: eastmoneyTimestampToIso(data.f86),
  }
}

async function fetchHaoEtfPage(code: string): Promise<string> {
  const response = await fetch(`${HAOETF_QDII_PATH}/${code}`)

  if (!response.ok) {
    throw new Error(`HaoETF request failed with ${response.status}`)
  }

  return response.text()
}

function getEtfById(etfId: string): NasdaqEtf {
  return (
    availableNasdaqEtfs.find((etf) => etf.id === etfId) ?? availableNasdaqEtfs[0]
  )
}

export async function getMarketSnapshot(etfId = '159941'): Promise<MarketSnapshot> {
  const etf = getEtfById(etfId)

  const valuation = parseHaoEtfValuation(await fetchHaoEtfPage(etf.code))

  return {
    code: etf.code,
    name: etf.name,
    price: valuation.price,
    iopv: valuation.realtimeValuation,
    iopvChangePercent: valuation.iopvChangePercent,
    etfChangePercent: valuation.etfChangePercent,
    nasdaq100FuturesChangePercent: valuation.futuresChangePercent,
    source: valuation.source,
    updatedAt: valuation.updatedAt,
  }
}
