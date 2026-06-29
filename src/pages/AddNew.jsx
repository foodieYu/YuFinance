import { useState } from 'react'
import { useApp } from '../context/TransactionContext'
import { format } from 'date-fns'
import { ChevronDown } from 'lucide-react'

const TYPE_OPTIONS = [
  { key: 'Expense',      label: '支出', icon: '/expense.png' },
  { key: 'Income',       label: '收入', icon: '/income.png' },
  { key: 'Transfer In',  label: '轉入', icon: '/transfer-in.png' },
  { key: 'Transfer Out', label: '轉出', icon: '/transfer-out.png' },
]

const PAYMENT_OPTIONS = ['', '刷卡', '現金', '轉帳', 'Apple Pay', 'Line Pay']

const defaultForm = () => ({
  transaction_date: format(new Date(), 'yyyy-MM-dd'),
  amount: '',
  type: 'Expense',
  account: '',
  item_name: '',
  category: '',
  subcategory: '',
  payment_method: '',
  card_name: '',
  is_settled: true,
  note: '',
})

const inputCls = `w-full bg-earth-100 border border-earth-200 rounded-xl px-4 py-3
  text-earth-800 text-base placeholder-earth-400 focus:outline-none focus:border-earth-400
  focus:ring-1 focus:ring-earth-300 transition min-h-[44px]`

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-earth-600 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

export default function AddNew() {
  const {
    addTransaction,
    accounts: existingAccounts,
    dbCategoryMap,
    dbTypeCategoryMap,
    dbCardNames,
    dbItemNames,
  } = useApp()

  const [form, setForm] = useState(defaultForm())
  const [submitting, setSubmitting] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── dynamic categories based on selected type ────────────────────────────
  // Use DB-derived map; fall back to all categories if type has no history yet
  const availableCats = (() => {
    const fromDb = dbTypeCategoryMap[form.type] ?? []
    if (fromDb.length > 0) return fromDb
    // fallback: all categories from DB
    return Object.keys(dbCategoryMap).sort()
  })()

  // ── subcategories for selected category ──────────────────────────────────
  const subcatOptions = form.category ? (dbCategoryMap[form.category] ?? []) : []

  // ── account list (DB + common presets deduplicated) ──────────────────────
  const PRESET_ACCOUNTS = ['LINE BANK', '富邦', '渣打', 'CUBE', '中國信託', 'DAWHO', '現金']
  const allAccounts = [...new Set([...PRESET_ACCOUNTS, ...existingAccounts])].filter(Boolean)

  const handleSubmit = async () => {
    if (!form.amount || Number(form.amount) <= 0) { alert('請輸入有效金額'); return }
    if (!form.account)   { alert('請選擇帳戶'); return }
    if (!form.item_name) { alert('請填寫項目名稱'); return }

    setSubmitting(true)
    try {
      await addTransaction({
        transaction_date: form.transaction_date,
        amount:           Number(form.amount),
        type:             form.type,
        account:          form.account,
        item_name:        form.item_name,
        category:         form.category,
        subcategory:      form.subcategory,
        payment_method:   form.payment_method,
        card_name:        form.card_name,
        is_settled:       form.is_settled,
        note:             form.note,
      })
      setForm(defaultForm())   // clear form on success
    } catch (e) {
      alert('記帳失敗：' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto space-y-5 pb-28">
      <h1 className="text-xl font-bold text-earth-800 pt-2">快速記帳</h1>

      {/* ── date + amount (stack on mobile, 2-col on sm+) ─────────────── */}
      <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 min-w-0">
        <Field label="交易日期">
          {/* overflow-hidden 防止 iOS Safari date input 撐破父容器 */}
          <div className="overflow-hidden min-w-0">
            <input type="date" value={form.transaction_date}
              onChange={e => set('transaction_date', e.target.value)}
              className={inputCls + ' appearance-none box-border max-w-full [color-scheme:light]'} />
          </div>
        </Field>
        <Field label="金額">
          <input
            type="number" inputMode="decimal"
            value={form.amount}
            onChange={e => set('amount', e.target.value)}
            placeholder="0"
            className={inputCls + ' text-2xl font-bold tracking-tight'}
          />
        </Field>
      </div>

      {/* ── type ─────────────────────────────────────────────────────────── */}
      <Field label="收支類型">
        <div className="grid grid-cols-2 gap-2">
          {TYPE_OPTIONS.map(({ key, label, icon }) => (
            <button key={key}
              onClick={() => { set('type', key); set('category', ''); set('subcategory', '') }}
              className={`py-3 rounded-xl text-sm font-semibold border-2 transition active:scale-95 flex items-center justify-center gap-2
                ${form.type === key
                  ? 'bg-earth-800 text-earth-50 border-earth-800 shadow-md'
                  : 'bg-earth-100 text-earth-600 border-earth-200 hover:border-earth-400'}`}>
              <img src={icon} alt={label} className="w-5 h-5 object-contain flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </Field>

      {/* ── account ──────────────────────────────────────────────────────── */}
      <Field label="交易帳戶">
        <div className="grid grid-cols-3 gap-2">
          {allAccounts.map(a => (
            <button key={a} onClick={() => set('account', a)}
              className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition active:scale-95
                ${form.account === a
                  ? 'bg-earth-800 text-earth-50 border-earth-800'
                  : 'bg-earth-100 text-earth-600 border-earth-200 hover:border-earth-300'}`}>
              {a}
            </button>
          ))}
        </div>
      </Field>

      {/* ── item name (with autocomplete from history) ───────────────────── */}
      <Field label="項目名稱">
        <input
          list="item-name-suggestions"
          value={form.item_name}
          onChange={e => set('item_name', e.target.value)}
          placeholder="例：午餐便當"
          className={inputCls}
          autoComplete="off"
        />
        <datalist id="item-name-suggestions">
          {dbItemNames
            .filter(n => !form.item_name || n.toLowerCase().includes(form.item_name.toLowerCase()))
            .slice(0, 30)
            .map(n => <option key={n} value={n} />)}
        </datalist>
      </Field>

      {/* ── category (dynamic from DB) ───────────────────────────────────── */}
      <Field label="主分類">
        {availableCats.length === 0 ? (
          <input value={form.category} onChange={e => set('category', e.target.value)}
            placeholder="輸入分類名稱" className={inputCls} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableCats.map(c => (
              <button key={c}
                onClick={() => { set('category', c); set('subcategory', '') }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition min-h-[36px] active:scale-95
                  ${form.category === c
                    ? 'bg-earth-800 text-earth-50 border-earth-800'
                    : 'bg-earth-100 text-earth-600 border-earth-200 hover:border-earth-400'}`}>
                {c}
              </button>
            ))}
          </div>
        )}
      </Field>

      {/* ── subcategory (dynamic from DB) ────────────────────────────────── */}
      {(subcatOptions.length > 0 || form.category) && (
        <Field label="子分類">
          <div className="relative">
            <select value={form.subcategory} onChange={e => set('subcategory', e.target.value)}
              className={inputCls + ' appearance-none pr-8'}>
              <option value="">（無）</option>
              {subcatOptions.map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-earth-600 pointer-events-none" />
          </div>
        </Field>
      )}

      {/* ── advanced fields ───────────────────────────────────────────────── */}
      <details className="group">
        <summary className="cursor-pointer text-xs font-semibold text-earth-600 uppercase tracking-wider
          list-none flex items-center gap-2 select-none">
          <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
          進階欄位（選填）
        </summary>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="付款方式">
              <div className="relative">
                <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)}
                  className={inputCls + ' appearance-none pr-8'}>
                  {PAYMENT_OPTIONS.map(p => <option key={p} value={p}>{p || '（未填）'}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-earth-600 pointer-events-none" />
              </div>
            </Field>

            {/* card_name — combobox: can type or pick from history */}
            <Field label="信用卡名">
              <input
                list="card-name-options"
                value={form.card_name}
                onChange={e => set('card_name', e.target.value)}
                placeholder="輸入或選擇卡名"
                className={inputCls}
              />
              <datalist id="card-name-options">
                {dbCardNames.map(c => <option key={c} value={c} />)}
              </datalist>
            </Field>
          </div>

          <Field label="備註">
            <textarea value={form.note} onChange={e => set('note', e.target.value)}
              placeholder="備註說明（選填）"
              className={inputCls + ' resize-none'} rows={2} />
          </Field>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_settled} onChange={e => set('is_settled', e.target.checked)}
              className="w-5 h-5 rounded accent-earth-800" />
            <span className="text-sm text-earth-800">納入帳戶餘額計算</span>
          </label>
        </div>
      </details>

      {/* ── submit ────────────────────────────────────────────────────────── */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 bg-earth-800 text-earth-50
          rounded-2xl py-4 font-bold text-base shadow-lg hover:bg-earth-700 active:scale-[0.98]
          transition disabled:opacity-60 min-h-[56px] sticky bottom-20 md:bottom-4"
      >
        <img src="/submit.png" alt="" className="w-5 h-5 object-contain flex-shrink-0" />
        {submitting ? '記帳中…' : '確認記帳'}
      </button>
    </div>
  )
}
