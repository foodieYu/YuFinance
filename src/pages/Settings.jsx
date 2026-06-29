import { useApp } from '../context/TransactionContext'
import { LogOut, User, Database, RefreshCw, BookOpen, CheckCircle2 } from 'lucide-react'

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-earth-200 last:border-0">
      <span className="text-sm text-earth-600">{label}</span>
      <span className="text-sm font-medium text-earth-800 text-right max-w-[60%] break-all">{value ?? '—'}</span>
    </div>
  )
}

export default function Settings() {
  const {
    user, signOut, refresh,
    allTransactions,
    availableLedgers, currentLedger, switchLedger,
  } = useApp()

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold text-earth-800 pt-2">系統設定</h1>

      {/* ── 帳本切換（只在有多個帳本時才顯示）──────────────────────────────── */}
      {availableLedgers.length > 1 && (
        <section className="bg-earth-100 border border-earth-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={16} className="text-earth-600" />
            <h2 className="text-sm font-bold text-earth-800 uppercase tracking-wider">帳本切換</h2>
          </div>

          <div className="space-y-2">
            {availableLedgers.map(ledger => {
              const active = currentLedger?.id === ledger.id
              return (
                <button
                  key={ledger.id}
                  onClick={() => switchLedger(ledger)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2
                    text-sm font-semibold transition active:scale-[0.98]
                    ${active
                      ? 'bg-earth-800 text-earth-50 border-earth-800'
                      : 'bg-earth-50 text-earth-600 border-earth-200 hover:border-earth-400'}`}
                >
                  <span className="flex items-center gap-2">
                    {active && <CheckCircle2 size={14} className="text-earth-300 flex-shrink-0" />}
                    {ledger.name}
                  </span>
                  <span className={`text-xs font-normal px-2 py-0.5 rounded-full
                    ${active
                      ? 'bg-earth-700 text-earth-200'
                      : 'bg-earth-200 text-earth-500'}`}>
                    {ledger.role === 'owner' ? '擁有者' : '成員'}
                  </span>
                </button>
              )
            })}
          </div>

          <p className="text-xs text-earth-500 mt-3">
            切換後將自動重新載入對應帳本的所有資料
          </p>
        </section>
      )}

      {/* ── 帳號資訊 ─────────────────────────────────────────────────────── */}
      <section className="bg-earth-100 border border-earth-200 rounded-2xl p-5 space-y-1">
        <div className="flex items-center gap-2 mb-3">
          <User size={16} className="text-earth-600" />
          <h2 className="text-sm font-bold text-earth-800 uppercase tracking-wider">帳號資訊</h2>
        </div>
        <InfoRow label="Email"        value={user?.email} />
        <InfoRow label="User ID (UID)" value={user?.id} />
        <InfoRow label="登入方式"      value={user?.app_metadata?.provider} />
        <InfoRow label="最後登入"      value={user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('zh-TW') : null} />
      </section>

      {/* ── 資料庫概況 ────────────────────────────────────────────────────── */}
      <section className="bg-earth-100 border border-earth-200 rounded-2xl p-5 space-y-1">
        <div className="flex items-center gap-2 mb-3">
          <Database size={16} className="text-earth-600" />
          <h2 className="text-sm font-bold text-earth-800 uppercase tracking-wider">資料庫概況</h2>
        </div>
        <InfoRow label="目前帳本"    value={currentLedger?.name ?? '—'} />
        <InfoRow label="帳本筆數"    value={`${allTransactions.length} 筆`} />
        <InfoRow label="Supabase Project" value={import.meta.env.VITE_SUPABASE_URL?.replace('https://', '').split('.')[0]} />
      </section>

      {/* ── 操作按鈕 ─────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <button
          onClick={refresh}
          className="w-full flex items-center justify-center gap-2 bg-earth-100 border border-earth-200
            text-earth-800 rounded-xl py-3.5 text-sm font-medium hover:bg-earth-200
            active:scale-[0.98] transition min-h-[44px]"
        >
          <RefreshCw size={16} />
          重新同步資料
        </button>

        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 bg-terracotta-DEFAULT/10 border border-terracotta-DEFAULT/30
            text-terracotta-dark rounded-xl py-3.5 text-sm font-medium hover:bg-terracotta-DEFAULT/20
            active:scale-[0.98] transition min-h-[44px]"
        >
          <LogOut size={16} />
          登出帳號
        </button>
      </section>

      <p className="text-center text-xs text-earth-600 opacity-50 pt-4 font-mono">Copyright © 2026 by FoodieYu</p>
    </div>
  )
}
