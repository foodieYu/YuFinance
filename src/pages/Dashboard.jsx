import { useApp } from '../context/TransactionContext'
import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Wallet, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  DndContext, closestCenter,
  PointerSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable,
  arrayMove, horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const PIE_COLORS = [
  '#8FA489', '#C87A65', '#D4C4A8', '#A89070', '#BEAA88',
  '#6B5C55', '#8C7A6B', '#DFA896', '#B2C4AE', '#6A7D64',
]

function fmt(n) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency', currency: 'TWD', maximumFractionDigits: 0,
  }).format(n)
}

// ── 靜態「總資產」卡片（不可拖曳）────────────────────────────────────────────
function TotalCard({ balance, active, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`flex-shrink-0 flex flex-col justify-between rounded-2xl p-3 w-[140px] h-[88px]
        cursor-pointer select-none transition-all duration-150
        ${active
          ? 'bg-earth-800 text-earth-50 shadow-lg'
          : 'bg-earth-100 text-earth-800 border border-earth-200 hover:border-earth-400'}`}
    >
      <span className={`text-xs font-medium tracking-wide truncate ${active ? 'text-earth-200' : 'text-earth-600'}`}>
        總資產
      </span>
      <span className={`text-sm font-bold leading-tight whitespace-nowrap overflow-hidden text-ellipsis
        ${balance < 0 ? (active ? 'text-red-300' : 'text-terracotta-DEFAULT') : ''}`}>
        {fmt(balance)}
      </span>
    </div>
  )
}

// ── 可拖曳帳戶卡片（dnd-kit）─────────────────────────────────────────────────
function SortableAccountCard({ id, label, balance, active, onClick }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      // touch-none：防止 iOS Safari 在拖曳時觸發頁面捲動
      className={`flex-shrink-0 flex flex-col justify-between rounded-2xl p-3 w-[140px] h-[88px]
        select-none relative group touch-none transition-all duration-150
        ${isDragging ? 'opacity-50 scale-105 z-50 shadow-xl' : ''}
        ${active
          ? 'bg-earth-800 text-earth-50 shadow-lg'
          : 'bg-earth-100 text-earth-800 border border-earth-200 hover:border-earth-400'}`}
    >
      {/* 拖曳把手提示（hover/focus 才顯示；純裝飾，實際拖曳區域為整張卡片）*/}
      <span className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-40 transition pointer-events-none">
        <GripVertical size={12} className={active ? 'text-earth-200' : 'text-earth-600'} />
      </span>

      {/* 點擊切換帳戶（z-10，在 dnd-kit listeners 之上；短按觸發，長按不觸發）*/}
      <button onClick={onClick} className="absolute inset-0 rounded-2xl z-10" aria-label={label} />

      <span className={`text-xs font-medium tracking-wide truncate relative z-20 pointer-events-none
        ${active ? 'text-earth-200' : 'text-earth-600'}`}>
        {label}
      </span>
      <span className={`text-sm font-bold leading-tight relative z-20 pointer-events-none whitespace-nowrap overflow-hidden text-ellipsis
        ${balance < 0 ? (active ? 'text-red-300' : 'text-terracotta-DEFAULT') : ''}`}>
        {fmt(balance)}
      </span>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, Icon, color, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-earth-100 border border-earth-200 rounded-2xl p-3 md:p-4 flex flex-col gap-2 min-w-0
        transition-all duration-150
        ${onClick ? 'cursor-pointer hover:bg-earth-200 hover:border-earth-300 active:scale-[0.98]' : ''}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs text-earth-600 font-medium truncate">{label}</span>
        <Icon size={14} className={`${color} flex-shrink-0`} />
      </div>
      <span className={`text-sm font-bold tracking-tight ${color} whitespace-nowrap`}>
        {fmt(value)}
      </span>
    </div>
  )
}

// ── Pie label ─────────────────────────────────────────────────────────────────
const RADIAN = Math.PI / 180
function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.05) return null
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#FDFBF7" textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight="600">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ── 實質收支過濾（全視圖統一，不分 All / 單一帳戶）─────────────────────────────
// 排除純內部流動科目，防止重複計算
const EXCLUDED_CATEGORIES = ['內部轉帳', '信用卡繳費']

// 支出：Expense + Transfer Out，皆排除 EXCLUDED_CATEGORIES
const isRealExpense = (t) =>
  (t.type === 'Expense' || t.type === 'Transfer Out') &&
  !EXCLUDED_CATEGORIES.includes(t.category)

// 收入：Income + Transfer In，皆排除 EXCLUDED_CATEGORIES
const isRealIncome = (t) =>
  (t.type === 'Income' || t.type === 'Transfer In') &&
  !EXCLUDED_CATEGORIES.includes(t.category)

// ── localStorage order helpers ────────────────────────────────────────────────
const STORAGE_KEY = 'accountOrder_v1'
function loadOrder() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
}
function saveOrder(order) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)) } catch {}
}

// ── month navigation helper ───────────────────────────────────────────────────
function shiftMonth(yyyyMM, delta) {
  const [y, m] = yyyyMM.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const {
    allTransactions,
    accounts, accountBalances, totalBalance,
    selectedAccount, setSelectedAccount,
    navigate,
  } = useApp()

  // ── 總覽頁獨立的月份狀態 (不影響 Context 的 selectedMonth) ───────────────────
  const todayYM = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const [dashboardMonth, setDashboardMonth] = useState(todayYM)

  const [dy, dm] = dashboardMonth.split('-')
  const monthLabel = `${dy} 年 ${parseInt(dm)} 月`
  const singleAcct = selectedAccount !== 'All'   // 僅用於 UI label

  // ── 月份過濾後的交易（帳戶資金池不使用，只給 KPI 和圓餅圖用）─────────────────
  const dashTxns = useMemo(() => {
    const prefix = dashboardMonth + '-'
    return allTransactions.filter(t => {
      const matchMonth = (t.transaction_date ?? '').startsWith(prefix)
      const matchAcct  = selectedAccount === 'All' || t.account === selectedAccount
      return matchMonth && matchAcct
    })
  }, [allTransactions, dashboardMonth, selectedAccount])

  // ── KPI：實質收支（Expense/Transfer Out 與 Income/Transfer In，統一排除 EXCLUDED_CATEGORIES）
  const dashIncome  = useMemo(() =>
    dashTxns.filter(isRealIncome).reduce((s, t) => s + Number(t.amount), 0),
    [dashTxns]
  )
  const dashExpense = useMemo(() =>
    dashTxns.filter(isRealExpense).reduce((s, t) => s + Number(t.amount), 0),
    [dashTxns]
  )
  const dashNet = dashIncome - dashExpense

  // ── 支出主分類（圓餅圖）── 與 KPI 完全相同的 filter，保證加總一致 ────────────
  const dashCategoryBreakdown = useMemo(() =>
    dashTxns.filter(isRealExpense).reduce((acc, t) => {
      const cat = t.category || '其他'
      acc[cat] = (acc[cat] || 0) + Number(t.amount)
      return acc
    }, {}),
    [dashTxns]
  )

  const pieData = Object.entries(dashCategoryBreakdown)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // ── 共用：計算 dashboardMonth 的 dateFrom / dateTo ────────────────────────
  const getDashMonthRange = () => {
    const [y, m] = dashboardMonth.split('-').map(Number)
    return {
      dateFrom: `${dashboardMonth}-01`,
      dateTo:   `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`,
    }
  }

  // ── 圓餅圖點擊 → 跳到明細頁帶入分類 + 月份 ──────────────────────────────────
  const handleCategoryClick = (categoryName) => {
    if (!categoryName) return
    navigate('history', { ...getDashMonthRange(), category: categoryName, preset: 'custom' })
  }

  // ── KPI 點擊 → 跳到明細頁帶入 type 篩選 + 月份 ───────────────────────────────
  // 統一傳遞 excludedCats + isExcludeMode，確保明細頁與 KPI 數字完全一致
  const handleKpiClick = (targetTypes) => {
    navigate('history', {
      ...getDashMonthRange(),
      targetTypes,
      preset: 'custom',
      excludedCats: EXCLUDED_CATEGORIES,
      isExcludeMode: true,
    })
  }

  // ── dnd-kit：帳戶排序 ─────────────────────────────────────────────────────
  const [accountOrder, setAccountOrder] = useState(loadOrder)

  // PointerSensor：滑鼠/觸控筆，移動 8px 才觸發拖曳（確保短按仍能切換帳戶）
  // TouchSensor：手指觸控，按住 200ms 才觸發拖曳（確保短按仍能切換帳戶）
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const sortedAccounts = useMemo(() => {
    if (!accountOrder) return accounts
    const ordered = accountOrder.filter(a => accounts.includes(a))
    const newOnes  = accounts.filter(a => !accountOrder.includes(a))
    return [...ordered, ...newOnes]
  }, [accounts, accountOrder])

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIdx = sortedAccounts.indexOf(active.id)
    const newIdx = sortedAccounts.indexOf(over.id)
    const next = arrayMove(sortedAccounts, oldIdx, newIdx)
    setAccountOrder(next)
    saveOrder(next)
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">

      {/* ── header ───────────────────────────────────────────────────────── */}
      <div className="pt-2">
        <h1 className="text-xl font-bold text-earth-800">主頁總覽</h1>
      </div>

      {/* ── account cards（帳戶資金池，不受 dashboardMonth 影響）───────────── */}
      <section>
        <p className="text-xs text-earth-600 font-medium mb-3 uppercase tracking-widest">
          帳戶資金池
          <span className="ml-2 normal-case font-normal opacity-50 text-[10px]">長按可拖曳排序</span>
        </p>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortedAccounts} strategy={horizontalListSortingStrategy}>
            <div className="flex flex-wrap gap-3">
              {/* 總資產：靜態，不可拖曳 */}
              <TotalCard
                balance={totalBalance}
                active={selectedAccount === 'All'}
                onClick={() => setSelectedAccount('All')}
              />
              {/* 各帳戶：可拖曳 */}
              {sortedAccounts.map(acct => (
                <SortableAccountCard
                  key={acct}
                  id={acct}
                  label={acct}
                  balance={accountBalances[acct] ?? 0}
                  active={selectedAccount === acct}
                  onClick={() => setSelectedAccount(acct)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      {/* ── KPI（依 dashboardMonth + selectedAccount 動態計算）──────────────── */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <p className="text-xs text-earth-600 font-medium uppercase tracking-widest">
            {monthLabel}
            {singleAcct ? ` · ${selectedAccount}` : ''} KPI
            <span className="ml-1 normal-case font-normal opacity-50 text-[10px]">含轉入/轉出</span>
          </p>

          {/* month picker：左右箭頭 + 原生 input[type=month] */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDashboardMonth(m => shiftMonth(m, -1))}
              className="p-1.5 rounded-lg hover:bg-earth-200 text-earth-600 transition active:scale-95"
              aria-label="上個月">
              <ChevronLeft size={16} />
            </button>

            <input
              type="month"
              value={dashboardMonth}
              onChange={e => e.target.value && setDashboardMonth(e.target.value)}
              className="bg-earth-100 border border-earth-200 rounded-lg px-3 py-1.5 text-sm
                text-earth-800 focus:outline-none focus:border-earth-400 focus:ring-1
                focus:ring-earth-300 transition cursor-pointer min-h-[36px]
                [color-scheme:light]"
            />

            <button
              onClick={() => setDashboardMonth(m => shiftMonth(m, +1))}
              className="p-1.5 rounded-lg hover:bg-earth-200 text-earth-600 transition active:scale-95"
              aria-label="下個月">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <KpiCard label="本月收入" value={dashIncome}  Icon={TrendingUp}   color="text-sage-DEFAULT"
            onClick={() => handleKpiClick(['Income', 'Transfer In'])} />
          <KpiCard label="本月支出" value={dashExpense} Icon={TrendingDown} color="text-terracotta-DEFAULT"
            onClick={() => handleKpiClick(['Expense', 'Transfer Out'])} />
          <KpiCard label="淨結餘" value={dashNet} Icon={Wallet}
            color={dashNet >= 0 ? 'text-sage-DEFAULT' : 'text-terracotta-DEFAULT'} />
        </div>
      </section>

      {/* ── pie chart（依 dashboardMonth 動態計算）───────────────────────────── */}
      <section>
        <p className="text-xs text-earth-600 font-medium mb-3 uppercase tracking-widest">支出主分類</p>
        <div className="bg-earth-100 border border-earth-200 rounded-2xl p-4">
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-earth-600 text-sm">
              {monthLabel}無支出記錄
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData} cx="50%" cy="50%" outerRadius={90}
                    dataKey="value" labelLine={false} label={<CustomLabel />}
                    onClick={(data) => handleCategoryClick(data?.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => [fmt(v), '']}
                    contentStyle={{ background: '#F4EFE6', border: '1px solid #E6DCC8', borderRadius: 12, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* legend — 點擊跳轉明細 */}
              <div className="grid grid-cols-2 gap-1 mt-2">
                {pieData.map((entry, i) => (
                  <button
                    key={entry.name}
                    onClick={() => handleCategoryClick(entry.name)}
                    className="flex items-center gap-2 text-xs rounded-lg px-2 py-1.5
                      hover:bg-earth-200 active:scale-95 transition text-left group"
                    title={`查看「${entry.name}」明細`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-earth-600 truncate group-hover:text-earth-800">{entry.name}</span>
                    <span className="ml-auto text-earth-800 font-medium whitespace-nowrap">{fmt(entry.value)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
