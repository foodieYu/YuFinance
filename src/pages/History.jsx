import { useState, useMemo } from 'react'
import { useApp } from '../context/TransactionContext'
import EditDrawer from '../components/EditDrawer'
import {
  Pencil, Trash2, CheckSquare, Square, ChevronDown,
  TrendingUp, TrendingDown, Wallet, Tag, X,
  CheckCheck, MinusSquare, Search, CreditCard,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'

// ─── formatters ───────────────────────────────────────────────────────────────
function fmtAbs(n) {
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(Math.abs(n))
}
function fmtCur(n) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency', currency: 'TWD', maximumFractionDigits: 0,
  }).format(n)
}

// ─── TypeBadge ────────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const map = {
    'Income':       { label: '收入', cls: 'bg-sage-DEFAULT/20 text-sage-dark' },
    'Expense':      { label: '支出', cls: 'bg-terracotta-DEFAULT/20 text-terracotta-dark' },
    'Transfer In':  { label: '轉入', cls: 'bg-earth-200 text-earth-700' },
    'Transfer Out': { label: '轉出', cls: 'bg-earth-200 text-earth-700' },
  }
  const { label, cls } = map[type] ?? { label: type, cls: 'bg-earth-200 text-earth-600' }
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${cls}`}>{label}</span>
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function toggleSet(prev, value) {
  const s = new Set(prev)
  s.has(value) ? s.delete(value) : s.add(value)
  return [...s]
}

function ChipGroup({ items, selected, onToggle, colorActive = 'bg-earth-800 text-earth-50 border-earth-800' }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => {
        const active = selected.includes(item)
        return (
          <button key={item} onClick={() => onToggle(item)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition active:scale-95
              ${active ? colorActive : 'bg-earth-50 text-earth-600 border-earth-200 hover:border-earth-400'}`}>
            {item}
          </button>
        )
      })}
    </div>
  )
}

function getPresetRange(preset, allTransactions) {
  const today = format(new Date(), 'yyyy-MM-dd')
  if (preset === 'all') {
    const dates = allTransactions.map(t => t.transaction_date).filter(Boolean).sort()
    return { from: dates[0] ?? today, to: today }
  }
  if (preset === 'thisMonth') {
    const y = new Date().getFullYear(), m = new Date().getMonth()
    return { from: format(new Date(y, m, 1), 'yyyy-MM-dd'), to: format(new Date(y, m + 1, 0), 'yyyy-MM-dd') }
  }
  if (preset === 'lastMonth') {
    const y = new Date().getFullYear(), m = new Date().getMonth()
    return { from: format(new Date(y, m - 1, 1), 'yyyy-MM-dd'), to: format(new Date(y, m, 0), 'yyyy-MM-dd') }
  }
  if (preset === 'thisYear') {
    return { from: `${new Date().getFullYear()}-01-01`, to: today }
  }
  return null
}

// ─── inline delete confirmation ───────────────────────────────────────────────
function DeleteConfirm({ onConfirm, onCancel }) {
  return (
    <div className="flex items-center gap-2 animate-in fade-in duration-150">
      <span className="text-xs text-terracotta-DEFAULT font-medium whitespace-nowrap">確定刪除？</span>
      <button onClick={onConfirm}
        className="px-2.5 py-1 bg-terracotta-DEFAULT text-white rounded-lg text-xs font-semibold
          hover:bg-terracotta-dark transition active:scale-95">
        刪除
      </button>
      <button onClick={onCancel}
        className="px-2.5 py-1 bg-earth-200 text-earth-700 rounded-lg text-xs font-semibold
          hover:bg-earth-300 transition active:scale-95">
        取消
      </button>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────
export default function History() {
  const {
    allTransactions,
    selectedAccount, setSelectedAccount,
    accounts, accountBalances,
    toggleSettled, bulkSetSettled, deleteTransaction,
    dbCategoryMap,
    dbCardNames,
  } = useApp()

  const [editTarget,    setEditTarget]    = useState(null)
  const [deleteTarget,  setDeleteTarget]  = useState(null)
  const [showCatFilter, setShowCatFilter] = useState(false)

  // ── search ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode,  setSearchMode]  = useState('item_name') // 'item_name' | 'note'

  // ── card_name filter ──────────────────────────────────────────────────────
  const [selectedCard, setSelectedCard] = useState('')

  // ── date range ────────────────────────────────────────────────────────────
  const thisMonth = (() => {
    const y = new Date().getFullYear(), m = new Date().getMonth()
    return {
      from: format(new Date(y, m, 1),     'yyyy-MM-dd'),
      to:   format(new Date(y, m + 1, 0), 'yyyy-MM-dd'),
    }
  })()
  const [dateFrom, setDateFrom] = useState(thisMonth.from)
  const [dateTo,   setDateTo]   = useState(thisMonth.to)
  const [preset,   setPreset]   = useState('thisMonth')

  const applyPreset = (p) => {
    setPreset(p)
    const range = getPresetRange(p, allTransactions)
    if (range) { setDateFrom(range.from); setDateTo(range.to) }
  }
  const handleCustomDate = (field, val) => {
    setPreset('custom')
    field === 'from' ? setDateFrom(val) : setDateTo(val)
  }

  // ── settled filter: 'all' | 'settled' | 'unsettled' ──────────────────────
  const [settledFilter, setSettledFilter] = useState('all')

  // ── category multi-select ─────────────────────────────────────────────────
  const [selectedCats, setSelectedCats] = useState([])
  const [selectedSubs, setSelectedSubs] = useState([])

  // step 1 — account + date (base for deriving available cats)
  const preFilteredForCats = useMemo(() => allTransactions.filter(t => {
    const matchAcc  = selectedAccount === 'All' || t.account === selectedAccount
    const matchFrom = !dateFrom || (t.transaction_date ?? '') >= dateFrom
    const matchTo   = !dateTo   || (t.transaction_date ?? '') <= dateTo
    return matchAcc && matchFrom && matchTo
  }), [allTransactions, selectedAccount, dateFrom, dateTo])

  const availableCats = useMemo(() =>
    [...new Set(preFilteredForCats.map(t => t.category).filter(Boolean))].sort(),
    [preFilteredForCats]
  )
  const availableSubs = useMemo(() => {
    const cats = selectedCats.length ? selectedCats : availableCats
    const subs = new Set()
    preFilteredForCats.forEach(t => {
      if (cats.includes(t.category) && t.subcategory) subs.add(t.subcategory)
    })
    return [...subs].sort()
  }, [preFilteredForCats, selectedCats, availableCats])

  const toggleCat = (cat) => { setSelectedCats(prev => toggleSet(prev, cat)); setSelectedSubs([]) }
  const toggleSub = (sub) => setSelectedSubs(prev => toggleSet(prev, sub))
  const clearCatFilters = () => { setSelectedCats([]); setSelectedSubs([]) }
  const activeCatCount = selectedCats.length + selectedSubs.length

  // step 2 — apply ALL filters (including settledFilter) → this drives the main list
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return preFilteredForCats.filter(t => {
      const matchCat     = !selectedCats.length || selectedCats.includes(t.category)
      const matchSub     = !selectedSubs.length || selectedSubs.includes(t.subcategory)
      const matchCard    = !selectedCard || t.card_name === selectedCard
      const matchSettled =
        settledFilter === 'settled'   ? t.is_settled === true  :
        settledFilter === 'unsettled' ? t.is_settled === false :
        true
      const matchSearch  = !q || (
        searchMode === 'note'
          ? (t.note      ?? '').toLowerCase().includes(q)
          : (t.item_name ?? '').toLowerCase().includes(q)
      )
      return matchCat && matchSub && matchCard && matchSettled && matchSearch
    })
  }, [preFilteredForCats, selectedCats, selectedSubs, selectedCard, settledFilter, searchQuery, searchMode])

  // ── summary KPI ───────────────────────────────────────────────────────────
  const singleAcct    = selectedAccount !== 'All'
  const periodIncome  = useMemo(() =>
    filtered
      .filter(t => t.type === 'Income' || (singleAcct && t.type === 'Transfer In'))
      .reduce((s, t) => s + Number(t.amount), 0),
    [filtered, singleAcct])
  const periodExpense = useMemo(() =>
    filtered
      .filter(t => t.type === 'Expense' || (singleAcct && t.type === 'Transfer Out'))
      .reduce((s, t) => s + Number(t.amount), 0),
    [filtered, singleAcct])
  const periodNet   = periodIncome - periodExpense
  const acctBalance = singleAcct ? (accountBalances[selectedAccount] ?? 0) : null

  // ── running balance per date (only when singleAcct) ───────────────────────
  // 完全忽略 is_settled，反映真實資金水位。
  // 步驟 1：算出該帳戶所有交易的「絕對總餘額」
  // 步驟 2：runBal(D) = absTotal − net(該帳戶所有 date > D 的交易)
  const runningBalanceByDate = useMemo(() => {
    if (!singleAcct) return {}

    // 所有帳戶交易，不過濾 is_settled
    const acctTxns = allTransactions.filter(t => t.account === selectedAccount)

    // helper：Income / Transfer In = +amt，Expense / Transfer Out = -amt
    const netAmt = (t) => {
      const amt = Number(t.amount)
      if (t.type === 'Income'  || t.type === 'Transfer In')  return  amt
      if (t.type === 'Expense' || t.type === 'Transfer Out') return -amt
      return 0
    }

    // 步驟 1：所有帳戶交易總和（不分日期、不分 settled）
    const absTotal = acctTxns.reduce((sum, t) => sum + netAmt(t), 0)

    // 步驟 2：對每個出現在 filtered 的日期，算出當天結餘
    const uniqueDates = [...new Set(filtered.map(t => t.transaction_date).filter(Boolean))]
    const result = {}
    uniqueDates.forEach(date => {
      // 「date 之後」所有帳戶交易的淨額（嚴格大於 date）
      const laterNet = acctTxns
        .filter(t => t.transaction_date > date)
        .reduce((sum, t) => sum + netAmt(t), 0)
      result[date] = absTotal - laterNet
    })
    return result
  }, [singleAcct, selectedAccount, allTransactions, filtered])

  // ── bulk action helpers (operate on everything currently in filtered) ──────
  const filteredIds    = useMemo(() => filtered.map(t => t.id), [filtered])
  const allSettled     = filtered.length > 0 && filtered.every(t => t.is_settled)
  const allUnsettled   = filtered.length > 0 && filtered.every(t => !t.is_settled)
  const handleBulkSettle   = () => bulkSetSettled(filteredIds, true)
  const handleBulkUnsettle = () => bulkSetSettled(filteredIds, false)

  // ── group by date (ALL filtered items — settled or not) ───────────────────
  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(t => {
      const d = t.transaction_date
      if (!map[d]) map[d] = []
      map[d].push(t)
    })
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  const PRESETS = [
    { key: 'thisMonth', label: '本月' },
    { key: 'lastMonth', label: '上月' },
    { key: 'thisYear',  label: '今年' },
    { key: 'all',       label: '全部' },
    { key: 'custom',    label: '自訂' },
  ]

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-earth-800 pt-2">明細流水帳</h1>

      {/* ── dual-mode search bar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* mode toggle pill */}
        <div className="flex bg-earth-200 rounded-xl p-0.5 flex-shrink-0">
          {[
            { key: 'item_name', label: '項目' },
            { key: 'note',      label: '備註' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setSearchMode(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition min-h-[36px]
                ${searchMode === key
                  ? 'bg-earth-800 text-earth-50 shadow-sm'
                  : 'text-earth-600 hover:text-earth-800'}`}>
              {label}
            </button>
          ))}
        </div>
        {/* search input */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-earth-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={searchMode === 'note' ? '搜尋備註內容…' : '搜尋項目名稱…'}
            className="w-full bg-earth-100 border border-earth-200 rounded-xl pl-9 pr-9 py-2.5
              text-sm text-earth-800 placeholder-earth-400 focus:outline-none focus:border-earth-400
              focus:ring-1 focus:ring-earth-300 transition min-h-[44px]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-earth-400 hover:text-earth-700 transition">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── filter card ───────────────────────────────────────────────────── */}
      <div className="bg-earth-100 border border-earth-200 rounded-2xl p-4 space-y-3">
        {/* preset chips */}
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map(p => (
            <button key={p.key} onClick={() => applyPreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition
                ${preset === p.key
                  ? 'bg-earth-800 text-earth-50 border-earth-800'
                  : 'bg-earth-50 text-earth-600 border-earth-200 hover:border-earth-400'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* date range */}
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={dateFrom} onChange={e => handleCustomDate('from', e.target.value)}
            className="bg-earth-50 border border-earth-200 rounded-xl px-3 py-2 text-sm text-earth-800
              focus:outline-none focus:border-earth-400 min-h-[44px]" />
          <span className="text-earth-600 text-sm">至</span>
          <input type="date" value={dateTo} onChange={e => handleCustomDate('to', e.target.value)}
            className="bg-earth-50 border border-earth-200 rounded-xl px-3 py-2 text-sm text-earth-800
              focus:outline-none focus:border-earth-400 min-h-[44px]" />
        </div>

        {/* account + card_name */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}
              className="bg-earth-50 border border-earth-200 rounded-xl px-3 pr-8 py-2 text-sm
                text-earth-800 focus:outline-none focus:border-earth-400 min-h-[44px] appearance-none">
              <option value="All">全部帳戶</option>
              {accounts.map(a => <option key={a}>{a}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-earth-600 pointer-events-none" />
          </div>

          {dbCardNames.length > 0 && (
            <div className="relative">
              <CreditCard size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-earth-500 pointer-events-none" />
              <select value={selectedCard} onChange={e => setSelectedCard(e.target.value)}
                className={`bg-earth-50 border rounded-xl pl-8 pr-8 py-2 text-sm
                  focus:outline-none focus:border-earth-400 min-h-[44px] appearance-none transition
                  ${selectedCard ? 'border-earth-600 text-earth-900 font-semibold' : 'border-earth-200 text-earth-800'}`}>
                <option value="">全部卡片</option>
                {dbCardNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-earth-600 pointer-events-none" />
            </div>
          )}
          {selectedCard && (
            <button onClick={() => setSelectedCard('')}
              className="flex items-center gap-1 text-xs text-earth-600 hover:text-earth-800 transition">
              <X size={12} /> 清除卡片
            </button>
          )}
        </div>

        {/* settled filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-earth-600 font-semibold">顯示模式：</span>
          {[
            { key: 'all',       label: '全部' },
            { key: 'settled',   label: '✓ 已計算' },
            { key: 'unsettled', label: '✗ 未計算' },
          ].map(opt => (
            <button key={opt.key} onClick={() => setSettledFilter(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition
                ${settledFilter === opt.key
                  ? opt.key === 'unsettled'
                    ? 'bg-terracotta-DEFAULT text-white border-terracotta-DEFAULT'
                    : 'bg-earth-800 text-earth-50 border-earth-800'
                  : 'bg-earth-50 text-earth-600 border-earth-200 hover:border-earth-400'}`}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* category filter toggle */}
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCatFilter(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition
              ${showCatFilter || activeCatCount > 0
                ? 'bg-earth-800 text-earth-50 border-earth-800'
                : 'bg-earth-50 text-earth-600 border-earth-200 hover:border-earth-400'}`}>
            <Tag size={12} />
            分類篩選
            {activeCatCount > 0 && (
              <span className="ml-1 bg-earth-50 text-earth-800 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                {activeCatCount}
              </span>
            )}
          </button>
          {activeCatCount > 0 && (
            <button onClick={clearCatFilters}
              className="flex items-center gap-1 text-xs text-earth-600 hover:text-earth-800 transition">
              <X size={12} /> 清除分類
            </button>
          )}
        </div>

        {/* expandable category chips */}
        {showCatFilter && (
          <div className="space-y-3 pt-1 border-t border-earth-200">
            <div>
              <p className="text-[11px] text-earth-600 font-semibold uppercase tracking-wider mb-2">主分類（可複選）</p>
              <ChipGroup items={availableCats} selected={selectedCats} onToggle={toggleCat} />
              {availableCats.length === 0 && <p className="text-xs text-earth-500 italic">此條件無可用分類</p>}
            </div>
            {availableSubs.length > 0 && (
              <div>
                <p className="text-[11px] text-earth-600 font-semibold uppercase tracking-wider mb-2">子分類（可複選）</p>
                <ChipGroup items={availableSubs} selected={selectedSubs} onToggle={toggleSub}
                  colorActive="bg-sage-dark text-white border-sage-dark" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── summary KPI ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-earth-100 border border-earth-200 rounded-xl p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-earth-600 leading-tight">
              期間收入{singleAcct ? <span className="opacity-50">+轉入</span> : ''}
            </span>
            <TrendingUp size={13} className="text-sage-DEFAULT flex-shrink-0" />
          </div>
          <span className="text-base font-bold text-sage-DEFAULT whitespace-nowrap">+{fmtAbs(periodIncome)}</span>
        </div>
        <div className="bg-earth-100 border border-earth-200 rounded-xl p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-earth-600 leading-tight">
              期間支出{singleAcct ? <span className="opacity-50">+轉出</span> : ''}
            </span>
            <TrendingDown size={13} className="text-terracotta-DEFAULT flex-shrink-0" />
          </div>
          <span className="text-base font-bold text-terracotta-DEFAULT whitespace-nowrap">-{fmtAbs(periodExpense)}</span>
        </div>
        <div className="bg-earth-100 border border-earth-200 rounded-xl p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-earth-600">期間淨結餘</span>
            <Wallet size={13} className={periodNet >= 0 ? 'text-sage-DEFAULT' : 'text-terracotta-DEFAULT'} />
          </div>
          <span className={`text-base font-bold ${periodNet >= 0 ? 'text-sage-DEFAULT' : 'text-terracotta-DEFAULT'}`}>
            {periodNet >= 0 ? '+' : ''}{fmtAbs(periodNet)}
          </span>
        </div>
        <div className="bg-earth-100 border border-earth-200 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[11px] text-earth-600">
            {singleAcct ? `${selectedAccount} 餘額` : '篩選筆數'}
          </span>
          <span className="text-base font-bold text-earth-800 whitespace-nowrap tracking-tight">
            {singleAcct ? fmtCur(acctBalance ?? 0) : `${filtered.length} 筆`}
          </span>
        </div>
      </div>

      {/* ── active category tags ──────────────────────────────────────────── */}
      {activeCatCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-earth-600">已篩選：</span>
          {selectedCats.map(c => (
            <button key={c} onClick={() => toggleCat(c)}
              className="flex items-center gap-1 px-2.5 py-1 bg-earth-800 text-earth-50 rounded-full text-xs font-medium">
              {c} <X size={10} />
            </button>
          ))}
          {selectedSubs.map(s => (
            <button key={s} onClick={() => toggleSub(s)}
              className="flex items-center gap-1 px-2.5 py-1 bg-sage-dark text-white rounded-full text-xs font-medium">
              {s} <X size={10} />
            </button>
          ))}
        </div>
      )}

      {/* ── batch action bar (buttons only, no data) ──────────────────────── */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-earth-100 border border-earth-200 rounded-xl px-4 py-2.5">
          <span className="text-xs text-earth-600 font-semibold mr-1">批次操作：</span>
          <button onClick={handleBulkSettle} disabled={allSettled}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition active:scale-95
              ${allSettled
                ? 'opacity-40 cursor-not-allowed bg-earth-50 text-earth-600 border-earth-200'
                : 'bg-sage-DEFAULT/20 text-sage-dark border-sage-DEFAULT/30 hover:bg-sage-DEFAULT/30'}`}>
            <CheckCheck size={13} />
            全部標為已計算
          </button>
          <button onClick={handleBulkUnsettle} disabled={allUnsettled}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition active:scale-95
              ${allUnsettled
                ? 'opacity-40 cursor-not-allowed bg-earth-50 text-earth-600 border-earth-200'
                : 'bg-terracotta-DEFAULT/10 text-terracotta-dark border-terracotta-DEFAULT/30 hover:bg-terracotta-DEFAULT/20'}`}>
            <MinusSquare size={13} />
            全部標為未計算
          </button>
          <span className="ml-auto text-xs text-earth-500">{filtered.length} 筆</span>
        </div>
      )}

      {/* ── main transaction list (all filtered, grouped by date) ─────────── */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-earth-600 text-sm">此條件無交易記錄</div>
      ) : (
        grouped.map(([date, txns]) => {
          let parsedDate
          try { parsedDate = parseISO(date) } catch { parsedDate = null }
          const dateLabel = parsedDate
            ? format(parsedDate, 'M 月 d 日 (EEE)', { locale: zhTW })
            : date

          const dayIncome  = txns.filter(t => t.type === 'Income') .reduce((s, t) => s + Number(t.amount), 0)
          const dayExpense = txns.filter(t => t.type === 'Expense').reduce((s, t) => s + Number(t.amount), 0)
          const runBal     = runningBalanceByDate[date]

          return (
            <div key={date}>
              {/* date group header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-earth-600">{dateLabel}</span>
                <div className="flex items-center gap-3 text-xs">
                  {dayIncome  > 0 && <span className="text-sage-DEFAULT">+{fmtAbs(dayIncome)}</span>}
                  {dayExpense > 0 && <span className="text-terracotta-DEFAULT">-{fmtAbs(dayExpense)}</span>}
                  {/* running balance — only in single-account mode */}
                  {singleAcct && runBal !== undefined && (
                    <span className={`font-semibold tracking-tight
                      ${runBal < 0 ? 'text-terracotta-DEFAULT' : 'text-earth-700'}`}>
                      結餘 {fmtCur(runBal)}
                    </span>
                  )}
                </div>
              </div>

              {/* transaction rows */}
              <div className="bg-earth-100 border border-earth-200 rounded-2xl overflow-hidden">
                {txns.map((t, idx) => {
                  const isPositive   = t.type === 'Income' || t.type === 'Transfer In'
                  const amtColor     = isPositive ? 'text-sage-DEFAULT' : 'text-terracotta-DEFAULT'
                  const sign         = isPositive ? '+' : '-'
                  const isPendingDel = deleteTarget === t.id

                  return (
                    <div key={t.id}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors
                        ${isPendingDel ? 'bg-terracotta-DEFAULT/5' : ''}
                        ${idx < txns.length - 1 ? 'border-b border-earth-200' : ''}`}>

                      {/* settled toggle */}
                      <button onClick={() => toggleSettled(t.id, t.is_settled)}
                        className="flex-shrink-0 hover:opacity-70 transition min-w-[20px]"
                        title={t.is_settled ? '點擊標為不計算' : '點擊標為計算'}>
                        {t.is_settled
                          ? <CheckSquare size={18} className="text-sage-DEFAULT" />
                          : <Square size={18} className="text-earth-400" />}
                      </button>

                      {/* content */}
                      <div className={`flex-1 min-w-0 ${isPendingDel ? 'opacity-40' : ''}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium text-earth-800 truncate
                            ${!t.is_settled ? 'opacity-50 line-through' : ''}`}>
                            {t.item_name || '（未命名）'}
                          </span>
                          <TypeBadge type={t.type} />
                          {t.card_name && (
                            <span className="text-[10px] text-earth-500 bg-earth-200 px-1.5 py-0.5 rounded-md font-medium">
                              {t.card_name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-earth-600 flex-wrap">
                          <span>{t.category}</span>
                          {t.subcategory && <><span>·</span><span>{t.subcategory}</span></>}
                          <span>·</span>
                          <span>{t.account}</span>
                          {t.note && (
                            <>
                              <span>·</span>
                              <span className="italic text-earth-500 truncate max-w-[140px]" title={t.note}>
                                {t.note}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* amount */}
                      {!isPendingDel && (
                        <span className={`text-sm font-bold flex-shrink-0 ${amtColor}
                          ${!t.is_settled ? 'opacity-40' : ''}`}>
                          {sign}{fmtAbs(t.amount)}
                        </span>
                      )}

                      {/* delete confirm or action buttons */}
                      {isPendingDel ? (
                        <DeleteConfirm
                          onConfirm={() => { deleteTransaction(t.id); setDeleteTarget(null) }}
                          onCancel={() => setDeleteTarget(null)}
                        />
                      ) : (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => setEditTarget(t)}
                            className="p-1.5 rounded-lg hover:bg-earth-200 text-earth-600 transition" title="編輯">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeleteTarget(t.id)}
                            className="p-1.5 rounded-lg hover:bg-terracotta-DEFAULT/10 text-earth-400
                              hover:text-terracotta-DEFAULT transition" title="刪除">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      {editTarget && (
        <EditDrawer transaction={editTarget} onClose={() => setEditTarget(null)} />
      )}
    </div>
  )
}
