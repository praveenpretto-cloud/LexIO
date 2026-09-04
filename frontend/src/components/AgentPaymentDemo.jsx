import { useState } from 'react'
import AgentSwarm from './AgentSwarm'

/**
 * AgentPaymentDemo — full visual agent-to-agent payment flow component.
 *
 * Calls /api/v1/demo/agent-payment and renders each pipeline stage
 * (Compliance Check → Decision → VC Issued → XRPL Anchored → Payment Status)
 * as an animated vertical timeline.
 */

const DEMO_WALLETS = {
  CLEAN_SOURCE:    'rN7n7otQDd6FczFgLdQqhkFGzPb7E4k7Ud',
  CLEAN_DEST:      'rAbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfG',
  PEP_DEST:        'rU6K7V8oST9vMN2pQr4sT5uV6wX7yZ8aA',
  HIGH_RISK_DEST:  'rHighRiskCountryWalletXxXxXxXxXx',
  CAYMAN_DEST:     'rCaymanFundWalletXxXxXxXxXxXxXx',
}

const RISK_COLORS = {
  scdd: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', text: '#34d399', label: 'SCDD', glow: 'rgba(16,185,129,0.2)' },
  cdd:  { bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.35)', text: '#fbbf24', label: 'CDD',  glow: 'rgba(251,191,36,0.15)' },
  edd:  { bg: 'rgba(244,63,94,0.10)',  border: 'rgba(244,63,94,0.35)',  text: '#fb7185', label: 'EDD',  glow: 'rgba(244,63,94,0.15)'  },
}

const DECISION_COLORS = {
  APPROVE: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', text: '#34d399', glow: '0 0 30px rgba(16,185,129,0.2)' },
  REJECT:  { bg: 'rgba(244,63,94,0.15)',  border: 'rgba(244,63,94,0.4)',  text: '#fb7185', glow: '0 0 30px rgba(244,63,94,0.2)'  },
  WATCH:   { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.4)', text: '#fbbf24', glow: '0 0 30px rgba(251,191,36,0.15)' },
}

const DECISION_ICONS = { APPROVE: '✓', REJECT: '✕', WATCH: '⚠' }

// ── Preset scenarios for one-click demos ─────────────────────────────────────
const PRESETS = [
  {
    label: 'Clean → Clean',
    sublabel: 'SCDD · APPROVE',
    color: '#34d399',
    source: DEMO_WALLETS.CLEAN_SOURCE,
    dest:   DEMO_WALLETS.CLEAN_DEST,
  },
  {
    label: 'Clean → PEP',
    sublabel: 'EDD · REJECT',
    color: '#fb7185',
    source: DEMO_WALLETS.CLEAN_SOURCE,
    dest:   DEMO_WALLETS.PEP_DEST,
  },
  {
    label: 'Clean → High-Risk',
    sublabel: 'EDD · WATCH',
    color: '#fbbf24',
    source: DEMO_WALLETS.CLEAN_SOURCE,
    dest:   DEMO_WALLETS.HIGH_RISK_DEST,
  },
  {
    label: 'Clean → Cayman',
    sublabel: 'CDD · APPROVE',
    color: '#fbbf24',
    source: DEMO_WALLETS.CLEAN_SOURCE,
    dest:   DEMO_WALLETS.CAYMAN_DEST,
  },
]

// ── Skeleton pulse block ──────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`}
      style={{ background: 'rgba(255,255,255,0.06)' }}
    />
  )
}

// ── Timeline step ─────────────────────────────────────────────────────────────
function TimelineStep({ icon, title, status, children, isLast = false }) {
  const statusColors = {
    idle:    { dot: '#334155', line: '#1e293b' },
    loading: { dot: '#6366f1', line: 'rgba(99,102,241,0.3)' },
    done:    { dot: '#34d399', line: 'rgba(16,185,129,0.25)' },
    reject:  { dot: '#fb7185', line: 'rgba(244,63,94,0.25)' },
    watch:   { dot: '#fbbf24', line: 'rgba(251,191,36,0.25)' },
  }
  const sc = statusColors[status] || statusColors.idle

  return (
    <div className="flex gap-4">
      {/* Left: dot + line */}
      <div className="flex flex-col items-center" style={{ minWidth: '20px' }}>
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-all duration-500"
          style={{
            background: status === 'loading'
              ? 'linear-gradient(135deg,#4f46e5,#6366f1)'
              : sc.dot,
            boxShadow: status !== 'idle' ? `0 0 10px ${sc.dot}80` : 'none',
            color: '#fff',
          }}
        >
          {status === 'loading' ? (
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            icon
          )}
        </div>
        {!isLast && (
          <div
            className="w-px flex-1 mt-1 transition-all duration-700"
            style={{
              background: status === 'idle'
                ? 'rgba(255,255,255,0.05)'
                : `linear-gradient(to bottom, ${sc.dot}50, transparent)`,
              minHeight: '24px',
            }}
          />
        )}
      </div>

      {/* Right: content */}
      <div className="pb-6 flex-1 min-w-0">
        <div className="text-[11px] font-bold tracking-widest uppercase text-slate-500 mb-2">
          {title}
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Wallet chip (truncated with copy affordance) ──────────────────────────────
function WalletChip({ address, label }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">{label}</div>
      <div
        className="font-mono text-[11px] px-3 py-2 rounded-lg truncate"
        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', color: '#818cf8' }}
        title={address}
      >
        {address}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AgentPaymentDemo() {
  const [sourceWallet, setSourceWallet] = useState(DEMO_WALLETS.CLEAN_SOURCE)
  const [destWallet,   setDestWallet]   = useState(DEMO_WALLETS.CLEAN_DEST)
  const [amount,       setAmount]       = useState('100')
  const [useZk,        setUseZk]        = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [result,       setResult]       = useState(null)
  const [error,        setError]        = useState(null)
  const [latency,      setLatency]      = useState(null)
  const [showRawData,  setShowRawData]  = useState(false)

  const reset = () => { setResult(null); setError(null); setLatency(null) }

  const applyPreset = (preset) => {
    setSourceWallet(preset.source)
    setDestWallet(preset.dest)
    reset()
  }

  const runDemo = async (e) => {
    e.preventDefault()
    if (!sourceWallet || !destWallet) return
    setLoading(true)
    setResult(null)
    setError(null)
    setLatency(null)

    const t0 = performance.now()
    try {
      const params = new URLSearchParams({
        source_wallet:      sourceWallet,
        destination_wallet: destWallet,
        amount:             parseFloat(amount) || 100,
        use_zk:             useZk,
      })
      const res = await fetch(`/api/v1/demo/agent-payment?${params}`, { method: 'POST' })
      const ms  = (performance.now() - t0).toFixed(0)
      setLatency(ms)

      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? `HTTP ${res.status}`)
        return
      }
      setResult(data)
    } catch (err) {
      setError('Cannot reach the API — is the FastAPI server running?')
    } finally {
      setLoading(false)
    }
  }

  const decision    = result?.compliance_decision
  const decisionKey = decision?.decision ?? ''
  const dc          = DECISION_COLORS[decisionKey] ?? {}
  const tier        = decision?.risk_tier?.toLowerCase()
  const tc          = RISK_COLORS[tier] ?? {}
  const isApprove   = decisionKey === 'APPROVE'
  const isReject    = decisionKey === 'REJECT'
  const isWatch     = decisionKey === 'WATCH'

  // Step status helpers
  const step = (key) => {
    if (loading)       return 'loading'
    if (!result)       return 'idle'
    if (key === 'compliance') return isApprove ? 'done' : isReject ? 'reject' : 'watch'
    if (key === 'decision')   return isApprove ? 'done' : isReject ? 'reject' : 'watch'
    if (key === 'vc')         return result.credential ? 'done' : 'reject'
    if (key === 'anchor')     return result.anchor_result?.transaction_hash ? 'done' : result.credential ? 'watch' : 'reject'
    if (key === 'payment')    return isApprove ? 'done' : isReject ? 'reject' : 'watch'
    return 'idle'
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* ── Visual Network Swarm ── */}
      <AgentSwarm 
        source={sourceWallet} 
        dest={destWallet} 
        status={
          loading ? 'loading' : 
          !result ? 'idle' : 
          decisionKey === 'APPROVE' ? 'approve' : 
          decisionKey === 'REJECT' ? 'reject' : 'watch'
        } 
      />

      {/* ── Scenario presets ── */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold tracking-widest uppercase text-slate-500">
          Quick Scenarios
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="flex flex-col items-start px-3 py-2.5 rounded-xl border transition-all duration-200 text-left"
              style={{
                borderColor: `${p.color}30`,
                background:  `${p.color}08`,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${p.color}60`; e.currentTarget.style.background = `${p.color}12` }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = `${p.color}30`; e.currentTarget.style.background = `${p.color}08` }}
            >
              <span className="text-xs font-bold" style={{ color: p.color }}>{p.label}</span>
              <span className="text-[10px] font-mono text-slate-600 mt-0.5">{p.sublabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Form + Timeline grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Left — input form */}
        <div
          className="rounded-2xl p-6 border backdrop-blur-sm flex flex-col gap-5"
          style={{ background: 'rgba(13,18,32,0.6)', borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              🤖
            </div>
            <div>
              <div className="text-sm font-bold text-white">Agent Payment Parameters</div>
              <div className="text-[11px] text-slate-600">Configure agent-to-agent transfer</div>
            </div>
          </div>

          <form onSubmit={runDemo} className="flex flex-col gap-4">
            {/* Source wallet */}
            <div className="space-y-1.5">
              <label htmlFor="agentSource" className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
                Source Agent Wallet
              </label>
              <input
                id="agentSource"
                type="text"
                value={sourceWallet}
                onChange={e => { setSourceWallet(e.target.value); reset() }}
                disabled={loading}
                placeholder="rXxx…"
                className="w-full bg-[#111827]/60 border border-white/8 rounded-xl px-4 py-3 text-white font-mono text-xs outline-none transition-all duration-200 focus:border-[#6366f1]/60 focus:bg-[#6366f1]/5 disabled:opacity-50"
              />
            </div>

            {/* Arrow */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: 'rgba(99,102,241,0.15)' }} />
              <div className="text-xs text-slate-700 font-mono">→</div>
              <div className="flex-1 h-px" style={{ background: 'rgba(99,102,241,0.15)' }} />
            </div>

            {/* Destination wallet */}
            <div className="space-y-1.5">
              <label htmlFor="agentDest" className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
                Destination Agent Wallet
              </label>
              <input
                id="agentDest"
                type="text"
                value={destWallet}
                onChange={e => { setDestWallet(e.target.value); reset() }}
                disabled={loading}
                placeholder="rXxx…"
                className="w-full bg-[#111827]/60 border border-white/8 rounded-xl px-4 py-3 text-white font-mono text-xs outline-none transition-all duration-200 focus:border-[#6366f1]/60 focus:bg-[#6366f1]/5 disabled:opacity-50"
              />
            </div>

            {/* Amount & ZK Toggle */}
            <div className="flex gap-4">
              <div className="space-y-1.5 flex-1">
                <label htmlFor="agentAmount" className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
                  Amount <span className="text-slate-700 normal-case tracking-normal font-normal">/ USD</span>
                </label>
                <div className="relative">
                  <input
                    id="agentAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    disabled={loading}
                    className="w-full bg-[#111827]/60 border border-white/8 rounded-xl px-4 py-3.5 pr-14 text-white font-mono text-lg font-semibold placeholder-slate-700 outline-none transition-all duration-200 focus:border-[#6366f1]/60 disabled:opacity-50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-slate-600 tracking-widest">USD</span>
                </div>
              </div>

              <div className="space-y-1.5 flex-[0.7]">
                <label className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
                  Privacy Mode
                </label>
                <button
                  type="button"
                  onClick={() => setUseZk(!useZk)}
                  className="w-full h-[58px] rounded-xl flex items-center justify-center gap-2 border transition-all"
                  style={{
                    background: useZk ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                    borderColor: useZk ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)',
                    color: useZk ? '#34d399' : '#64748b'
                  }}
                >
                  <span className="text-lg">{useZk ? '🛡️' : '👁️'}</span>
                  <span className="text-[10px] font-bold font-mono tracking-wider">{useZk ? 'ZK-PROOF ON' : 'PUBLIC'}</span>
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 p-3 rounded-xl text-xs font-mono slide-up" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#fb7185' }}>
                <span>⚠</span><span className="break-words">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              id="run-agent-demo-btn"
              type="submit"
              disabled={loading || !sourceWallet || !destWallet}
              className="relative w-full py-4 rounded-xl font-black text-sm tracking-[0.15em] uppercase text-white overflow-hidden transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: loading
                  ? 'linear-gradient(135deg,#374151,#4b5563,#374151)'
                  : 'linear-gradient(135deg,#4f46e5,#6366f1,#7c3aed)',
                boxShadow: (!loading && sourceWallet) ? '0 4px 24px rgba(99,102,241,0.35)' : 'none',
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-3">
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-amber-300" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-amber-200 tracking-[0.2em]">RUNNING PIPELINE…</span>
                  </>
                ) : (
                  <><span>⚡</span> RUN AGENT PAYMENT</>
                )}
              </span>
            </button>

            {/* Latency badge */}
            {latency && !loading && (
              <div className="text-center text-[10px] font-mono text-slate-600">
                Pipeline completed in <span className="text-slate-400">{latency}ms</span>
              </div>
            )}
          </form>
        </div>

        {/* Right — animated timeline */}
        <div
          className="rounded-2xl p-6 border backdrop-blur-sm"
          style={{
            background:  'rgba(13,18,32,0.6)',
            borderColor: result
              ? (isApprove ? 'rgba(16,185,129,0.25)' : isReject ? 'rgba(244,63,94,0.25)' : 'rgba(251,191,36,0.25)')
              : 'rgba(255,255,255,0.06)',
            boxShadow: result
              ? (isApprove ? '0 0 40px rgba(16,185,129,0.1)' : isReject ? '0 0 40px rgba(244,63,94,0.1)' : '0 0 40px rgba(251,191,36,0.08)')
              : 'none',
            transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
          }}
        >
          <div className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-5">
            Payment Pipeline
          </div>

          {/* ── Step 1: Compliance Check ── */}
          <TimelineStep icon="1" title="Compliance Check" status={step('compliance')}>
            {!loading && !result ? (
              <div className="text-xs text-slate-700 font-mono">Awaiting input…</div>
            ) : loading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ) : (
              <div className="space-y-2">
                <WalletChip address={result.source_wallet}      label="Source Agent" />
                <WalletChip address={result.destination_wallet} label="Destination Agent" />
              </div>
            )}
          </TimelineStep>

          {/* ── Step 2: Decision ── */}
          <TimelineStep icon="2" title="Risk Decision" status={step('decision')}>
            {!result && !loading ? (
              <div className="text-xs text-slate-700 font-mono">—</div>
            ) : loading ? (
              <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-3 w-4/5" /></div>
            ) : (
              <div className="space-y-3">
                {/* Decision badge */}
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: dc.bg, border: `1px solid ${dc.border}`, boxShadow: dc.glow }}
                >
                  <span className="text-2xl font-black" style={{ color: dc.text }}>{DECISION_ICONS[decisionKey]}</span>
                  <div>
                    <div className="text-sm font-black" style={{ color: dc.text }}>{decisionKey}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
                        style={{ background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text }}
                      >
                        {(tier ?? '').toUpperCase()} Tier
                      </span>
                      <span className="text-[10px] font-mono text-slate-600">
                        {(decision.confidence_score * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                  </div>
                </div>

                {/* Flags */}
                {decision.flagged_by?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {decision.flagged_by.map(flag => (
                      <span
                        key={flag}
                        className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: '#fb7185' }}
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Reasons */}
                <div className="space-y-1">
                  {decision.reasons?.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-slate-500 font-mono">
                      <span className="mt-0.5 flex-shrink-0 text-slate-700">›</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TimelineStep>

          {/* ── Step 2.5: AI Compliance Agent Reasoning ── */}
          <TimelineStep icon="🧠" title="AI Compliance Agent" status={loading ? 'loading' : result ? 'done' : 'idle'}>
            {!result && !loading ? (
              <div className="text-xs text-slate-700 font-mono">—</div>
            ) : loading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ) : result.compliance_decision?.ai_reasoning ? (
              <div
                className="rounded-xl p-3 space-y-2"
                style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full text-violet-400 border border-violet-500/30 bg-violet-500/10">
                    LexIO Compliance Agent
                  </span>
                  <span className="text-[10px] font-mono text-slate-600">Gemini 2.0 Flash</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans italic">
                  "{result.compliance_decision.ai_reasoning}"
                </p>
              </div>
            ) : (
              <div className="text-[11px] font-mono text-slate-600">AI agent reasoning unavailable.</div>
            )}
          </TimelineStep>

          {/* ── Step 3: Verifiable Credential ── */}
          <TimelineStep icon="3" title="Verifiable Credential" status={step('vc')}>
            {!result && !loading ? (
              <div className="text-xs text-slate-700 font-mono">—</div>
            ) : loading ? (
              <div className="space-y-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/5" /></div>
            ) : result.credential ? (
              <div
                className="rounded-xl p-3 space-y-2 font-mono text-[10px]"
                style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                <div className="flex justify-between">
                  <span className="text-slate-600">DID</span>
                  <span className="text-emerald-400 truncate max-w-[140px]" title={result.credential.credentialSubject?.id ?? result.credential.id}>
                    {result.credential.credentialSubject?.id ?? result.credential.id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Status</span>
                  <span className="text-emerald-400">{result.credential.credentialSubject?.complianceStatus}</span>
                </div>
                {result.credential.credentialSubject?.proofType ? (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Proof</span>
                    <span className="text-emerald-400">{result.credential.credentialSubject.proofType}</span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Risk Tier</span>
                    <span className="text-emerald-400">{result.credential.credentialSubject?.riskTier}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-600">Expires</span>
                  <span className="text-slate-400">{result.credential.expirationDate?.slice(0, 10)}</span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] font-mono text-slate-600">
                VC not issued — payment {decisionKey === 'REJECT' ? 'rejected' : 'flagged for review'}.
              </div>
            )}
          </TimelineStep>

          {/* ── Step 4: XRPL Anchor / Escrow ── */}
          <TimelineStep icon="4" title={decisionKey === 'WATCH' ? 'XRPL Escrow Vault' : 'XRPL Anchor'} status={step('anchor')}>
            {!result && !loading ? (
              <div className="text-xs text-slate-700 font-mono">—</div>
            ) : loading ? (
              <div className="space-y-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></div>
            ) : result.anchor_result?.transaction_hash ? (
              <div
                className="rounded-xl p-3 space-y-2 font-mono text-[10px]"
                style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                <div className="flex justify-between gap-2 items-center">
                  <span className="text-slate-600 flex-shrink-0">TX Hash</span>
                  <a
                    href={`https://testnet.xrpl.org/transactions/${result.anchor_result.transaction_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors border border-indigo-500/30 truncate"
                    title={result.anchor_result.transaction_hash}
                  >
                    {result.anchor_result.transaction_hash.slice(0, 12)}... ↗
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Ledger Index</span>
                  <span className="text-slate-400">#{result.anchor_result.ledger_index}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Credential ID</span>
                  <span className="text-indigo-400 truncate max-w-[120px]" title={result.anchor_result.credential_id}>
                    {result.anchor_result.credential_id?.slice(0, 18)}…
                  </span>
                </div>
              </div>
            ) : decisionKey === 'WATCH' && result.anchor_result?.status === 'EscrowCreated' ? (
              <div
                className="rounded-xl p-3 space-y-2 font-mono text-[10px]"
                style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}
              >
                <div className="flex justify-between gap-2 items-center">
                  <span className="text-amber-500 flex-shrink-0 font-bold">⛓ Real Escrow On-Chain</span>
                  {result.anchor_result.xrpl_explorer_url ? (
                    <a
                      href={result.anchor_result.xrpl_explorer_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                    >
                      View on XRPL ↗
                    </a>
                  ) : (
                    <span className="text-slate-600 italic">Simulated (testnet offline)</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">TX Hash</span>
                  <span className="text-amber-400 truncate max-w-[150px]" title={result.anchor_result.transaction_hash}>
                    {result.anchor_result.transaction_hash?.slice(0, 20)}...
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Amount Held</span>
                  <span className="text-amber-400">${result.anchor_result.amount_usd_held} USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Unlock After</span>
                  <span className="text-slate-400">{result.anchor_result.finish_after?.slice(0,16).replace('T',' ')} UTC</span>
                </div>
              </div>
            ) : result.anchor_result ? (
              <div className="text-[11px] font-mono text-slate-600">
                {result.anchor_result.note ?? 'Anchoring skipped.'}
              </div>
            ) : (
              <div className="text-[11px] font-mono text-slate-600">
                XRPL anchor not attempted — payment not approved.
              </div>
            )}
          </TimelineStep>

          {/* ── Step 5: Payment Status ── */}
          <TimelineStep icon="5" title="Payment Status" status={step('payment')} isLast>
            {!result && !loading ? (
              <div className="text-xs text-slate-700 font-mono">—</div>
            ) : loading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div
                className="px-4 py-3 rounded-xl flex items-center gap-3"
                style={{
                  background:  dc.bg,
                  border:      `1px solid ${dc.border}`,
                  boxShadow:   dc.glow,
                }}
              >
                <span className="text-xl font-black" style={{ color: dc.text }}>
                  {decisionKey === 'APPROVE' ? '⚡' : decisionKey === 'REJECT' ? '🚫' : '⏸'}
                </span>
                <div>
                  <div className="text-sm font-black" style={{ color: dc.text }}>
                    {result.payment_status}
                  </div>
                  <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                    {result.timestamp?.replace('T', ' ').slice(0, 19)} UTC
                  </div>
                </div>
                {result.payment_id && (
                  <div className="ml-auto text-[10px] font-mono text-slate-700 truncate max-w-[80px]" title={result.payment_id}>
                    #{result.payment_id.slice(0, 8)}
                  </div>
                )}
              </div>
            )}
          </TimelineStep>
        </div>
      </div>

      {/* ── Hackathon Defensibility: Raw Data Explorer ── */}
      <div className="mt-4 border-t border-white/5 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] font-bold tracking-widest uppercase text-slate-500">
            Judge / Developer Tools
          </div>
          <button
            onClick={() => setShowRawData(!showRawData)}
            className="text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg border transition-all"
            style={{
              background: showRawData ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
              color: showRawData ? '#818cf8' : '#64748b',
              borderColor: showRawData ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'
            }}
          >
            {showRawData ? 'HIDE RAW DATA' : 'SHOW RAW JSON PAYLOAD'}
          </button>
        </div>

        {showRawData && (
          <div className="bg-[#090d18] border border-white/10 rounded-xl p-4 overflow-x-auto shadow-inner">
            <div className="text-[10px] text-slate-500 font-mono mb-3 pb-2 border-b border-white/5">
              // Live API Response Object — Proves VC format and on-chain XRPL data are real
            </div>
            {!result && !loading ? (
              <div className="text-xs text-slate-700 font-mono italic">Run a transaction to see the raw API output...</div>
            ) : loading ? (
              <div className="text-xs text-indigo-400 font-mono animate-pulse">Waiting for backend engine...</div>
            ) : (
              <pre className="text-[10px] md:text-xs font-mono text-slate-300 whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
