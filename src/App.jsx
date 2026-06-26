import { TransactionProvider, useApp } from './context/TransactionContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import AddNew from './pages/AddNew'
import Settings from './pages/Settings'
import Login from './pages/Login'

function AppInner() {
  const { user, loading, currentPage, navigate } = useApp()

  if (loading) {
    return (
      <div className="min-h-screen bg-earth-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-earth-800 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-earth-600">載入中…</p>
        </div>
      </div>
    )
  }

  if (!user) return <Login />

  const pages = {
    dashboard: <Dashboard />,
    history:   <History />,
    add:       <AddNew />,
    settings:  <Settings />,
  }

  return (
    <Layout current={currentPage} onChange={navigate}>
      {pages[currentPage] ?? <Dashboard />}
    </Layout>
  )
}

export default function App() {
  return (
    <TransactionProvider>
      <AppInner />
    </TransactionProvider>
  )
}
