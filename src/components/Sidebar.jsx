import { LayoutDashboard, List, PlusCircle, Settings, Fish } from 'lucide-react'

const tabs = [
  { key: 'dashboard', label: '主頁總覽',   Icon: LayoutDashboard },
  { key: 'history',   label: '明細流水帳', Icon: List },
  { key: 'add',       label: '快速記帳',   Icon: PlusCircle },
  { key: 'settings',  label: '系統設定',   Icon: Settings },
]

export default function Sidebar({ current, onChange }) {
  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-earth-100 border-r border-earth-200 fixed left-0 top-0 z-30">
      {/* logo */}
      <div className="flex items-center gap-2 px-5 py-6 border-b border-earth-200">
        <Fish size={22} className="text-sage-DEFAULT" />
        <span className="text-lg font-bold text-earth-800 tracking-tight">魚の記帳</span>
      </div>

      {/* nav items */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {tabs.map(({ key, label, Icon }) => {
          const active = current === key
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                transition-all duration-150 text-left w-full
                ${active
                  ? 'bg-earth-200 text-earth-800'
                  : 'text-earth-600 hover:bg-earth-50 hover:text-earth-800'}`}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </button>
          )
        })}
      </nav>

      {/* footer */}
      <div className="px-5 py-4 border-t border-earth-200">
        <p className="text-[11px] text-earth-600 opacity-50 font-mono leading-relaxed">
          Copyright © 2026<br />by FoodieYu
        </p>
      </div>
    </aside>
  )
}
