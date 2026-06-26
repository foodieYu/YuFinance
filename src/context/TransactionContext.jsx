import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

const TransactionContext = createContext(null)

// ─── helpers ────────────────────────────────────────────────────────────────
function calcBalance(txns) {
  return txns.reduce((acc, t) => {
    if (!t.is_settled) return acc
    const amt = Number(t.amount)
    if (t.type === 'Income' || t.type === 'Transfer In') return acc + amt
    if (t.type === 'Expense' || t.type === 'Transfer Out') return acc - amt
    return acc
  }, 0)
}

export function TransactionProvider({ children }) {
  // ── global filter state ──────────────────────────────────────────────────
  const [selectedAccount, setSelectedAccount] = useState('All')
  const [selectedMonth, setSelectedMonth]     = useState(format(new Date(), 'yyyy-MM'))

  // ── data state ───────────────────────────────────────────────────────────
  const [allTransactions, setAllTransactions]   = useState([])
  const [monthTransactions, setMonthTransactions] = useState([])
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState([])

  // ── auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── fetch ALL transactions (突破 1000 筆限制 + 雙重排序防重複/遺漏) ──────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      let allData = []
      let from = 0
      const step = 1000

      while (true) {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .order('transaction_date', { ascending: false }) // 主排序
          .order('id',               { ascending: true  }) // 次排序 tie-breaker，防分頁錯亂
          .range(from, from + step - 1)

        if (error) throw error

        if (data && data.length > 0) {
          allData = [...allData, ...data]
          from += step
        }

        // 回傳筆數 < step 代表已到最後一頁
        if (!data || data.length < step) break
      }

      console.log(`✅ fetchAll 完成，共 ${allData.length} 筆`)
      setAllTransactions(allData)

    } catch (err) {
      console.error('fetchAll error', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // ── fetch MONTH transactions (分頁 + 雙重排序，與 fetchAll 同邏輯) ──────────
  const fetchMonth = useCallback(async (month) => {
    const dateFrom = `${month}-01`
    const [y, m]   = month.split('-').map(Number)
    const lastDay  = new Date(y, m, 0).getDate()
    const dateTo   = `${month}-${String(lastDay).padStart(2, '0')}`

    let allData = []
    let from    = 0
    const step  = 1000

    while (true) {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('transaction_date', dateFrom)
        .lte('transaction_date', dateTo)
        .order('transaction_date', { ascending: false }) // 主排序
        .order('id',               { ascending: true  }) // 次排序 tie-breaker
        .range(from, from + step - 1)

      if (error) { console.error('fetchMonth error', error); return }

      if (data && data.length > 0) {
        allData = [...allData, ...data]
        from += step
      }

      if (!data || data.length < step) break
    }

    setMonthTransactions(allData)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { fetchMonth(selectedMonth) }, [fetchMonth, selectedMonth])

  const refresh = useCallback(() => {
    fetchAll()
    fetchMonth(selectedMonth)
  }, [fetchAll, fetchMonth, selectedMonth])

  // ── derived: accounts ────────────────────────────────────────────────────
  const accounts = useMemo(() =>
    [...new Set(allTransactions.map(t => t.account))].filter(Boolean),
    [allTransactions]
  )

  // ── derived: per-account balances ────────────────────────────────────────
  const accountBalances = useMemo(() =>
    accounts.reduce((acc, acct) => {
      acc[acct] = calcBalance(allTransactions.filter(t => t.account === acct))
      return acc
    }, {}),
    [accounts, allTransactions]
  )

  const totalBalance = useMemo(() =>
    Object.values(accountBalances).reduce((s, v) => s + v, 0),
    [accountBalances]
  )

  // ── derived: month KPI ───────────────────────────────────────────────────
  const filteredMonth = useMemo(() =>
    monthTransactions.filter(t =>
      selectedAccount === 'All' ? true : t.account === selectedAccount
    ),
    [monthTransactions, selectedAccount]
  )

  const monthIncome  = useMemo(() => filteredMonth.filter(t => t.type === 'Income').reduce((s, t) => s + Number(t.amount), 0), [filteredMonth])
  const monthExpense = useMemo(() => filteredMonth.filter(t => t.type === 'Expense').reduce((s, t) => s + Number(t.amount), 0), [filteredMonth])
  const monthNet     = monthIncome - monthExpense

  // ── derived: category breakdown ──────────────────────────────────────────
  const categoryBreakdown = useMemo(() =>
    filteredMonth
      .filter(t => t.type === 'Expense')
      .reduce((acc, t) => {
        const cat = t.category || '其他'
        acc[cat] = (acc[cat] || 0) + Number(t.amount)
        return acc
      }, {}),
    [filteredMonth]
  )

  // ── derived: dynamic category map from DB ─────────────────────────────────
  // { category: [subcategory, ...] }  — built from real transaction history
  const dbCategoryMap = useMemo(() => {
    const map = {}
    allTransactions.forEach(t => {
      if (!t.category) return
      if (!map[t.category]) map[t.category] = new Set()
      if (t.subcategory) map[t.category].add(t.subcategory)
    })
    // convert Sets → sorted arrays
    return Object.fromEntries(
      Object.entries(map).map(([cat, set]) => [cat, [...set].sort()])
    )
  }, [allTransactions])

  // categories keyed by transaction type (derived from DB)
  const dbTypeCategoryMap = useMemo(() => {
    const map = { Expense: new Set(), Income: new Set(), 'Transfer In': new Set(), 'Transfer Out': new Set() }
    allTransactions.forEach(t => {
      if (t.type && t.category && map[t.type]) map[t.type].add(t.category)
    })
    return Object.fromEntries(Object.entries(map).map(([k, s]) => [k, [...s].sort()]))
  }, [allTransactions])

  // unique card names from DB (for combobox)
  const dbCardNames = useMemo(() =>
    [...new Set(allTransactions.map(t => t.card_name).filter(Boolean))].sort(),
    [allTransactions]
  )

  // unique item names from DB (for autocomplete)
  const dbItemNames = useMemo(() =>
    [...new Set(allTransactions.map(t => t.item_name).filter(Boolean))].sort(),
    [allTransactions]
  )

  // ── local state updater helpers ───────────────────────────────────────────
  const _patchAll  = (fn) => { setAllTransactions(fn); setMonthTransactions(fn) }
  const _inMonth   = (date) => date?.startsWith(selectedMonth)

  // ── insert transaction (with user_id) — optimistic ────────────────────────
  const addTransaction = useCallback(async (payload) => {
    const { data, error } = await supabase
      .from('transactions')
      .insert([{ ...payload, user_id: user?.id }])
      .select()
      .single()
    if (error) throw error
    // Prepend to allTransactions; prepend to monthTransactions only if in current month
    setAllTransactions(prev => [data, ...prev])
    if (_inMonth(data.transaction_date)) setMonthTransactions(prev => [data, ...prev])
    showToast('記帳成功 🎉', 'success')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedMonth])

  // ── update transaction — optimistic ──────────────────────────────────────
  const updateTransaction = useCallback(async (id, payload) => {
    const { data, error } = await supabase
      .from('transactions')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    const updater = prev => prev.map(t => t.id === id ? { ...t, ...data } : t)
    setAllTransactions(updater)
    setMonthTransactions(updater)
  }, [])

  // ── delete transaction — optimistic (remove first, rollback on error) ─────
  const deleteTransaction = useCallback(async (id) => {
    setAllTransactions(prev => prev.filter(t => t.id !== id))
    setMonthTransactions(prev => prev.filter(t => t.id !== id))
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) {
      refresh()   // rollback via re-fetch
      throw error
    }
    showToast('已刪除', 'success')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh])

  // ── toggle is_settled — optimistic with rollback ──────────────────────────
  const toggleSettled = useCallback(async (id, current) => {
    const newVal = !current
    const apply    = prev => prev.map(t => t.id === id ? { ...t, is_settled: newVal }  : t)
    const rollback = prev => prev.map(t => t.id === id ? { ...t, is_settled: current } : t)
    setAllTransactions(apply);  setMonthTransactions(apply)
    const { error } = await supabase.from('transactions').update({ is_settled: newVal }).eq('id', id)
    if (error) { setAllTransactions(rollback); setMonthTransactions(rollback); throw error }
  }, [])

  // ── bulk set is_settled — optimistic with rollback ────────────────────────
  const bulkSetSettled = useCallback(async (ids, value) => {
    if (!ids.length) return
    const idSet    = new Set(ids)
    const apply    = prev => prev.map(t => idSet.has(t.id) ? { ...t, is_settled: value }  : t)
    const rollback = prev => prev.map(t => idSet.has(t.id) ? { ...t, is_settled: !value } : t)
    setAllTransactions(apply);  setMonthTransactions(apply)
    const { error } = await supabase.from('transactions').update({ is_settled: value }).in('id', ids)
    if (error) { setAllTransactions(rollback); setMonthTransactions(rollback); refresh(); throw error }
    showToast(`已批次${value ? '標為計算' : '標為不計算'} (${ids.length} 筆)`, 'success')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh])

  // ── toast helpers ─────────────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }
  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  // ── sign out ──────────────────────────────────────────────────────────────
  const signOut = async () => { await supabase.auth.signOut(); setUser(null) }

  return (
    <TransactionContext.Provider value={{
      user, loading,
      allTransactions, monthTransactions, filteredMonth,
      selectedAccount, setSelectedAccount,
      selectedMonth, setSelectedMonth,
      accounts, accountBalances, totalBalance,
      monthIncome, monthExpense, monthNet,
      categoryBreakdown,
      // dynamic DB-derived data
      dbCategoryMap, dbTypeCategoryMap, dbCardNames, dbItemNames,
      // actions
      addTransaction, updateTransaction, toggleSettled, bulkSetSettled, deleteTransaction, refresh,
      // ui
      toasts, showToast, dismissToast,
      signOut,
    }}>
      {children}
    </TransactionContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(TransactionContext)
  if (!ctx) throw new Error('useApp must be used within TransactionProvider')
  return ctx
}
