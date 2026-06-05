import type { PositionLot } from '../types'

export type PortfolioBook = Record<string, PositionLot[]>

type PositionLotInput = {
  type?: 'buy' | 'sell'
  shares: number
  avgPrice: number
  fee?: number
  createdAt?: string
}

export const portfolioBookStorageKey = 'nasdaq-etf-dashboard.portfolio-book.v1'

function createLotId(
  type: 'buy' | 'sell',
  createdAt: string,
  shares: number,
  avgPrice: number,
  fee: number,
): string {
  const compactDate = createdAt.replaceAll(/[-:.]/g, '').replace('T', 'T')
  return `${type}-${compactDate}-${shares}-${avgPrice}-${fee}`
}

export function createPositionLot(input: PositionLotInput): PositionLot {
  const createdAt = input.createdAt ?? new Date().toISOString()
  const type = input.type ?? 'buy'
  const fee = input.fee ?? 0

  return {
    id: createLotId(type, createdAt, input.shares, input.avgPrice, fee),
    type,
    shares: input.shares,
    avgPrice: input.avgPrice,
    fee,
    createdAt,
  }
}

export function getLotsForEtf(book: PortfolioBook, etfId: string): PositionLot[] {
  return book[etfId] ?? []
}

export function addPositionLot(
  book: PortfolioBook,
  etfId: string,
  lot: PositionLot,
): PortfolioBook {
  return {
    ...book,
    [etfId]: [...getLotsForEtf(book, etfId), lot],
  }
}

export function removePositionLot(
  book: PortfolioBook,
  etfId: string,
  lotId: string,
): PortfolioBook {
  return {
    ...book,
    [etfId]: getLotsForEtf(book, etfId).filter((lot) => lot.id !== lotId),
  }
}

export function updatePositionLotFee(
  book: PortfolioBook,
  etfId: string,
  lotId: string,
  fee: number,
): PortfolioBook {
  return {
    ...book,
    [etfId]: getLotsForEtf(book, etfId).map((lot) =>
      lot.id === lotId ? { ...lot, fee } : lot,
    ),
  }
}

function isPositionLot(value: unknown): value is PositionLot {
  if (!value || typeof value !== 'object') {
    return false
  }

  const lot = value as PositionLot

  return (
    typeof lot.id === 'string' &&
    (lot.type === 'buy' || lot.type === 'sell') &&
    typeof lot.createdAt === 'string' &&
    typeof lot.shares === 'number' &&
    Number.isFinite(lot.shares) &&
    typeof lot.avgPrice === 'number' &&
    Number.isFinite(lot.avgPrice) &&
    typeof lot.fee === 'number' &&
    Number.isFinite(lot.fee)
  )
}

function migratePositionLot(value: unknown): PositionLot | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  if (isPositionLot(value)) {
    return value
  }

  const legacyLot = value as Partial<PositionLot>

  if (
    typeof legacyLot.id === 'string' &&
    typeof legacyLot.createdAt === 'string' &&
    typeof legacyLot.shares === 'number' &&
    Number.isFinite(legacyLot.shares) &&
    typeof legacyLot.avgPrice === 'number' &&
    Number.isFinite(legacyLot.avgPrice)
  ) {
    return {
      id: legacyLot.id,
      type: 'buy',
      shares: legacyLot.shares,
      avgPrice: legacyLot.avgPrice,
      fee: 0,
      createdAt: legacyLot.createdAt,
    }
  }

  return null
}

export function readPortfolioBook(storage: Storage): PortfolioBook {
  const rawValue = storage.getItem(portfolioBookStorageKey)

  if (!rawValue) {
    return {}
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown

    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, lots]) => Array.isArray(lots))
        .map(([etfId, lots]) => [
          etfId,
          (lots as unknown[]).map(migratePositionLot).filter(isPositionLot),
        ]),
    )
  } catch {
    return {}
  }
}

export function writePortfolioBook(storage: Storage, book: PortfolioBook): void {
  storage.setItem(portfolioBookStorageKey, JSON.stringify(book))
}
