import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import ToastContainer from './Toast'

export default function Layout({ current, onChange, children }) {
  return (
    <div className="min-h-screen bg-earth-50">
      <Sidebar current={current} onChange={onChange} />

      {/* main content – offset for sidebar on desktop */}
      <main className="md:ml-56 pb-20 md:pb-0 min-h-screen">
        {children}
      </main>

      <BottomNav current={current} onChange={onChange} />
      <ToastContainer />
    </div>
  )
}
