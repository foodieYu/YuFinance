import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { useApp } from '../context/TransactionContext'

const TYPE_OPTIONS = ['Expense', 'Income', 'Transfer In', 'Transfer Out']
const PAYMENT_OPTIONS = ['', '刷卡', '現金', '轉帳', 'Apple Pay', 'Line Pay']

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-earth-600 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

const inputCls = `w-full bg-earth-50 border border-earth-200 rounded-xl px-3 py-2.5
  text-earth-800 text-sm placeholder-earth-400 focus:outline-none focus:border-earth-400
  focus:ring-1 focus:ring-earth-300 transition min-h-[44px]`

export default function EditDrawer({ transaction, onClose }) {
  const { updateTransaction, showToast, dbCategoryMap, dbCardNames } = useApp()
  const [form, setSaving_] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (transaction) setSaving_({ ...transaction })
  }, [transaction])

  if (!transaction) return null

  const set = (k, v) => setSaving_(f => ({ ...f, [k]: v }))

  const subcatOptions = form.category ? (dbCategoryMap[form.category] ?? []) : []
  const allCategories = Object.keys(dbCategoryMap).sort()

  const handleSave = async () => {
    setSaving(true)
    try {
      // eslint-disable-next-line no-unused-vars
      const { id, created_at, user_id, ...payload } = form
      await updateTransaction(transaction.id, payload)
      showToast('已更新 ✓', 'success')
      onClose()
    } catch (e) {
      showToast('更新失敗：' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-40 bg-earth-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-earth-50 rounded-t-2xl shadow-2xl
        max-h-[90vh] overflow-y-auto md:max-w-lg md:mx-auto md:right-0">

        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-earth-200">
          <h2 className="text-base font-bold text-earth-800">編輯交易</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-earth-200">
            <X size={18} className="text-earth-600" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="日期">
              <input type="date" value={form.transaction_date ?? ''}
                onChange={e => set('transaction_date', e.target.value)} className={inputCls} />
            </Field>
            <Field label="金額">
              <input type="number" value={form.amount ?? ''}
                onChange={e => set('amount', e.target.value)}
                className={inputCls} placeholder="0" inputMode="decimal" />
            </Field>
          </div>

          <Field label="收支類型">
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map(t => (
                <button key={t} onClick={() => set('type', t)}
                  className={`py-2.5 rounded-xl text-xs font-medium border transition
                    ${form.type === t
                      ? 'bg-earth-800 text-earth-50 border-earth-800'
                      : 'bg-earth-100 text-earth-600 border-earth-200 hover:border-earth-400'}`}>
                  {t === 'Expense' ? '💸 支出' : t === 'Income' ? '💰 收入' : t === 'Transfer In' ? '⬇️ 轉入' : '⬆️ 轉出'}
                </button>
              ))}
            </div>
          </Field>

          <Field label="帳戶">
            <input value={form.account ?? ''} onChange={e => set('account', e.target.value)}
              className={inputCls} placeholder="帳戶名稱" />
          </Field>

          <Field label="項目名稱">
            <input value={form.item_name ?? ''} onChange={e => set('item_name', e.target.value)}
              className={inputCls} placeholder="交易項目" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="主分類">
              <select value={form.category ?? ''}
                onChange={e => { set('category', e.target.value); set('subcategory', '') }}
                className={inputCls}>
                <option value="">請選擇</option>
                {allCategories.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="子分類">
              <select value={form.subcategory ?? ''} onChange={e => set('subcategory', e.target.value)}
                className={inputCls}>
                <option value="">（無）</option>
                {subcatOptions.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="付款方式">
              <select value={form.payment_method ?? ''} onChange={e => set('payment_method', e.target.value)}
                className={inputCls}>
                {PAYMENT_OPTIONS.map(p => <option key={p} value={p}>{p || '（未填）'}</option>)}
              </select>
            </Field>
            <Field label="信用卡名">
              <input
                list="edit-card-name-options"
                value={form.card_name ?? ''}
                onChange={e => set('card_name', e.target.value)}
                placeholder="輸入或選擇卡名"
                className={inputCls}
              />
              <datalist id="edit-card-name-options">
                {dbCardNames.map(c => <option key={c} value={c} />)}
              </datalist>
            </Field>
          </div>

          <Field label="備註">
            <textarea value={form.note ?? ''} onChange={e => set('note', e.target.value)}
              className={inputCls + ' resize-none'} rows={2} placeholder="備註（選填）" />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!form.is_settled} onChange={e => set('is_settled', e.target.checked)}
              className="w-4 h-4 accent-earth-800" />
            <span className="text-sm text-earth-800">納入計算（已平帳）</span>
          </label>

          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-earth-800 text-earth-50
              rounded-xl py-3.5 font-semibold text-sm hover:bg-earth-700 active:scale-[0.98]
              transition disabled:opacity-60 min-h-[44px]">
            <Save size={16} />
            {saving ? '儲存中…' : '儲存變更'}
          </button>
        </div>
      </div>
    </>
  )
}
