import { LayoutDashboard, List, PlusCircle, Settings } from 'lucide-react'

const tabs = [
  { key: 'dashboard', label: '總覽', Icon: LayoutDashboard },
  { key: 'history',   label: '明細', Icon: List },
  { key: 'add',       label: '記帳', Icon: PlusCircle },
  { key: 'settings',  label: '設定', Icon: Settings },
]

export default function BottomNav({ current, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-earth-100 border-t border-earth-200 safe-bottom md:hidden">
      <div className="flex">
        {tabs.map(({ key, label, Icon }) => {
          const active = current === key
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px]
                transition-colors duration-150
                ${active ? 'text-earth-800' : 'text-earth-600'}`}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.2 : 1.6}
                className={active ? 'text-earth-800' : 'text-earth-600'}
              />
              <span className={`text-[10px] font-medium ${active ? 'text-earth-800' : 'text-earth-600'}`}>
                {label}
              </span>
              {active && (
                <span className="absolute bottom-0 w-8 h-0.5 rounded-full bg-earth-800" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
