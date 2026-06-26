import { useApp } from '../context/TransactionContext'
import { useState, useMemo, useRef } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Wallet, GripVertical } from 'lucide-react'

const PIE_COLORS = [
  '#8FA489', '#C87A65', '#D4C4A8', '#A89070', '#BEAA88',
  '#6B5C55', '#8C7A6B', '#DFA896', '#B2C4AE', '#6A7D64',
]

function fmt(n) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency', currency: 'TWD', maximumFractionDigits: 0,
  }).format(n)
}

// ── Account Card (with drag handle) ──────────────────────────────────────────
function AccountCard({ label, balance, active, onClick, draggable, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver }) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.() }}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`flex-shrink-0 flex flex-col justify-between rounded-2xl p-3 w-[140px] h-[88px]
        transition-all duration-150 select-none relative group
        ${isDragOver ? 'ring-2 ring-earth-400 scale-105 opacity-70' : ''}
        ${active
          ? 'bg-earth-800 text-earth-50 shadow-lg'
          : 'bg-earth-100 text-earth-800 border border-earth-200 hover:border-earth-400'}`}
    >
      {/* drag handle — shown on hover */}
      {draggable && (
        <span className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-40 transition cursor-grab active:cursor-grabbing">
          <GripVertical size={12} className={active ? 'text-earth-200' : 'text-earth-600'} />
        </span>
      )}

      <button onClick={onClick} className="absolute inset-0 rounded-2xl" aria-label={label} />

      <span className={`text-xs font-medium tracking-wide truncate relative z-10 pointer-events-none
        ${active ? 'text-earth-200' : 'text-earth-600'}`}>
        {label}
      </span>
      <span className={`text-sm font-bold leading-tight relative z-10 pointer-events-none whitespace-nowrap overflow-hidden text-ellipsis
        ${balance < 0
          ? (active ? 'text-red-300' : 'text-terracotta-DEFAULT')
          : ''}`}>
        {fmt(balance)}
      </span>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, Icon, color }) {
  return (
    <div className="bg-earth-100 border border-earth-200 rounded-2xl p-3 md:p-4 flex flex-col gap-2 min-w-0">
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

// ── localStorage order helpers ────────────────────────────────────────────────
const STORAGE_KEY = 'accountOrder_v1'
function loadOrder() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
}
function saveOrder(order) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)) } catch {}
}

export default function Dashboard() {
  const {
    accounts, accountBalances, totalBalance,
    selectedAccount, setSelectedAccount,
    monthIncome, monthExpense, monthNet,
    categoryBreakdown,
    selectedMonth,
  } = useApp()

  // ── drag state ────────────────────────────────────────────────────────────
  const [accountOrder, setAccountOrder] = useState(loadOrder)
  const dragIdx    = useRef(null)
  const dragOverIdx = useRef(null)
  const [dragOverKey, setDragOverKey] = useState(null)

  // Merge saved order with live accounts (new accounts appended at end)
  const sortedAccounts = useMemo(() => {
    if (!accountOrder) return accounts
    const ordered = accountOrder.filter(a => accounts.includes(a))
    const newOnes = accounts.filter(a => !accountOrder.includes(a))
    return [...ordered, ...newOnes]
  }, [accounts, accountOrder])

  const handleDragStart = (idx) => { dragIdx.current = idx }
  const handleDragOver  = (key, idx) => { dragOverIdx.current = idx; setDragOverKey(key) }
  const handleDrop = () => {
    const from = dragIdx.current
    const to   = dragOverIdx.current
    if (from === null || to === null || from === to) return
    const next = [...sortedAccounts]
    next.splice(to, 0, next.splice(from, 1)[0])
    setAccountOrder(next)
    saveOrder(next)
    dragIdx.current = null
    dragOverIdx.current = null
    setDragOverKey(null)
  }
  const handleDragEnd = () => {
    dragIdx.current = null
    dragOverIdx.current = null
    setDragOverKey(null)
  }

  const pieData = Object.entries(categoryBreakdown)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const [y, m] = selectedMonth.split('-')
  const monthLabel = `${y} 年 ${parseInt(m)} 月`

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      {/* header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold text-earth-800">主頁總覽</h1>
        <span className="text-sm text-earth-600 bg-earth-100 border border-earth-200 rounded-lg px-3 py-1.5">
          {monthLabel}
        </span>
      </div>

      {/* ── account cards (drag & drop) ──────────────────────────────────── */}
      <section>
        <p className="text-xs text-earth-600 font-medium mb-3 uppercase tracking-widest">
          帳戶資金池
          <span className="ml-2 normal-case font-normal opacity-50 text-[10px]">可拖曳排序</span>
        </p>
        <div className="flex flex-wrap gap-3">
          {/* Total — not draggable */}
          <AccountCard
            label="總資產"
            balance={totalBalance}
            active={selectedAccount === 'All'}
            onClick={() => setSelectedAccount('All')}
            draggable={false}
          />
          {/* Per-account cards */}
          {sortedAccounts.map((acct, idx) => (
            <AccountCard
              key={acct}
              label={acct}
              balance={accountBalances[acct] ?? 0}
              active={selectedAccount === acct}
              onClick={() => setSelectedAccount(acct)}
              draggable={true}
              isDragOver={dragOverKey === acct}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={() => handleDragOver(acct, idx)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      </section>

      {/* ── month KPI ────────────────────────────────────────────────────── */}
      <section>
        <p className="text-xs text-earth-600 font-medium mb-3 uppercase tracking-widest">
          {monthLabel} {selectedAccount !== 'All' ? `· ${selectedAccount}` : ''} KPI
        </p>
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <KpiCard label="本月收入" value={monthIncome}  Icon={TrendingUp}   color="text-sage-DEFAULT" />
          <KpiCard label="本月支出" value={monthExpense} Icon={TrendingDown} color="text-terracotta-DEFAULT" />
          <KpiCard label="淨結餘"   value={monthNet}     Icon={Wallet}
            color={monthNet >= 0 ? 'text-sage-DEFAULT' : 'text-terracotta-DEFAULT'} />
        </div>
      </section>

      {/* ── pie chart ────────────────────────────────────────────────────── */}
      <section>
        <p className="text-xs text-earth-600 font-medium mb-3 uppercase tracking-widest">支出主分類</p>
        <div className="bg-earth-100 border border-earth-200 rounded-2xl p-4">
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-earth-600 text-sm">
              本月無支出記錄
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={90}
                    dataKey="value" labelLine={false} label={<CustomLabel />}>
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
              <div className="grid grid-cols-2 gap-2 mt-2">
                {pieData.map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-earth-600 truncate">{entry.name}</span>
                    <span className="ml-auto text-earth-800 font-medium whitespace-nowrap">{fmt(entry.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
