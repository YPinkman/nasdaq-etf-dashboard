import { RefreshCw, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import {
  calculateAggregatePortfolio,
  calculatePortfolioSummary,
  calculatePremiumRate,
  getPremiumDecision,
} from './lib/calculations'
import {
  addPositionLot,
  createPositionLot,
  getLotsForEtf,
  readPortfolioBook,
  removePositionLot,
  updatePositionLotFee,
  writePortfolioBook,
  type PortfolioBook,
} from './lib/portfolioBook'
import { availableNasdaqEtfs, getMarketSnapshot } from './services/marketData'
import type { MarketSnapshot, PremiumDecision, PositionLot } from './types'

const numberFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
})

const moneyFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${percentFormatter.format(value)}%`
}

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

function formatLotTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getToneClass(value: number): string {
  if (value > 0) {
    return 'is-up'
  }

  if (value < 0) {
    return 'is-down'
  }

  return 'is-flat'
}

function readInitialPortfolioBook(): PortfolioBook {
  if (typeof window === 'undefined') {
    return {}
  }

  return readPortfolioBook(window.localStorage)
}

function persistPortfolioBook(book: PortfolioBook): void {
  if (typeof window !== 'undefined') {
    writePortfolioBook(window.localStorage, book)
  }
}

function omitRecordKey<T>(
  record: Record<string, T>,
  keyToRemove: string,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== keyToRemove),
  )
}

type MetricCardProps = {
  label: string
  value: string
  detail?: string
  tone?: string
  decision?: PremiumDecision
}

function MetricCard({ label, value, detail, tone, decision }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className="metric-card__topline">
        <span>{label}</span>
        {decision ? (
          <strong className={`status-badge status-badge--${decision.level}`}>
            {decision.label}
          </strong>
        ) : null}
      </div>
      <strong className={tone ? `metric-card__value ${tone}` : 'metric-card__value'}>
        {value}
      </strong>
      {detail ? <span className="metric-card__detail">{detail}</span> : null}
    </article>
  )
}

type HoldingFormProps = {
  lots: PositionLot[]
  onAddLot: (type: 'buy' | 'sell', shares: number, avgPrice: number, fee: number) => void
  onRemoveLot: (lotId: string) => void
  onUpdateLotFee: (lotId: string, fee: number) => void
}

type FeeEditorProps = {
  lot: PositionLot
  onUpdateLotFee: (lotId: string, fee: number) => void
}

function FeeEditor({ lot, onUpdateLotFee }: FeeEditorProps) {
  const [draftFee, setDraftFee] = useState(String(lot.fee))
  const parsedFee = Number(draftFee)
  const isValidFee = Number.isFinite(parsedFee) && parsedFee >= 0
  const hasChanged = isValidFee && parsedFee !== lot.fee

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isValidFee) {
      return
    }

    onUpdateLotFee(lot.id, parsedFee)
  }

  return (
    <form className="fee-editor" onSubmit={handleSubmit}>
      <span>¥</span>
      <input
        aria-label="该笔交易手续费"
        inputMode="decimal"
        min="0"
        step="0.01"
        type="number"
        value={draftFee}
        onChange={(event) => setDraftFee(event.target.value)}
      />
      <button
        aria-label="保存该笔手续费"
        className="fee-save-button"
        disabled={!hasChanged}
        title="保存手续费"
        type="submit"
      >
        <Save size={14} aria-hidden="true" />
      </button>
    </form>
  )
}

function HoldingForm({
  lots,
  onAddLot,
  onRemoveLot,
  onUpdateLotFee,
}: HoldingFormProps) {
  const [transactionType, setTransactionType] = useState<'buy' | 'sell'>('buy')
  const [shares, setShares] = useState('')
  const [avgPrice, setAvgPrice] = useState('')
  const [fee, setFee] = useState('0')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedShares = Number(shares)
    const parsedAvgPrice = Number(avgPrice)
    const parsedFee = Number(fee)

    if (parsedShares <= 0 || parsedAvgPrice <= 0 || parsedFee < 0) {
      return
    }

    onAddLot(transactionType, parsedShares, parsedAvgPrice, parsedFee)
    setShares('')
    setAvgPrice('')
    setFee('0')
  }

  return (
    <section className="holding-editor" aria-label="持仓录入">
      <form className="holding-form" onSubmit={handleSubmit}>
        <label>
          <span>交易类型</span>
          <select
            value={transactionType}
            onChange={(event) =>
              setTransactionType(event.target.value as 'buy' | 'sell')
            }
          >
            <option value="buy">加仓买入</option>
            <option value="sell">减仓卖出</option>
          </select>
        </label>
        <label>
          <span>{transactionType === 'buy' ? '加仓份额' : '减仓份额'}</span>
          <input
            inputMode="decimal"
            min="0"
            placeholder="例如 400"
            step="1"
            type="number"
            value={shares}
            onChange={(event) => setShares(event.target.value)}
          />
        </label>
        <label>
          <span>{transactionType === 'buy' ? '买入均价' : '卖出均价'}</span>
          <input
            inputMode="decimal"
            min="0"
            placeholder="例如 1.585"
            step="0.001"
            type="number"
            value={avgPrice}
            onChange={(event) => setAvgPrice(event.target.value)}
          />
        </label>
        <label>
          <span>手续费</span>
          <input
            inputMode="decimal"
            min="0"
            placeholder="例如 0.5"
            step="0.01"
            type="number"
            value={fee}
            onChange={(event) => setFee(event.target.value)}
          />
        </label>
        <button className="add-lot-button" type="submit">
          {transactionType === 'buy' ? '记录加仓' : '记录减仓'}
        </button>
      </form>

      <div className="lot-list">
        <div className="lot-list__header">
          <span>交易流水</span>
          <span>{lots.length} 笔</span>
        </div>
        {lots.length === 0 ? (
          <p className="empty-lots">尚未录入该基金持仓。</p>
        ) : (
          <div className="lot-table" role="table" aria-label="交易流水">
            <div className="lot-row lot-row--head" role="row">
              <span>类型</span>
              <span>时间</span>
              <span>份额</span>
              <span>价格</span>
              <span>手续费</span>
              <span>金额</span>
              <span></span>
            </div>
            {lots.map((lot) => (
              <div className="lot-row" role="row" key={lot.id}>
                <strong
                  className={
                    lot.type === 'buy'
                      ? 'transaction-badge transaction-badge--buy'
                      : 'transaction-badge transaction-badge--sell'
                  }
                >
                  {lot.type === 'buy' ? '买入' : '卖出'}
                </strong>
                <span>{formatLotTime(lot.createdAt)}</span>
                <strong>{lot.shares}</strong>
                <strong>{numberFormatter.format(lot.avgPrice)}</strong>
                <FeeEditor
                  key={`${lot.id}-${lot.fee}`}
                  lot={lot}
                  onUpdateLotFee={onUpdateLotFee}
                />
                <strong>
                  ¥
                  {moneyFormatter.format(
                    lot.type === 'buy'
                      ? lot.shares * lot.avgPrice + lot.fee
                      : lot.shares * lot.avgPrice - lot.fee,
                  )}
                </strong>
                <button
                  aria-label="删除该笔交易"
                  className="icon-button"
                  type="button"
                  onClick={() => onRemoveLot(lot.id)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function App() {
  const [selectedEtfId, setSelectedEtfId] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<Record<string, MarketSnapshot>>({})
  const [marketErrors, setMarketErrors] = useState<Record<string, string>>({})
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [portfolioBook, setPortfolioBook] = useState(readInitialPortfolioBook)

  const isOverview = selectedEtfId === null
  const selectedEtfIdForDetail = selectedEtfId ?? availableNasdaqEtfs[0].id
  const selectedEtf =
    availableNasdaqEtfs.find((etf) => etf.id === selectedEtfIdForDetail) ??
    availableNasdaqEtfs[0]
  const effectiveSnapshot = snapshots[selectedEtf.id] ?? null
  const currentError = marketErrors[selectedEtf.id] ?? null
  const portfolioLots = getLotsForEtf(portfolioBook, selectedEtf.id)

  async function fetchOneSnapshot(etfId: string) {
    try {
      const nextSnapshot = await getMarketSnapshot(etfId)
      setSnapshots((currentSnapshots) => ({
        ...currentSnapshots,
        [etfId]: nextSnapshot,
      }))
      setMarketErrors((currentErrors) => {
        return omitRecordKey(currentErrors, etfId)
      })
    } catch (error) {
      setSnapshots((currentSnapshots) => {
        return omitRecordKey(currentSnapshots, etfId)
      })
      setMarketErrors((currentErrors) => ({
        ...currentErrors,
        [etfId]: error instanceof Error ? error.message : '行情接口请求失败',
      }))
    }
  }

  async function refreshMarketData() {
    setIsRefreshing(true)
    try {
      if (isOverview) {
        await Promise.all(availableNasdaqEtfs.map((etf) => fetchOneSnapshot(etf.id)))
      } else {
        await fetchOneSnapshot(selectedEtf.id)
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  function addHoldingLot(
    type: 'buy' | 'sell',
    shares: number,
    avgPrice: number,
    fee: number,
  ) {
    setPortfolioBook((currentBook) => {
      const nextBook = addPositionLot(
        currentBook,
        selectedEtf.id,
        createPositionLot({ type, shares, avgPrice, fee }),
      )
      persistPortfolioBook(nextBook)
      return nextBook
    })
  }

  function removeHoldingLot(lotId: string) {
    setPortfolioBook((currentBook) => {
      const nextBook = removePositionLot(currentBook, selectedEtf.id, lotId)
      persistPortfolioBook(nextBook)
      return nextBook
    })
  }

  function updateHoldingLotFee(lotId: string, fee: number) {
    setPortfolioBook((currentBook) => {
      const nextBook = updatePositionLotFee(currentBook, selectedEtf.id, lotId, fee)
      persistPortfolioBook(nextBook)
      return nextBook
    })
  }

  useEffect(() => {
    let isActive = true
    const targetIds = isOverview
      ? availableNasdaqEtfs.map((etf) => etf.id)
      : [selectedEtf.id]

    void Promise.all(
      targetIds.map(async (etfId) => {
        try {
          const nextSnapshot = await getMarketSnapshot(etfId)

          if (isActive) {
            setSnapshots((currentSnapshots) => ({
              ...currentSnapshots,
              [etfId]: nextSnapshot,
            }))
            setMarketErrors((currentErrors) => {
              return omitRecordKey(currentErrors, etfId)
            })
          }
        } catch (error) {
          if (isActive) {
            setSnapshots((currentSnapshots) => {
              return omitRecordKey(currentSnapshots, etfId)
            })
            setMarketErrors((currentErrors) => ({
              ...currentErrors,
              [etfId]:
                error instanceof Error ? error.message : '行情接口请求失败',
            }))
          }
        }
      }),
    )

    return () => {
      isActive = false
    }
  }, [isOverview, selectedEtf.id])

  const derived = useMemo(() => {
    if (!effectiveSnapshot) {
      return null
    }

    const premiumRate = calculatePremiumRate(
      effectiveSnapshot.price,
      effectiveSnapshot.iopv,
    )
    const decision = getPremiumDecision(premiumRate)
    const portfolio = calculatePortfolioSummary(
      portfolioLots,
      effectiveSnapshot.price,
    )

    return {
      premiumRate,
      decision,
      portfolio,
    }
  }, [effectiveSnapshot, portfolioLots])

  const aggregate = useMemo(
    () => calculateAggregatePortfolio(portfolioBook, snapshots),
    [portfolioBook, snapshots],
  )

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">
            {isOverview
              ? '场内 ETF · 总持仓'
              : `场内 ETF · ${effectiveSnapshot?.source ?? 'HaoETF'}`}
          </p>
          <h1>{isOverview ? '纳指ETF总持仓监控面板' : `${selectedEtf.code} 纳指ETF详情`}</h1>
          <p className="fund-name">
            {isOverview
              ? '总览所有标的，单只标的进入二级详情维护交易流水'
              : effectiveSnapshot?.name ?? selectedEtf.name}
          </p>
        </div>
        <div className="header-actions">
          <label className="fund-select">
            <span>视图</span>
            <select
              value={selectedEtfId ?? 'overview'}
              onChange={(event) =>
                setSelectedEtfId(
                  event.target.value === 'overview' ? null : event.target.value,
                )
              }
            >
              <option value="overview">全部标的总览</option>
              {availableNasdaqEtfs.map((etf) => (
                <option key={etf.id} value={etf.id}>
                  {etf.code} · {etf.name}
                </option>
              ))}
            </select>
          </label>
          <button
            aria-label="手动刷新"
            className="refresh-button"
            disabled={isRefreshing}
            onClick={refreshMarketData}
            title="手动刷新"
            type="button"
          >
            <RefreshCw size={18} aria-hidden="true" />
            <span>{isRefreshing ? '刷新中' : '刷新'}</span>
          </button>
        </div>
      </header>

      {isOverview ? (
        <>
          <section className="market-strip" aria-label="总持仓">
            <MetricCard
              label="总持仓市值"
              value={`¥${moneyFormatter.format(aggregate.marketValue)}`}
            />
            <MetricCard
              label="总持仓成本"
              value={`¥${moneyFormatter.format(aggregate.totalInvested)}`}
            />
            <MetricCard
              label="总浮动盈亏"
              value={`¥${moneyFormatter.format(aggregate.floatingProfitLoss)}`}
              tone={getToneClass(aggregate.floatingProfitLoss)}
            />
            <MetricCard
              label="总收益率"
              value={formatPercent(aggregate.returnRate)}
              tone={getToneClass(aggregate.returnRate)}
            />
          </section>

          <section className="portfolio-section">
            <div className="section-heading">
              <p className="eyebrow">全部标的</p>
              <h2>持仓与溢价总览</h2>
            </div>
            <div className="overview-table">
              <div className="overview-row overview-row--head">
                <span>标的</span>
                <span>价格</span>
                <span>估值</span>
                <span>估值涨幅</span>
                <span>溢价</span>
                <span>份额</span>
                <span>市值</span>
                <span>盈亏</span>
                <span>操作</span>
              </div>
              {availableNasdaqEtfs.map((etf) => {
                const rowSnapshot = snapshots[etf.id]
                const rowLots = getLotsForEtf(portfolioBook, etf.id)
                const rowSummary = rowSnapshot
                  ? calculatePortfolioSummary(rowLots, rowSnapshot.price)
                  : null
                const rowPremium = rowSnapshot
                  ? calculatePremiumRate(rowSnapshot.price, rowSnapshot.iopv)
                  : null

                return (
                  <div className="overview-row" key={etf.id}>
                    <strong>
                      {etf.code}
                      <small>{etf.name}</small>
                    </strong>
                    <span>
                      {rowSnapshot ? numberFormatter.format(rowSnapshot.price) : '-'}
                    </span>
                    <span>
                      {rowSnapshot ? numberFormatter.format(rowSnapshot.iopv) : '-'}
                    </span>
                    <span
                      className={
                        rowSnapshot?.iopvChangePercent === null || !rowSnapshot
                          ? 'is-flat'
                          : getToneClass(rowSnapshot.iopvChangePercent)
                      }
                    >
                      {rowSnapshot?.iopvChangePercent === null || !rowSnapshot
                        ? '-'
                        : formatPercent(rowSnapshot.iopvChangePercent)}
                    </span>
                    <span
                      className={
                        rowPremium === null
                          ? 'is-flat'
                          : `status-text--${getPremiumDecision(rowPremium).level}`
                      }
                    >
                      {rowPremium === null ? '未获取' : formatPercent(rowPremium)}
                    </span>
                    <span>{rowSummary ? rowSummary.totalShares : 0}</span>
                    <span>
                      {rowSummary
                        ? `¥${moneyFormatter.format(rowSummary.marketValue)}`
                        : '-'}
                    </span>
                    <span
                      className={
                        rowSummary
                          ? getToneClass(rowSummary.totalProfitLoss)
                          : 'is-flat'
                      }
                    >
                      {rowSummary
                        ? `¥${moneyFormatter.format(rowSummary.totalProfitLoss)}`
                        : marketErrors[etf.id] ?? '-'}
                    </span>
                    <button
                      className="table-action"
                      type="button"
                      onClick={() => setSelectedEtfId(etf.id)}
                    >
                      详情
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      ) : !effectiveSnapshot || !derived ? (
        <section className="loading-panel">
          {currentError ? (
            <>
              <strong>未获取到行情数据</strong>
              <span>{currentError}</span>
            </>
          ) : (
            '正在获取真实行情数据...'
          )}
        </section>
      ) : (
        <>
          <button
            className="back-button"
            type="button"
            onClick={() => setSelectedEtfId(null)}
          >
            返回总览
          </button>
          <section className="market-strip" aria-label="核心行情">
            <MetricCard
              label="当前二级市场价格"
              value={numberFormatter.format(effectiveSnapshot.price)}
              detail={`更新时间 ${formatUpdatedAt(effectiveSnapshot.updatedAt)}`}
            />
            <MetricCard
              label="当前 IOPV"
              value={numberFormatter.format(effectiveSnapshot.iopv)}
            />
            <MetricCard
              label="IOPV/估值涨幅"
              value={
                effectiveSnapshot.iopvChangePercent === null
                  ? '获取失败'
                  : formatPercent(effectiveSnapshot.iopvChangePercent)
              }
              tone={
                effectiveSnapshot.iopvChangePercent === null
                  ? 'is-flat'
                  : getToneClass(effectiveSnapshot.iopvChangePercent)
              }
            />
            <MetricCard
              label="溢价率"
              value={formatPercent(derived.premiumRate)}
              decision={derived.decision}
              tone={`status-text--${derived.decision.level}`}
            />
            <MetricCard
              label="纳指100期货涨跌幅"
              value={
                effectiveSnapshot.nasdaq100FuturesChangePercent === null
                  ? '获取失败'
                  : formatPercent(effectiveSnapshot.nasdaq100FuturesChangePercent)
              }
              tone={
                effectiveSnapshot.nasdaq100FuturesChangePercent === null
                  ? 'is-flat'
                  : getToneClass(effectiveSnapshot.nasdaq100FuturesChangePercent)
              }
            />
          </section>

          <section className="portfolio-section" aria-label="持仓收益">
            <div className="section-heading">
              <p className="eyebrow">本地持仓</p>
              <h2>成本与收益</h2>
            </div>
            <div className="portfolio-grid">
              <MetricCard
                label="总持仓份额"
                value={`${derived.portfolio.totalShares} 份`}
              />
              <MetricCard
                label="当前持仓成本"
                value={`¥${moneyFormatter.format(derived.portfolio.totalInvested)}`}
              />
              <MetricCard
                label="平均持仓成本"
                value={numberFormatter.format(derived.portfolio.averageCost)}
              />
              <MetricCard
                label="当前持仓市值"
                value={`¥${moneyFormatter.format(derived.portfolio.marketValue)}`}
              />
              <MetricCard
                label="当前浮动盈亏"
                value={`¥${moneyFormatter.format(
                  derived.portfolio.floatingProfitLoss,
                )}`}
                tone={getToneClass(derived.portfolio.floatingProfitLoss)}
              />
              <MetricCard
                label="当前收益率"
                value={formatPercent(derived.portfolio.returnRate)}
                tone={getToneClass(derived.portfolio.returnRate)}
              />
              <MetricCard
                label="已实现盈亏"
                value={`¥${moneyFormatter.format(
                  derived.portfolio.realizedProfitLoss,
                )}`}
                tone={getToneClass(derived.portfolio.realizedProfitLoss)}
              />
              <MetricCard
                label="累计总盈亏"
                value={`¥${moneyFormatter.format(
                  derived.portfolio.totalProfitLoss,
                )}`}
                tone={getToneClass(derived.portfolio.totalProfitLoss)}
              />
              <MetricCard
                label="累计手续费"
                value={`¥${moneyFormatter.format(derived.portfolio.totalFees)}`}
              />
            </div>
            <HoldingForm
              lots={portfolioLots}
              onAddLot={addHoldingLot}
              onRemoveLot={removeHoldingLot}
              onUpdateLotFee={updateHoldingLotFee}
            />
          </section>

          <section className={`decision-panel decision-panel--${derived.decision.level}`}>
            <div>
              <p className="eyebrow">当前判断</p>
              <h2>{derived.decision.message}</h2>
            </div>
            <p>
              当前溢价率 {formatPercent(derived.premiumRate)}，状态为{' '}
              {derived.decision.label}。本面板仅用于观察和辅助判断。
            </p>
          </section>
        </>
      )}
    </main>
  )
}

export default App
