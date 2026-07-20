// ResultPanel.jsx — decision panel with Policy Decision Report template

import { useEffect, useRef, useState } from 'react'

function detectRule(reason) {
  if (!reason) return null
  if (reason.includes('MAS'))    return { label: 'MAS Pack v0.9.2',  color: 'text-cyan-400',   bg: 'bg-cyan-400/10 border-cyan-400/20' }
  if (reason.includes('EU TFR')) return { label: 'EU TFR Pack v0.8.4', color: 'text-violet-400', bg: 'bg-violet-400/10 border-violet-400/20' }
  if (reason.includes('MiCA'))   return { label: 'MiCA Pack v1.0.1', color: 'text-fuchsia-400', bg: 'bg-fuchsia-400/10 border-fuchsia-400/20' }
  return { label: 'ALL CLEAR', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' }
}

export default function ResultPanel({ result, flashKey, isLoading }) {
  const isApprove = result?.status === 'APPROVE'
  const rule      = result ? detectRule(result.reason) : null

  // Controls the CSS fade-in transition on each new result
  const [visible, setVisible] = useState(false)
  const prevKey = useRef(flashKey)

  useEffect(() => {
    if (flashKey !== prevKey.current) {
      prevKey.current = flashKey
      setVisible(false)
      const t = setTimeout(() => setVisible(true), 30)  // next frame
      return () => clearTimeout(t)
    }
  }, [flashKey])

  useEffect(() => {
    if (result) setVisible(true)
  }, [result])

  /* ── Loading state ── */
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 text-center p-10">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="animate-ping absolute h-full w-full rounded-full bg-[#6366f1] opacity-15" />
          <span className="animate-ping absolute h-12 w-12 rounded-full bg-[#818cf8] opacity-15" style={{ animationDelay: '0.2s' }} />
          <svg className="animate-spin h-10 w-10 text-[#818cf8]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"/>
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
        </div>
        <div>
          <div className="text-white font-bold text-sm tracking-wide">Evaluating Policy…</div>
          <div className="text-slate-600 text-xs mt-1 font-mono">Running MAS Pack · MiCA Pack · EU TFR rules</div>
        </div>
      </div>
    )
  }

  /* ── Empty state — replaced with Policy Decision Report template ── */
  if (!result) {
    return <PolicyDecisionTemplate />
  }

  /* ── Decision state with fade-in transition ── */
  return (
    <div
      key={flashKey}
      className={`h-full flex flex-col p-6 rounded-2xl ${isApprove ? 'flash-green' : 'flash-red'}`}
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.4s cubic-bezier(0.4,0,0.2,1), transform 0.4s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Status badge + rule */}
      <div className="flex items-start justify-between mb-6">
        <div
          className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border"
          style={{
            background:  isApprove ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)',
            borderColor: isApprove ? 'rgba(16,185,129,0.30)' : 'rgba(244,63,94,0.30)',
            animation:   isApprove ? 'glowGreen 2s ease-in-out infinite' : 'glowRed 2s ease-in-out infinite',
          }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: isApprove ? '#34d399' : '#fb7185' }}
          />
          <span className="font-black text-sm tracking-widest" style={{ color: isApprove ? '#34d399' : '#fb7185' }}>
            {result.status}
          </span>
        </div>

        {rule && (
          <span className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded-full border ${rule.bg} ${rule.color} uppercase tracking-wider`}>
            {rule.label}
          </span>
        )}
      </div>

      {/* Verdict */}
      <div className="mb-6">
        <div
          className="text-6xl font-black tracking-tighter leading-none mb-2"
          style={{
            color:      isApprove ? '#34d399' : '#fb7185',
            textShadow: isApprove
              ? '0 0 40px rgba(52,211,153,0.55)'
              : '0 0 40px rgba(251,113,133,0.55)',
          }}
        >
          {isApprove ? 'CLEARED' : 'BLOCKED'}
        </div>
        <div className="text-xs text-slate-500 font-mono uppercase tracking-widest">
          Compliance Decision
        </div>
      </div>

      {/* Regulatory basis */}
      <div
        className="rounded-xl border p-4 mb-5 flex-1"
        style={{
          background:  isApprove ? 'rgba(16,185,129,0.06)' : 'rgba(244,63,94,0.06)',
          borderColor: isApprove ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
        }}
      >
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">
          Regulatory Basis
        </div>
        <p className="text-sm leading-relaxed font-mono" style={{ color: isApprove ? '#6ee7b7' : '#fda4af' }}>
          {result.reason}
        </p>
      </div>

      {/* Meta strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Amount', value: result._amount ? Number(result._amount).toLocaleString() : '—' },
          { label: 'Asset',  value: result._asset ?? '—' },
          { label: 'Engine', value: 'v1.1' },
        ].map(m => (
          <div key={m.label} className="rounded-lg bg-white/3 border border-white/5 p-3 text-center">
            <div className="text-[9px] uppercase tracking-widest text-slate-600 font-bold mb-1">{m.label}</div>
            <div className="text-xs font-mono font-semibold text-slate-300">{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Policy Decision Report template (empty state replacement) ─────── */
function PolicyDecisionTemplate() {
  const traceRules = [
    { code: 'Rule 14.2', desc: 'Sender KYC',              status: 'PASS' },
    { code: 'Rule 18',   desc: 'Travel Rule',              status: 'PASS' },
    { code: 'Rule 27',   desc: 'Destination Jurisdiction', status: 'PASS' },
    { code: 'Rule 35',   desc: 'Sanctions Screening',      status: 'PASS' },
  ]

  return (
    <div className="h-full flex flex-col p-6 gap-5">

      {/* Header — status badge */}
      <div>
        <div className="text-[10px] font-bold tracking-widest uppercase text-slate-600 mb-3">
          Policy Decision Report
        </div>
        <div
          className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full border"
          style={{
            background:  'rgba(16,185,129,0.10)',
            borderColor: 'rgba(16,185,129,0.28)',
            animation:   'glowGreen 3s ease-in-out infinite',
          }}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-black text-sm tracking-wider text-emerald-300">
            🟢 APPROVED
          </span>
          <span className="text-[10px] font-mono text-slate-500 ml-1">
            Risk: LOW &nbsp;|&nbsp; Decision Confidence: HIGH
          </span>
        </div>
      </div>

      {/* Applicable Obligations */}
      <div
        className="rounded-xl border p-4"
        style={{
          background:  'rgba(16,185,129,0.05)',
          borderColor: 'rgba(16,185,129,0.18)',
        }}
      >
        <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-3">
          Applicable Obligations
        </div>
        <div className="space-y-2">
          {[
            { icon: '📋', text: 'Travel Rule Required', detail: 'Originator & beneficiary info must be transmitted' },
            { icon: '🗂️', text: 'Record Retention: 5 Years', detail: 'All transaction records to be retained per MAS PSN02' },
          ].map(ob => (
            <div
              key={ob.text}
              className="flex items-start gap-3 p-2.5 rounded-lg"
              style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.12)' }}
            >
              <span className="text-base mt-0.5">{ob.icon}</span>
              <div>
                <div className="text-xs font-bold text-emerald-300">{ob.text}</div>
                <div className="text-[10px] text-slate-600 mt-0.5 font-mono">{ob.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Decision Trace */}
      <div className="flex-1">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-3">
          Decision Trace
        </div>
        <div className="space-y-2">
          {traceRules.map((rule, i) => (
            <div
              key={rule.code}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200"
              style={{
                background:  'rgba(16,185,129,0.04)',
                borderColor: 'rgba(16,185,129,0.14)',
                animationDelay: `${i * 80}ms`,
              }}
            >
              <span className="text-emerald-400 font-bold text-sm flex-shrink-0">✓</span>
              <span className="text-[11px] font-mono font-bold text-[#818cf8] flex-shrink-0 min-w-[64px]">
                {rule.code}:
              </span>
              <span className="text-sm text-slate-300 flex-1">{rule.desc}</span>
              <span
                className="text-[10px] font-mono font-black tracking-widest px-2.5 py-0.5 rounded-full"
                style={{
                  color:      '#34d399',
                  background: 'rgba(52,211,153,0.12)',
                  border:     '1px solid rgba(52,211,153,0.25)',
                }}
              >
                {rule.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Subtle prompt */}
      <div className="text-center text-[10px] font-mono text-slate-700 pt-2 border-t border-white/4">
        Submit a transaction to generate a live policy evaluation
      </div>
    </div>
  )
}
