import { useEffect, useState } from 'react'

export default function Header({ checkCount }) {
  const [tick, setTick] = useState(new Date().toISOString())

  useEffect(() => {
    const t = setInterval(() => setTick(new Date().toISOString()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="relative z-10 border-b border-[#222] bg-[#000000] backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg border border-[#333]"
            style={{ background: '#111', boxShadow: 'none' }}
          >
            ⚖
          </div>
          <div>
            <div className="font-black text-xl tracking-tight text-white">
              Lex<span className="text-[#888]">IO</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
              Agentic Compliance Engine v2.0
            </div>
          </div>
        </div>

        {/* Center pack version tags */}
        <div className="hidden md:flex items-center gap-3">
          <div className="h-px w-8 bg-[#333]" />
          {['FATF Risk Pack v1.0', 'Omni-Chain Pack v2.0', 'W3C Cred Pack v1.1'].map((tag, i) => (
            <span
              key={tag}
              className="text-[10px] font-mono px-2.5 py-1 rounded-full border text-[#888] tracking-wider bg-[#111] border-[#333]"
            >
              {tag}
            </span>
          ))}
          <div className="h-px w-8 bg-[#333]" />
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
          <div className="px-2.5 py-1 rounded-lg bg-[#111] border border-[#333] text-white font-semibold">
            {checkCount} checks
          </div>
        </div>
      </div>
    </header>
  )
}
