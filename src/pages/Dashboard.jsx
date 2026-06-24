import { useApp } from '../context/TransactionContext'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'

// ─── colour palette for pie slices ──────────────────────────────────────────
const PIE_COLORS = [
  '#8FA489', '#C87A65', '#D4C4A8', '#A89070', '#BEAA88',
  '#6B5C55', '#8C7A6B', '#DFA896', '#B2C4AE', '#6A7D64',
]

function fmt(n) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)
}

// ─── Account Card ────────────────────────────────────────────────────────────
function AccountCard({ label, balance, active, onClick, isTotal }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 flex flex-col justify-between rounded-2xl p-4 min-w-[140px] h-[96px]
        transition-all duration-200 text-left cursor-pointer select-none
        ${active
          ? 'bg-earth-800 text-earth-50 shadow-lg scale-[1.03]'
          : 'bg-earth-100 text-earth-800 border border-earth-200 hover:border-earth-400'}`}
    >
      <span className={`text-xs font-medium tracking-wide truncate ${active ? 'text-earth-200' : 'text-earth-600'}`}>
        {label}
      </span>
      <div>
        <span className={`text-base font-bold leading-tight ${balance < 0 ? (active ? 'text-red-300' : 'text-terracotta-DEFAULT') : ''}`}>
          {fmt(balance)}
        </span>
      </div>
    </button>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, Icon, color }) {
  return (
    <div className="bg-earth-100 border border-earth-200 rounded-2xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-earth-600 font-medium">{label}</span>
        <Icon size={16} className={color} />
      </div>
      <span className={`text-xl font-bold ${color}`}>{fmt(value)}</span>
    </div>
  )
}

// ─── Custom Pie Label ────────────────────────────────────────────────────────
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

export default function Dashboard() {
  const {
    accounts, accountBalances, totalBalance,
    selectedAccount, setSelectedAccount,
    monthIncome, monthExpense, monthNet,
    categoryBreakdown,
    selectedMonth,
  } = useApp()

  const pieData = Object.entries(categoryBreakdown)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const [y, m] = selectedMonth.split('-')
  const monthLabel = `${y} 年 ${parseInt(m)} 月`

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      {/* ── header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold text-earth-800">主頁總覽</h1>
        <span className="text-sm text-earth-600 bg-earth-100 border border-earth-200 rounded-lg px-3 py-1.5">
          {monthLabel}
        </span>
      </div>

      {/* ── account scroll ───────────────────────────────────────────────── */}
      <section>
        <p className="text-xs text-earth-600 font-medium mb-3 uppercase tracking-widest">帳戶資金池</p>
        <div className="flex flex-wrap gap-3">
          {/* Total card */}
          <AccountCard
            label="總資產"
            balance={totalBalance}
            active={selectedAccount === 'All'}
            onClick={() => setSelectedAccount('All')}
            isTotal
          />
          {/* Per-account cards */}
          {accounts.map(acct => (
            <AccountCard
              key={acct}
              label={acct}
              balance={accountBalances[acct] ?? 0}
              active={selectedAccount === acct}
              onClick={() => setSelectedAccount(acct)}
            />
          ))}
        </div>
      </section>

      {/* ── month KPI ────────────────────────────────────────────────────── */}
      <section>
        <p className="text-xs text-earth-600 font-medium mb-3 uppercase tracking-widest">
          {monthLabel} {selectedAccount !== 'All' ? `· ${selectedAccount}` : ''} KPI
        </p>
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="本月收入" value={monthIncome}  Icon={TrendingUp}   color="text-sage-DEFAULT" />
          <KpiCard label="本月支出" value={monthExpense} Icon={TrendingDown} color="text-terracotta-DEFAULT" />
          <KpiCard label="淨結餘"   value={monthNet}     Icon={Wallet}       color={monthNet >= 0 ? 'text-sage-DEFAULT' : 'text-terracotta-DEFAULT'} />
        </div>
      </section>

      {/* ── category pie chart ───────────────────────────────────────────── */}
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
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    labelLine={false}
                    label={<CustomLabel />}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => [fmt(v), '']}
                    contentStyle={{
                      background: '#F4EFE6',
                      border: '1px solid #E6DCC8',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* legend */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                {pieData.map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-earth-600 truncate">{entry.name}</span>
                    <span className="ml-auto text-earth-800 font-medium">{fmt(entry.value)}</span>
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
