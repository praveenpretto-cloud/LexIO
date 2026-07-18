import { useState } from 'react'

/**
 * ComplianceForm — left panel.
 * Props:
 *   onResult(data, requestPayload, latency) — called on successful API response
 *   onLoadingChange(bool) — called when loading state changes
 */
export default function ComplianceForm({ onResult, onLoadingChange }) {
  const [amount,   setAmount]   = useState('')
  const [wallet,   setWallet]   = useState('Hosted')
  const [kyc,      setKyc]      = useState(false)
  const [verified, setVerified] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const setLoadingState = (val) => {
    setLoading(val)
    onLoadingChange?.(val)
  }

  const runCheck = async (e) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!amount || isNaN(parsed) || parsed <= 0) return

    setLoadingState(true)
    setError(null)

    const payload = {
      amount:                            parsed,
      wallet_type:                       wallet,
      sender_kyc_complete:               kyc,
      wallet_cryptographically_verified: verified,
    }

    const t0 = performance.now()

    try {
      const res = await fetch('/api/v1/compliance/check', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      const latencyMs  = (performance.now() - t0).toFixed(1)
      const serverTime = res.headers.get('X-Process-Time') ?? null
      const latencyStr = serverTime ? `${serverTime} (server)` : `${latencyMs}ms (client)`

      const data = await res.json()

      if (!res.ok) {
        // Structured error envelope from our global exception handler
        setError(data.message ?? `HTTP ${res.status}`)
        onResult(null, payload, latencyStr)
        return
      }

      onResult({ ...data, _amount: amount, _wallet: wallet }, payload, latencyStr)
    } catch (err) {
      const latencyMs = (performance.now() - t0).toFixed(1)
      const msg = err.message?.includes('fetch')
        ? 'Cannot reach API — ensure FastAPI is running on :8000'
        : err.message
      setError(msg)
      onResult(null, payload, `${latencyMs}ms`)
    } finally {
      setLoadingState(false)
    }
  }

  // Live preview for the inspector
  const preview = {
    amount:                            amount ? parseFloat(amount) || 0 : 0,
    wallet_type:                       wallet,
    sender_kyc_complete:               kyc,
    wallet_cryptographically_verified: verified,
  }

  return (
    <div className="bg-[#0d1220]/60 border border-white/6 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-5">

      {/* Panel header */}
      <div className="flex items-center gap-3 pb-4 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-[#6366f1]/15 border border-[#6366f1]/20 flex items-center justify-center text-sm">
          ⚡
        </div>
        <div>
          <div className="text-sm font-bold text-white">Transaction Parameters</div>
          <div className="text-[11px] text-slate-600">Configure the transfer for compliance evaluation</div>
        </div>
        {loading && (
          <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-amber-400">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            compiling…
          </div>
        )}
      </div>

      <form onSubmit={runCheck} className="flex flex-col gap-5">

        {/* ── Amount ── */}
        <div className="space-y-2">
          <label htmlFor="amount" className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
            Transfer Amount{' '}
            <span className="text-slate-700 normal-case tracking-normal font-normal">/ Fiat equivalent</span>
          </label>
          <div className="relative">
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              required
              disabled={loading}
              className="
                w-full bg-[#111827]/60 border border-white/8 rounded-xl
                px-4 py-3.5 pr-16 text-white font-mono text-lg font-semibold
                placeholder-slate-700 outline-none transition-all duration-200
                focus:border-[#6366f1]/60 focus:bg-[#6366f1]/5
                disabled:opacity-50
              "
              style={{ boxShadow: 'none' }}
              onFocus={e  => e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'}
              onBlur={e   => e.target.style.boxShadow = 'none'}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-slate-600 tracking-widest">
              USD
            </span>
          </div>
        </div>

        {/* ── Wallet type ── */}
        <div className="space-y-2">
          <label htmlFor="wallet" className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
            Wallet Type{' '}
            <span className="text-slate-700 normal-case tracking-normal font-normal">/ Custodial classification</span>
          </label>
          <select
            id="wallet"
            value={wallet}
            onChange={e => setWallet(e.target.value)}
            disabled={loading}
            className="
              styled-select w-full bg-[#111827]/60 border border-white/8 rounded-xl
              px-4 py-3.5 appearance-none text-white font-mono font-semibold text-sm
              outline-none cursor-pointer transition-all duration-200
              focus:border-[#6366f1]/60 disabled:opacity-50
            "
          >
            <option value="Hosted">Hosted — Custodial (Exchange / VASP)</option>
            <option value="Unhosted">Unhosted — Self-Custodial (Private Wallet)</option>
          </select>
        </div>

        {/* ── Compliance flags ── */}
        <div className="space-y-2.5">
          <div className="text-[10px] font-bold tracking-widest uppercase text-slate-500">
            Compliance Flags
          </div>
          <CheckboxRow
            id="kyc"
            label="Sender KYC Complete"
            sublabel="Full originator identity verified per FATF guidelines"
            checked={kyc}
            onChange={() => setKyc(v => !v)}
            disabled={loading}
          />
          <CheckboxRow
            id="verified"
            label="Receiver Ownership Verification"
            sublabel="Unhosted wallet cryptographically proven by recipient"
            checked={verified}
            onChange={() => setVerified(v => !v)}
            disabled={loading}
          />
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 text-xs font-mono slide-up">
            <span className="mt-0.5 flex-shrink-0">⚠</span>
            <span className="break-words">{error}</span>
          </div>
        )}

        {/* ── Submit button ── */}
        <button
          type="submit"
          id="run-compliance-btn"
          disabled={loading || !amount || parseFloat(amount) <= 0}
          className="
            btn-shimmer relative w-full py-4 rounded-xl font-black text-sm
            tracking-[0.15em] uppercase text-white overflow-hidden
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          style={{
            background: loading
              ? 'linear-gradient(135deg,#374151,#4b5563,#374151)'
              : 'linear-gradient(135deg,#4f46e5,#6366f1,#7c3aed)',
            boxShadow: (!loading && amount) ? '0 4px 24px rgba(99,102,241,0.35)' : 'none',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={e => { if (!loading && amount) e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <span className="relative z-10 flex items-center justify-center gap-3">
            {loading ? (
              <>
                {/* Multi-ring spinner */}
                <span className="relative flex h-5 w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-30" />
                  <svg className="animate-spin relative h-5 w-5 text-amber-300" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                </span>
                <span className="tracking-[0.2em] text-amber-200">COMPILING POLICY…</span>
              </>
            ) : (
              <>
                <span className="text-base">⚖</span>
                RUN COMPLIANCE COMPILER
              </>
            )}
          </span>
        </button>
      </form>
    </div>
  )
}

/* ── CheckboxRow ─────────────────────────────────────────────── */
function CheckboxRow({ id, label, sublabel, checked, onChange, disabled }) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-4 p-4 rounded-xl border select-none transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{
        borderColor:     checked ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.06)',
        backgroundColor: checked ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.02)',
      }}
    >
      <input
        type="checkbox"
        id={id}
        className="custom-check"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <div className="flex-1">
        <div className={`text-sm font-semibold transition-colors ${checked ? 'text-white' : 'text-slate-400'}`}>
          {label}
        </div>
        <div className="text-[11px] text-slate-600 mt-0.5">{sublabel}</div>
      </div>
      <div
        className="text-xs font-mono font-bold px-2 py-0.5 rounded transition-all"
        style={{ color: checked ? '#818cf8' : '#374151', background: checked ? 'rgba(99,102,241,0.15)' : 'transparent' }}
      >
        {checked ? 'TRUE' : 'FALSE'}
      </div>
    </label>
  )
}
