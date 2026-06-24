import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Fish, Mail, Lock, LogIn } from 'lucide-react'

const inputCls = `w-full bg-earth-100 border border-earth-200 rounded-xl px-4 py-3
  text-earth-800 text-base placeholder-earth-400 focus:outline-none focus:border-earth-400
  focus:ring-1 focus:ring-earth-300 transition min-h-[44px]`

export default function Login() {
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode]       = useState('login') // 'login' | 'register'
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('註冊成功！請確認你的 Email 後登入。')
      }
    } catch (err) {
      setMsg('錯誤：' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-earth-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* logo */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-14 h-14 bg-earth-100 border border-earth-200 rounded-2xl flex items-center justify-center">
              <Fish size={28} className="text-sage-DEFAULT" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-earth-800">魚の記帳</h1>
          <p className="text-sm text-earth-600">質感帳務管理，專屬你的財務花園</p>
        </div>

        {/* form */}
        <form onSubmit={handleSubmit} className="bg-earth-100 border border-earth-200 rounded-2xl p-6 space-y-4">
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-earth-600 pointer-events-none" />
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="電子郵件" required
              className={inputCls + ' pl-10'}
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-earth-600 pointer-events-none" />
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="密碼" required
              className={inputCls + ' pl-10'}
            />
          </div>

          {msg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${msg.startsWith('錯誤') ? 'bg-terracotta-DEFAULT/10 text-terracotta-dark' : 'bg-sage-DEFAULT/10 text-sage-dark'}`}>
              {msg}
            </p>
          )}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-earth-800 text-earth-50
              rounded-xl py-3.5 font-semibold text-base hover:bg-earth-700 active:scale-[0.98]
              transition disabled:opacity-60 min-h-[44px]">
            <LogIn size={18} />
            {loading ? '處理中…' : mode === 'login' ? '登入' : '註冊帳號'}
          </button>
        </form>

        <p className="text-center text-sm text-earth-600">
          {mode === 'login' ? '還沒有帳號？' : '已有帳號？'}
          <button onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}
            className="ml-1 font-semibold text-earth-800 hover:underline">
            {mode === 'login' ? '立即註冊' : '前往登入'}
          </button>
        </p>
      </div>
    </div>
  )
}
