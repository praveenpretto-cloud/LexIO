import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AgentSwarm from './AgentSwarm'
import AgentTerminal from './AgentTerminal'

/**
 * AgentPaymentDemo — full visual agent-to-agent payment flow component.
 *
 * Calls /api/v1/demo/agent-payment and renders each pipeline stage
 * (Compliance Check → Decision → VC Issued → XRPL Anchored → Payment Status)
 * as an animated vertical timeline.
 */

const DEMO_WALLETS = {
  // XRPL wallets
  CLEAN_SOURCE:    'rN7n7otQDd6FczFgLdQqhkFGzPb7E4k7Ud',
  CLEAN_DEST:      'rAbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfG',
  PEP_DEST:        'rU6K7V8oST9vMN2pQr4sT5uV6wX7yZ8aA',
  HIGH_RISK_DEST:  'rHighRiskCountryWalletXxXxXxXxXx',
  CAYMAN_DEST:     'rCaymanFundWalletXxXxXxXxXxXxXx',
  // Solana wallets
  SOL_CLEAN_SRC:   '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  SOL_CLEAN_DST:   'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy',
  // EVM wallets (shared across Ethereum, Base, Polygon, Arbitrum)
  EVM_CLEAN_SRC:   '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
  EVM_CLEAN_DST:   '0x53d284357EC70cE289D6D64134DfAc8E511c8a3D',
  EVM_HIGH_RISK:   '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
  // Aptos wallets
  APT_CLEAN_SRC:   '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
  APT_CLEAN_DST:   '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
}

const CHAIN_OPTIONS = [
  { id: 'xrpl',     label: '◈ XRPL',     sublabel: 'Testnet · ~4s',  color: '#818cf8' },
  { id: 'stellar',  label: '✦ Stellar',  sublabel: 'Testnet · ~5s',  color: '#a5b4fc' },
  { id: 'ethereum', label: '⟠ Ethereum', sublabel: 'Sepolia · ~12s', color: '#627eea' },
  { id: 'solana',   label: '◎ Solana',   sublabel: 'Devnet · ~400ms', color: '#14f195' },
  { id: 'base',     label: '🔵 Base',     sublabel: 'Sepolia · ~2s',  color: '#0052ff' },
  { id: 'polygon',  label: '⬡ Polygon',  sublabel: 'Amoy · ~2s',     color: '#8247e5' },
  { id: 'arbitrum', label: '🔷 Arbitrum', sublabel: 'Sepolia · ~250ms', color: '#28a0f0' },
  { id: 'aptos',    label: '🅰 Aptos',    sublabel: 'Devnet · ~1s',   color: '#2dd8a7' },
]

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
  const [chain,        setChain]        = useState('xrpl')
  const [loading,      setLoading]      = useState(false)
  const [result,       setResult]       = useState(null)
  const [error,        setError]        = useState(null)
  const [latency,      setLatency]      = useState(null)
  const [showRawData,  setShowRawData]  = useState(false)
  const [terminalLogs, setTerminalLogs] = useState([])
  const [isTerminalThinking, setIsTerminalThinking] = useState(false)
  const [progressStep, setProgressStep] = useState(0)

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
    setTerminalLogs([])
    setIsTerminalThinking(true)
    setProgressStep(0)

    // Simulate streaming
    setTimeout(() => {
      setTerminalLogs(prev => [...prev, { timestamp: Date.now(), agent: 'Swarm', message: `Initiating omni-chain transfer (${chain.toUpperCase()})...` }])
      setProgressStep(1)
    }, 200)
    setTimeout(() => setTerminalLogs(prev => [...prev, { timestamp: Date.now(), agent: 'KYC Agent', message: `Validating identity for ${sourceWallet.slice(0, 6)}...` }]), 800)
    setTimeout(() => setTerminalLogs(prev => [...prev, { timestamp: Date.now(), agent: 'Risk Agent', message: 'Analyzing EVM history & sanctions list...' }]), 1500)
    setTimeout(() => {
      setTerminalLogs(prev => [...prev, { timestamp: Date.now(), agent: 'Risk Agent', message: 'No sanctions hit. Computing risk score...' }])
      setProgressStep(2)
    }, 2200)

    const t0 = performance.now()
    try {
      const params = new URLSearchParams({
        source_wallet:      sourceWallet,
        destination_wallet: destWallet,
        amount:             parseFloat(amount) || 100,
        use_zk:             useZk,
        chain:              chain,
      })
      const res = await fetch(`/api/v1/demo/agent-payment?${params}`, { method: 'POST' })
      const ms  = (performance.now() - t0).toFixed(0)
      setLatency(ms)

      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? `HTTP ${res.status}`)
        setIsTerminalThinking(false)
        return
      }
      setResult(data)
      setIsTerminalThinking(false)
      setTerminalLogs(prev => [...prev, 
        { timestamp: Date.now(), agent: 'Swarm', message: `Decision: ${data.compliance_decision.decision}` },
        { timestamp: Date.now(), agent: 'Execution Agent', message: data.credential ? `W3C Credential Minted.` : `Payment Blocked.` },
        { timestamp: Date.now(), agent: 'Execution Agent', message: `Chain status: ${data.anchor_result?.status || 'Completed'}` }
      ])
    } catch (err) {
      setError('Cannot reach the API — is the FastAPI server running?')
      setIsTerminalThinking(false)
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

            {/* Chain Selector */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
                Anchor Chain
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {CHAIN_OPTIONS.map(ch => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setChain(ch.id)}
                    disabled={loading}
                    className="py-2 px-1.5 rounded-lg font-bold text-[10px] border transition-all duration-200 disabled:opacity-50 text-center"
                    style={{
                      background:   chain === ch.id ? `${ch.color}18` : 'rgba(255,255,255,0.03)',
                      borderColor:  chain === ch.id ? `${ch.color}50` : 'rgba(255,255,255,0.08)',
                      color:        chain === ch.id ? ch.color        : '#475569',
                      boxShadow:    chain === ch.id ? `0 0 12px ${ch.color}20` : 'none',
                    }}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
              <div className="text-[10px] font-mono text-slate-700 px-1">
                {CHAIN_OPTIONS.find(c => c.id === chain)?.sublabel || ''}
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

        {/* Right — Magic Pipeline & Terminal */}
        <div className="flex flex-col gap-6">
          <div className="glass-panel rounded-2xl p-6 border flex flex-col gap-6">
            <div className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-2">
              Execution Pipeline
            </div>
            
            {/* Framer Motion Progress Pipeline */}
            <div className="flex items-start justify-between relative px-2 pt-2">
              
              {/* Line Container: strictly bounded between the first and last circle centers */}
              <div className="absolute left-[28px] right-[28px] top-[28px] h-0.5 -translate-y-1/2">
                {/* Background track */}
                <div className="absolute inset-0 bg-white/10" />
                {/* Animated fill */}
                <motion.div 
                  className="absolute left-0 top-0 bottom-0 bg-indigo-500 origin-left"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: loading ? (progressStep / 3) : result ? 1 : 0 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  style={{ boxShadow: '0 0 10px rgba(99,102,241,0.5)' }}
                />
              </div>
              
              {['Wallet Config', 'Agent Swarm', 'VC Mint', 'Chain Execution'].map((node, i) => {
                const isActive = (loading && i <= progressStep) || (result && i <= 3)
                return (
                  <div key={node} className="relative z-10 flex flex-col items-center gap-3">
                    <motion.div
                      animate={{ 
                        scale: isActive ? 1.1 : 1,
                        borderColor: isActive ? 'rgba(99,102,241,1)' : 'rgba(255,255,255,0.2)',
                        backgroundColor: isActive ? '#1e1b4b' : '#0d1220'
                      }}
                      className="w-10 h-10 rounded-full border-2 flex items-center justify-center font-mono text-xs shadow-lg transition-colors z-20"
                    >
                      {isActive ? '✓' : i + 1}
                    </motion.div>
                    <span className={`text-[9px] font-mono tracking-widest uppercase font-bold text-center w-20 leading-tight ${isActive ? 'text-indigo-400' : 'text-slate-500'}`}>
                      {node}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <AgentTerminal logs={terminalLogs} isThinking={isTerminalThinking} />
          
          {/* Final Result Card */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel-glow rounded-2xl p-6 border"
            >
               <div className="flex items-center gap-4">
                  <div className="text-4xl">{DECISION_ICONS[decisionKey]}</div>
                  <div>
                    <div className="text-xl font-black" style={{ color: dc.text }}>{decisionKey}</div>
                    <div className="text-xs font-mono text-slate-400 mt-1">
                      {result.payment_status}
                    </div>
                  </div>
               </div>
               {result.anchor_result?.transaction_hash && (
                 <div className="mt-4 pt-4 border-t border-white/10 font-mono text-[10px] space-y-2">
                   <div className="flex justify-between text-slate-500">
                     <span>Chain Hash ({result.chain})</span>
                     <span className="text-indigo-400 truncate w-32 text-right">{result.anchor_result.transaction_hash}</span>
                   </div>
                   <div className="flex justify-between text-slate-500">
                     <span>VC Minted</span>
                     <span className="text-emerald-400">{result.credential ? 'YES' : 'NO'}</span>
                   </div>
                 </div>
               )}
            </motion.div>
          )}
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
