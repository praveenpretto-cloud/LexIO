import { useEffect, useState } from 'react'

export default function AgentSwarm({ source, dest, status }) {
  // status: 'idle', 'loading', 'approve', 'reject', 'watch'
  const [pulsePos, setPulsePos] = useState(0)

  useEffect(() => {
    if (status === 'loading') {
      const interval = setInterval(() => {
        setPulsePos(p => (p + 2) % 100)
      }, 20)
      return () => clearInterval(interval)
    } else {
      setPulsePos(100)
    }
  }, [status])

  const getPulseColor = () => {
    if (status === 'approve') return '#34d399' // Emerald
    if (status === 'reject') return '#fb7185' // Rose
    if (status === 'watch') return '#fbbf24' // Amber
    return '#6366f1' // Indigo for loading
  }

  const isComplete = ['approve', 'reject', 'watch'].includes(status)

  return (
    <div className="relative w-full h-40 bg-[#0d1220]/60 rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center mb-6">
      <div className="absolute inset-0 bg-scanlines opacity-50 pointer-events-none" />
      
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        {/* Background Network Lines */}
        <line x1="10%" y1="20%" x2="90%" y2="80%" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
        <line x1="90%" y1="20%" x2="10%" y2="80%" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
        <line x1="50%" y1="10%" x2="50%" y2="90%" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
        
        {/* Main Connection Line */}
        <line x1="25%" y1="50%" x2="75%" y2="50%" stroke="rgba(99,102,241,0.2)" strokeWidth="2" strokeDasharray="4 4" />
        
        {/* Animated Pulse */}
        {(status === 'loading' || (status === 'watch' && pulsePos < 50)) && (
          <circle 
            cx={`${25 + (pulsePos / 100) * 50}%`} 
            cy="50%" 
            r="4" 
            fill={getPulseColor()} 
            style={{ filter: `drop-shadow(0 0 8px ${getPulseColor()})` }} 
          />
        )}
      </svg>

      {/* Nodes */}
      <div className="absolute left-[25%] -translate-x-1/2 flex flex-col items-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-indigo-500/10 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
          🤖
        </div>
        <span className="text-[10px] font-mono text-slate-500 mt-2 tracking-widest uppercase">Source Agent</span>
      </div>

      {status === 'watch' && (
        <div className="absolute top-[20%] left-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center animate-bounce">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-500/10 border border-amber-500/30 shadow-[0_0_15px_rgba(251,191,36,0.3)]">
            🕵️
          </div>
          <span className="text-[10px] font-mono text-amber-500 mt-1 tracking-widest uppercase">Compliance Agent</span>
        </div>
      )}

      {isComplete && (
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-[0_0_15px_currentColor]" style={{ color: getPulseColor(), background: `${getPulseColor()}33`, border: `1px solid ${getPulseColor()}` }}>
            {status === 'approve' ? '✓' : status === 'reject' ? '✕' : '⚠'}
          </div>
        </div>
      )}

      <div className="absolute left-[75%] -translate-x-1/2 flex flex-col items-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-indigo-500/10 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
          🤖
        </div>
        <span className="text-[10px] font-mono text-slate-500 mt-2 tracking-widest uppercase">Dest Agent</span>
      </div>
    </div>
  )
}
