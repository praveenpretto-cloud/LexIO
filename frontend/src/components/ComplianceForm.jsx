import { useState } from 'react'

/**
 * ComplianceForm — left panel.
 * Props:
 *   onResult(data, requestPayload, latency) — called on successful API response
 *   onLoadingChange(bool) — called when loading state changes
 */
export default function ComplianceForm({ onResult, onLoadingChange }) {
  // Default addresses per network
  const DEFAULTS = {

    XRPL: {
      sender:   'rapGvMNARmA46HRNoGBiTy1nEwiKdVTfPw',
      receiver: 'rEGcPEhZbvFMr14wBhm3TUc1EanWWMU367',
      label:    '◈ XRPL',
      sublabel: 'Ripple Altnet · XRP · ~4s finality',
    },
    Ethereum: {
      sender:   '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
      receiver: '0x53d284357EC70cE289D6D64134DfAc8E511c8a3D',
      label:    '⟠ Ethereum',
      sublabel: 'Sepolia · ETH · ~12s finality',
    },
    Solana: {
      sender:   '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      receiver: 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy',
      label:    '◎ Solana',
      sublabel: 'Devnet · SOL · ~400ms finality',
    },
    Base: {
      sender:   '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
      receiver: '0x53d284357EC70cE289D6D64134DfAc8E511c8a3D',
      label:    '🔵 Base',
      sublabel: 'Sepolia · ETH · ~2s finality',
    },
    Polygon: {
      sender:   '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
      receiver: '0x53d284357EC70cE289D6D64134DfAc8E511c8a3D',
      label:    '⬡ Polygon',
      sublabel: 'Amoy · POL · ~2s finality',
    },
    Arbitrum: {
      sender:   '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
      receiver: '0x53d284357EC70cE289D6D64134DfAc8E511c8a3D',
      label:    '🔷 Arbitrum',
      sublabel: 'Sepolia · ETH · ~250ms finality',
    },
    Aptos: {
      sender:   '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
      receiver: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      label:    '🅰 Aptos',
      sublabel: 'Devnet · APT · ~1s finality',
    },
  }

  const [senderAddress, setSenderAddress] = useState(DEFAULTS.XRPL.sender)
  const [receiverAddress, setReceiverAddress] = useState(DEFAULTS.XRPL.receiver)
  const [amount, setAmount] = useState('')
  const [origin, setOrigin] = useState('SG')
  const [destination, setDestination] = useState('EU')
  const [institution, setInstitution] = useState('MPI')
  const [activity, setActivity] = useState('transfer')
  const [asset, setAsset] = useState('USDC')
  const [network, setNetwork] = useState('XRPL')
  const [walletType, setWalletType] = useState('Hosted')
  const [kyc, setKyc] = useState(false)
  const [ownership, setOwnership] = useState(false)
  const [sanctions, setSanctions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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

    // New-format payload shown in the API Inspector
    const inspectorPayload = {
      origin,
      destination,
      institution_type: institution,
      activity,
      asset,
      wallet_type: walletType,
      amount: parsed,
      evidence: {
        kyc,
        ownership,
        sanctions,
      },
    }

    // Backend-compatible payload (existing schema)
    const backendPayload = {
      sender_address: senderAddress,
      receiver_address: receiverAddress,
      amount: parsed,
      stablecoin_type: asset,
      sender_jurisdiction: origin,
      receiver_jurisdiction: destination,
      institution_type: institution,
      wallet_type: walletType,
      sender_kyc_complete: kyc,
      wallet_cryptographically_verified: ownership,
      network,
    }

    const t0 = performance.now()

    try {
      const res = await fetch('/api/v1/compliance/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendPayload),
      })

      const latencyMs = (performance.now() - t0).toFixed(1)
      const serverTime = res.headers.get('X-Process-Time') ?? null
      const latencyStr = serverTime ? `${serverTime} (server)` : `${latencyMs}ms (client)`

      const data = await res.json()

      if (!res.ok) {
        setError(data.message ?? `HTTP ${res.status}`)
        onResult(null, inspectorPayload, latencyStr)
        return
      }

      // Build enriched response to match new format for inspector display
      const enrichedResponse = {
        decision: data.status?.toUpperCase() === 'APPROVE' ? 'approved' : 'rejected',
        risk: data.status?.toUpperCase() === 'APPROVE' ? 'low' : 'high',
        policy_packs: ['MAS Pack v0.9.2', 'MiCA Pack v1.0.1', 'GENIUS Act Pack v1.0'],
        rules_triggered: ['MAS-PSN02', 'MiCA-14', 'US-GENIUS'],
        obligations: data.status?.toUpperCase() === 'APPROVE'
          ? ['Travel Rule Required', 'Record Retention']
          : [],
        reason: data.reason,
        status: data.status,
        authorization_hash: data.authorization_hash,
      }

      onResult(
        { ...enrichedResponse, _amount: amount, _asset: asset },
        inspectorPayload,
        latencyStr,
      )
    } catch (err) {
      const latencyMs = (performance.now() - t0).toFixed(1)
      // Covers: Safari "The string did not match the expected pattern.",
      // Chrome "Failed to fetch", Firefox "NetworkError", JSON parse
      // failures (backend returned HTML/502), and all other fetch errors.
      const isNetworkError =
        err.name === 'TypeError' ||
        err.name === 'SyntaxError' ||
        err.name === 'NetworkError' ||
        err.message?.toLowerCase().includes('fetch') ||
        err.message?.toLowerCase().includes('network') ||
        err.message?.toLowerCase().includes('pattern') ||
        err.message?.toLowerCase().includes('json') ||
        err.message?.toLowerCase().includes('failed')
      const msg = isNetworkError
        ? 'Cannot reach the API — the backend server is not running or not reachable. Check that FastAPI is running and accessible.'
        : `Error: ${err.message}`
      setError(msg)
      onResult(null, inspectorPayload, `${latencyMs}ms`)
    } finally {
      setLoadingState(false)
    }
  }

  // Live preview for the inspector (new format)
  const preview = {
    senderAddress,
    receiverAddress,
    origin,
    destination,
    institution_type: institution,
    activity,
    asset,
    wallet_type: walletType,
    amount: amount ? parseFloat(amount) || 0 : 0,
    evidence: { kyc, ownership, sanctions },
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
          <div className="text-[11px] text-slate-600">Configure the transfer for policy evaluation</div>
        </div>
        {loading && (
          <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-amber-400">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            evaluating…
          </div>
        )}
      </div>

      <form onSubmit={runCheck} className="flex flex-col gap-5">

        {/* ── Origin Jurisdiction ── */}
        <div className="space-y-2">
          <label htmlFor="origin" className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
            Origin Jurisdiction
          </label>
          <select
            id="origin"
            value={origin}
            onChange={e => setOrigin(e.target.value)}
            disabled={loading}
            className="
              styled-select w-full bg-[#111827]/60 border border-white/8 rounded-xl
              px-4 py-3.5 appearance-none text-white font-mono font-semibold text-sm
              outline-none cursor-pointer transition-all duration-200
              focus:border-[#6366f1]/60 disabled:opacity-50
            "
          >
            <option value="EU">European Union</option>
            <option value="SG">Singapore</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
            <option value="HK">Hong Kong</option>
            <option value="JP">Japan</option>
            <option value="AU">Australia</option>
          </select>
        </div>

        {/* ── Destination Jurisdiction ── */}
        <div className="space-y-2">
          <label htmlFor="destination" className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
            Destination Jurisdiction
          </label>
          <select
            id="destination"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            disabled={loading}
            className="
              styled-select w-full bg-[#111827]/60 border border-white/8 rounded-xl
              px-4 py-3.5 appearance-none text-white font-mono font-semibold text-sm
              outline-none cursor-pointer transition-all duration-200
              focus:border-[#6366f1]/60 disabled:opacity-50
            "
          >
            <option value="EU">European Union</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
            <option value="SG">Singapore</option>
            <option value="JP">Japan</option>
            <option value="CH">Switzerland</option>
          </select>
        </div>

        {/* ── Institution Type ── */}
        <div className="space-y-2">
          <label htmlFor="institution" className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
            Institution Type
          </label>
          <select
            id="institution"
            value={institution}
            onChange={e => setInstitution(e.target.value)}
            disabled={loading}
            className="
              styled-select w-full bg-[#111827]/60 border border-white/8 rounded-xl
              px-4 py-3.5 appearance-none text-white font-mono font-semibold text-sm
              outline-none cursor-pointer transition-all duration-200
              focus:border-[#6366f1]/60 disabled:opacity-50
            "
          >
                  <option value="MPI">MPI (Major Payment Institution - MAS)</option>
                  <option value="CASP">CASP (Crypto-Asset Service Provider - MiCA)</option>
                  <option value="LPSI">LPSI (Licensed Stablecoin Issuer - GENIUS)</option>
                  <option value="VASP">VASP (Virtual Asset Service Provider)</option>
                  <option value="EMI">EMI (Electronic Money Institution)</option>
                  <option value="BANK">Bank</option>
                  <option value="CUSTODIAN">Custodian</option>
          </select>
        </div>

        {/* ── Activity ── */}
        <div className="space-y-2">
          <label htmlFor="activity" className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
            Activity
          </label>
          <select
            id="activity"
            value={activity}
            onChange={e => setActivity(e.target.value)}
            disabled={loading}
            className="
              styled-select w-full bg-[#111827]/60 border border-white/8 rounded-xl
              px-4 py-3.5 appearance-none text-white font-mono font-semibold text-sm
              outline-none cursor-pointer transition-all duration-200
              focus:border-[#6366f1]/60 disabled:opacity-50
            "
          >
            <option value="transfer">Cross-border Transfer</option>
            <option value="exchange">Exchange / Swap</option>
            <option value="custody">Custody / Safekeeping</option>
            <option value="settlement">Settlement</option>
          </select>
        </div>

        {/* ── Network Selector ── */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
            Blockchain Network
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {Object.keys(DEFAULTS).map(net => (
              <button
                key={net}
                type="button"
                disabled={loading}
                onClick={() => {
                  setNetwork(net)
                  setSenderAddress(DEFAULTS[net].sender)
                  setReceiverAddress(DEFAULTS[net].receiver)
                }}
                className="py-2.5 px-2 rounded-xl font-bold text-[11px] tracking-wide border transition-all duration-200 disabled:opacity-50 text-center"
                style={{
                  background:   network === net ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                  borderColor:  network === net ? 'rgba(99,102,241,0.5)'  : 'rgba(255,255,255,0.08)',
                  color:        network === net ? '#a5b4fc'               : '#475569',
                  boxShadow:    network === net ? '0 0 16px rgba(99,102,241,0.2)' : 'none',
                }}
              >
                {DEFAULTS[net].label}
              </button>
            ))}
          </div>
          <div className="text-[10px] font-mono text-slate-700 px-1">
            {DEFAULTS[network]?.sublabel || ''}
          </div>
        </div>

        {/* ── Asset Type ── */}
        <div className="space-y-2">
          <label htmlFor="asset" className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
            Asset
          </label>
          <div className="flex gap-2">
            {['USDC', 'USDT'].map(a => (
              <button
                key={a}
                type="button"
                disabled={loading}
                onClick={() => setAsset(a)}
                className="flex-1 py-3 rounded-xl font-bold text-sm tracking-wide border transition-all duration-200 disabled:opacity-50"
                style={{
                  background:   asset === a ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
                  borderColor:  asset === a ? 'rgba(16,185,129,0.4)'  : 'rgba(255,255,255,0.08)',
                  color:        asset === a ? '#34d399'               : '#475569',
                  boxShadow:    asset === a ? '0 0 16px rgba(16,185,129,0.15)' : 'none',
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* ── Wallet Type ── */}
        <div className="space-y-2">
          <label htmlFor="walletType" className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
            Wallet Type{' '}
            <span className="text-slate-700 normal-case tracking-normal font-normal">/ Custodial classification</span>
          </label>
          <select
            id="walletType"
            value={walletType}
            onChange={e => setWalletType(e.target.value)}
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
          {walletType === 'Unhosted' && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-mono"
              style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)', color: '#fbbf24' }}
            >
              <span>⚠</span>
              <span>EU MiCA / TFR rules apply — cryptographic proof required above €1,000</span>
            </div>
          )}
        </div>

        {/* ── Sender Address ── */}
        <div className="space-y-2">
          <label htmlFor="senderAddress" className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
            Sender Address
          </label>
          <input
            id="senderAddress"
            type="text"
            value={senderAddress}
            onChange={e => setSenderAddress(e.target.value)}
            disabled={loading}
            className="
              w-full bg-[#111827]/60 border border-white/8 rounded-xl
              px-4 py-3 text-white font-mono text-xs
              outline-none transition-all duration-200
              focus:border-[#6366f1]/60 focus:bg-[#6366f1]/5
              disabled:opacity-50
            "
          />
        </div>

        {/* ── Receiver Address ── */}
        <div className="space-y-2">
          <label htmlFor="receiverAddress" className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
            Receiver Address
          </label>
          <input
            id="receiverAddress"
            type="text"
            value={receiverAddress}
            onChange={e => setReceiverAddress(e.target.value)}
            disabled={loading}
            className="
              w-full bg-[#111827]/60 border border-white/8 rounded-xl
              px-4 py-3 text-white font-mono text-xs
              outline-none transition-all duration-200
              focus:border-[#6366f1]/60 focus:bg-[#6366f1]/5
              disabled:opacity-50
            "
          />
        </div>

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
              onFocus={e => e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'}
              onBlur={e => e.target.style.boxShadow = 'none'}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-slate-600 tracking-widest">
              USD
            </span>
          </div>
        </div>

        {/* ── Available Compliance Evidence ── */}
        <div className="space-y-2.5">
          <div className="text-[10px] font-bold tracking-widest uppercase text-slate-500">
            Available Compliance Evidence
          </div>
          <ToggleRow
            id="kyc"
            label="Sender KYC Verified"
            sublabel="Full originator identity verified per FATF guidelines"
            checked={kyc}
            onChange={() => setKyc(v => !v)}
            disabled={loading}
          />
          <ToggleRow
            id="ownership"
            label="Beneficial Owner Verified"
            sublabel="Ultimate beneficial ownership confirmed and documented"
            checked={ownership}
            onChange={() => setOwnership(v => !v)}
            disabled={loading}
          />
          <ToggleRow
            id="sanctions"
            label="Sanctions Screening Passed"
            sublabel="All parties cleared against OFAC, UN, EU and MAS sanctions lists"
            checked={sanctions}
            onChange={() => setSanctions(v => !v)}
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
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </span>
                <span className="tracking-[0.2em] text-amber-200">EVALUATING POLICY…</span>
              </>
            ) : (
              <>
                <span className="text-base">⚖</span>
                EVALUATE POLICY
              </>
            )}
          </span>
        </button>
      </form>
    </div>
  )
}

/* ── ToggleRow ─────────────────────────────────────────────── */
function ToggleRow({ id, label, sublabel, checked, onChange, disabled }) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-4 p-4 rounded-xl border select-none transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{
        borderColor: checked ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.06)',
        backgroundColor: checked ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.02)',
      }}
    >
      {/* Hidden checkbox for accessibility */}
      <input
        type="checkbox"
        id={id}
        className="sr-only"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />

      {/* Toggle pill */}
      <div
        className="relative flex-shrink-0 w-11 h-6 rounded-full transition-all duration-200"
        style={{
          background: checked
            ? 'linear-gradient(135deg,#4f46e5,#6366f1)'
            : 'rgba(255,255,255,0.08)',
          boxShadow: checked ? '0 0 12px rgba(99,102,241,0.45)' : 'none',
          border: checked ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200 shadow-sm"
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </div>

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
