import { useState, useMemo } from 'react'
import { useApp } from '../context/TransactionContext'
import EditDrawer from '../components/EditDrawer'
import {
  Pencil, Trash2, CheckSquare, Square, ChevronDown,
  TrendingUp, TrendingDown, Wallet, Tag, X,
  CheckCheck, MinusSquare,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'

function fmtAbs(n) {
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(Math.abs(n))
}
function fmtCur(n) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)
}

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

// ── inline delete confirmation component ─────────────────────────────────────
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

export default function History() {
  const {
    allTransactions,
    selectedAccount, setSelectedAccount,
    accounts, accountBalances,
    toggleSettled, bulkSetSettled, deleteTransaction,
    dbCategoryMap,
  } = useApp()

  const [editTarget,    setEditTarget]    = useState(null)
  const [deleteTarget,  setDeleteTarget]  = useState(null) // id of row pending delete confirmation
  const [showCatFilter, setShowCatFilter] = useState(false)

  // ── date range ────────────────────────────────────────────────────────────
  const thisMonth = (() => {
    const y = new Date().getFullYear(), m = new Date().getMonth()
    return { from: format(new Date(y, m, 1), 'yyyy-MM-dd'), to: format(new Date(y, m + 1, 0), 'yyyy-MM-dd') }
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

  // ── is_settled filter ─────────────────────────────────────────────────────
  // 'all' | 'settled' | 'unsettled'
  const [settledFilter, setSettledFilter] = useState('all')

  // ── category multi-select ─────────────────────────────────────────────────
  const [selectedCats, setSelectedCats] = useState([])
  const [selectedSubs, setSelectedSubs] = useState([])

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

  // ── final filter ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return preFilteredForCats.filter(t => {
      const matchCat     = !selectedCats.length || selectedCats.includes(t.category)
      const matchSub     = !selectedSubs.length || selectedSubs.includes(t.subcategory)
      const matchSettled =
        settledFilter === 'all'      ? true :
        settledFilter === 'settled'  ? t.is_settled === true :
        /* unsettled */                t.is_settled === false
      return matchCat && matchSub && matchSettled
    })
  }, [preFilteredForCats, selectedCats, selectedSubs, settledFilter])

  // ── summary ───────────────────────────────────────────────────────────────
  const periodIncome  = useMemo(() => filtered.filter(t => t.type === 'Income').reduce((s, t) => s + Number(t.amount), 0), [filtered])
  const periodExpense = useMemo(() => filtered.filter(t => t.type === 'Expense').reduce((s, t) => s + Number(t.amount), 0), [filtered])
  const periodNet     = periodIncome - periodExpense
  const acctBalance   = selectedAccount !== 'All' ? (accountBalances[selectedAccount] ?? 0) : null

  // ── bulk helpers ──────────────────────────────────────────────────────────
  const filteredIds        = useMemo(() => filtered.map(t => t.id), [filtered])
  const allSettled         = filtered.length > 0 && filtered.every(t => t.is_settled)
  const allUnsettled       = filtered.length > 0 && filtered.every(t => !t.is_settled)

  const handleBulkSettle   = () => bulkSetSettled(filteredIds, true)
  const handleBulkUnsettle = () => bulkSetSettled(filteredIds, false)

  // ── group by date ─────────────────────────────────────────────────────────
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

      {/* ── filter card ──────────────────────────────────────────────────── */}
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

        {/* date range + account */}
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={dateFrom} onChange={e => handleCustomDate('from', e.target.value)}
            className="bg-earth-50 border border-earth-200 rounded-xl px-3 py-2 text-sm text-earth-800
              focus:outline-none focus:border-earth-400 min-h-[44px]" />
          <span className="text-earth-600 text-sm">至</span>
          <input type="date" value={dateTo} onChange={e => handleCustomDate('to', e.target.value)}
            className="bg-earth-50 border border-earth-200 rounded-xl px-3 py-2 text-sm text-earth-800
              focus:outline-none focus:border-earth-400 min-h-[44px]" />
          <div className="relative ml-auto">
            <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}
              className="bg-earth-50 border border-earth-200 rounded-xl px-3 pr-8 py-2 text-sm
                text-earth-800 focus:outline-none focus:border-earth-400 min-h-[44px] appearance-none">
              <option value="All">全部帳戶</option>
              {accounts.map(a => <option key={a}>{a}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-earth-600 pointer-events-none" />
          </div>
        </div>

        {/* is_settled filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-earth-600 font-semibold">是否計算：</span>
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

      {/* ── summary bar ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-earth-100 border border-earth-200 rounded-xl p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-earth-600">期間收入</span>
            <TrendingUp size={13} className="text-sage-DEFAULT" />
          </div>
          <span className="text-base font-bold text-sage-DEFAULT">+{fmtAbs(periodIncome)}</span>
        </div>
        <div className="bg-earth-100 border border-earth-200 rounded-xl p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-earth-600">期間支出</span>
            <TrendingDown size={13} className="text-terracotta-DEFAULT" />
          </div>
          <span className="text-base font-bold text-terracotta-DEFAULT">-{fmtAbs(periodExpense)}</span>
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
            {selectedAccount !== 'All' ? `${selectedAccount} 餘額` : '篩選筆數'}
          </span>
          <span className="text-base font-bold text-earth-800">
            {selectedAccount !== 'All' ? fmtCur(acctBalance ?? 0) : `${filtered.length} 筆`}
          </span>
        </div>
      </div>

      {/* ── bulk action bar ───────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-earth-100 border border-earth-200 rounded-xl px-4 py-2.5">
          <span className="text-xs text-earth-600 font-semibold mr-1">一鍵批次：</span>
          <button onClick={handleBulkSettle} disabled={allSettled}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition
              ${allSettled
                ? 'opacity-40 cursor-not-allowed bg-earth-50 text-earth-600 border-earth-200'
                : 'bg-sage-DEFAULT/20 text-sage-dark border-sage-DEFAULT/30 hover:bg-sage-DEFAULT/30'}`}>
            <CheckCheck size={13} />
            全部標為計算
          </button>
          <button onClick={handleBulkUnsettle} disabled={allUnsettled}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition
              ${allUnsettled
                ? 'opacity-40 cursor-not-allowed bg-earth-50 text-earth-600 border-earth-200'
                : 'bg-terracotta-DEFAULT/10 text-terracotta-dark border-terracotta-DEFAULT/30 hover:bg-terracotta-DEFAULT/20'}`}>
            <MinusSquare size={13} />
            全部標為不計算
          </button>
          <span className="ml-auto text-xs text-earth-500">{filtered.length} 筆</span>
        </div>
      )}

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

      {/* ── transaction list ──────────────────────────────────────────────── */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-earth-600 text-sm">此條件無交易記錄</div>
      ) : (
        grouped.map(([date, txns]) => {
          let parsedDate
          try { parsedDate = parseISO(date) } catch { parsedDate = null }
          const dateLabel = parsedDate
            ? format(parsedDate, 'M 月 d 日 (EEE)', { locale: zhTW })
            : date

          const dayExpense = txns.filter(t => t.type === 'Expense').reduce((s, t) => s + Number(t.amount), 0)
          const dayIncome  = txns.filter(t => t.type === 'Income').reduce((s, t) => s + Number(t.amount), 0)

          return (
            <div key={date}>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-earth-600">{dateLabel}</span>
                <div className="flex gap-3 text-xs">
                  {dayIncome  > 0 && <span className="text-sage-DEFAULT">+{fmtAbs(dayIncome)}</span>}
                  {dayExpense > 0 && <span className="text-terracotta-DEFAULT">-{fmtAbs(dayExpense)}</span>}
                </div>
              </div>

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

                      {/* content — shrinks to make room for delete confirm */}
                      <div className={`flex-1 min-w-0 ${isPendingDel ? 'opacity-40' : ''}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium text-earth-800 truncate ${!t.is_settled ? 'opacity-50 line-through' : ''}`}>
                            {t.item_name || '（未命名）'}
                          </span>
                          <TypeBadge type={t.type} />
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-earth-600 flex-wrap">
                          <span>{t.category}</span>
                          {t.subcategory && <><span>·</span><span>{t.subcategory}</span></>}
                          <span>·</span>
                          <span>{t.account}</span>
                        </div>
                      </div>

                      {/* amount */}
                      {!isPendingDel && (
                        <span className={`text-sm font-bold flex-shrink-0 ${amtColor} ${!t.is_settled ? 'opacity-40' : ''}`}>
                          {sign}{fmtAbs(t.amount)}
                        </span>
                      )}

                      {/* delete confirm inline */}
                      {isPendingDel ? (
                        <DeleteConfirm
                          onConfirm={() => { deleteTransaction(t.id); setDeleteTarget(null) }}
                          onCancel={() => setDeleteTarget(null)}
                        />
                      ) : (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* edit */}
                          <button onClick={() => setEditTarget(t)}
                            className="p-1.5 rounded-lg hover:bg-earth-200 text-earth-600 transition"
                            title="編輯">
                            <Pencil size={14} />
                          </button>
                          {/* delete */}
                          <button onClick={() => setDeleteTarget(t.id)}
                            className="p-1.5 rounded-lg hover:bg-terracotta-DEFAULT/10 text-earth-400
                              hover:text-terracotta-DEFAULT transition"
                            title="刪除">
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
