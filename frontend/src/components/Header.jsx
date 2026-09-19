export default function Header({ checkCount, tabs, activeTab, onTabChange }) {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <div>
            <div className="text-sm font-semibold tracking-tight">LexIO</div>
            <div className="text-[11px] text-neutral-500">Policy engine 0.1.0</div>
          </div>
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  activeTab === tab.key
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="text-xs text-neutral-500 tabular-nums">{checkCount} checks</div>
      </div>
    </header>
  )
}
