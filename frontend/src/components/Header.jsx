import { useEffect, useState } from 'react'

export default function Header({ checkCount }) {
  const [tick, setTick] = useState(new Date().toISOString())

  useEffect(() => {
    const t = setInterval(() => setTick(new Date().toISOString()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="relative z-10 border-b border-white/5 bg-[#090d18]/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)', boxShadow: '0 0 24px rgba(99,102,241,0.35)' }}
          >
            ⚖
          </div>
          <div>
            <div className="font-black text-xl tracking-tight text-white">
              Lex<span className="text-[#818cf8]">IO</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
              Agentic Compliance Engine v2.0
            </div>
          </div>
        </div>

        {/* Center pack version tags */}
        <div className="hidden md:flex items-center gap-3">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-[#6366f1]/40" />
          {['FATF Risk Pack v1.0', 'XRPL-VC Pack v1.0', 'W3C Cred Pack v1.1'].map((tag, i) => (
            <span
              key={tag}
              className="text-[10px] font-mono px-2.5 py-1 rounded-full border text-slate-400 tracking-wider"
              style={{
                borderColor: 'rgba(99,102,241,0.25)',
                background: 'rgba(99,102,241,0.07)',
              }}
            >
              {tag}
            </span>
          ))}
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-[#6366f1]/40" />
        </div>

        {/* Right meta */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-semibold">LIVE</span>
          </div>
          <div className="hidden sm:block text-slate-600">
            {tick.replace('T', ' ').slice(0, 19)} UTC
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-[#6366f1]/10 border border-[#6366f1]/20 text-[#818cf8] font-semibold">
            {checkCount} checks
          </div>
        </div>
      </div>
    </header>
  )
}
