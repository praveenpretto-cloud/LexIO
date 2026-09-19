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
      label:    'XRPL',
      sublabel: 'Testnet',
    },
    Ethereum: {
      sender:   '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
      receiver: '0x53d284357EC70cE289D6D64134DfAc8E511c8a3D',
      label:    'Ethereum',
      sublabel: 'Sepolia',
    },
    Solana: {
      sender:   '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      receiver: 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy',
      label:    'Solana',
      sublabel: 'Devnet',
    },
    Base: {
      sender:   '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
      receiver: '0x53d284357EC70cE289D6D64134DfAc8E511c8a3D',
      label:    'Base',
      sublabel: 'Sepolia',
    },
    Polygon: {
      sender:   '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
      receiver: '0x53d284357EC70cE289D6D64134DfAc8E511c8a3D',
      label:    'Polygon',
      sublabel: 'Amoy',
    },
    Arbitrum: {
      sender:   '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
      receiver: '0x53d284357EC70cE289D6D64134DfAc8E511c8a3D',
      label:    'Arbitrum',
      sublabel: 'Sepolia',
    },
    Aptos: {
      sender:   '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
      receiver: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      label:    'Aptos',
      sublabel: 'Devnet',
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
    <div className="panel flex flex-col gap-5">

      <div className="pb-3 border-b border-neutral-200">
        <div className="text-sm font-semibold">Transfer</div>
        <div className="text-xs text-neutral-500 mt-0.5">Parameters for the policy check</div>
        {loading && (
          <div className="text-xs text-neutral-500 mt-2">Evaluating…</div>
        )}
      </div>

      <form onSubmit={runCheck} className="flex flex-col gap-5">

        {/* ── Origin Jurisdiction ── */}
        <div className="space-y-2">
          <label htmlFor="origin" className="field-label">
            Origin jurisdiction
          </label>
          <select
            id="origin"
            value={origin}
            onChange={e => setOrigin(e.target.value)}
            disabled={loading}
            className="field"
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
          <label htmlFor="destination" className="field-label">Destination jurisdiction</label>
          <select
            id="destination"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            disabled={loading}
            className="field"
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
          <label htmlFor="institution" className="field-label">Institution type</label>
          <select
            id="institution"
            value={institution}
            onChange={e => setInstitution(e.target.value)}
            disabled={loading}
            className="field"
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
          <label htmlFor="activity" className="field-label">Activity</label>
          <select
            id="activity"
            value={activity}
            onChange={e => setActivity(e.target.value)}
            disabled={loading}
            className="field"
          >
            <option value="transfer">Cross-border Transfer</option>
            <option value="exchange">Exchange / Swap</option>
            <option value="custody">Custody / Safekeeping</option>
            <option value="settlement">Settlement</option>
          </select>
        </div>

        {/* ── Network Selector ── */}
        <div className="space-y-2">
          <label className="field-label">Network</label>
          <div className="flex flex-wrap gap-1.5">
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
                className={`btn text-xs ${network === net ? 'btn-active' : ''}`}
              >
                {DEFAULTS[net].label}
              </button>
            ))}
          </div>
          <div className="text-xs text-neutral-500">{DEFAULTS[network]?.sublabel || ''}</div>
        </div>

        {/* ── Asset Type ── */}
        <div className="space-y-2">
          <label htmlFor="asset" className="field-label">Asset</label>
          <div className="flex gap-2">
            {['USDC', 'USDT'].map(a => (
              <button
                key={a}
                type="button"
                disabled={loading}
                onClick={() => setAsset(a)}
                className={`btn flex-1 ${asset === a ? 'btn-active' : ''}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* ── Wallet Type ── */}
        <div className="space-y-2">
          <label htmlFor="walletType" className="field-label">Wallet type</label>
          <select
            id="walletType"
            value={walletType}
            onChange={e => setWalletType(e.target.value)}
            disabled={loading}
            className="field"
          >
            <option value="Hosted">Hosted (custodial)</option>
            <option value="Unhosted">Unhosted (self-custodial)</option>
          </select>
          {walletType === 'Unhosted' && (
            <div className="text-xs text-neutral-600">
              MiCA/TFR: cryptographic proof required above 1,000 for unhosted wallets.
            </div>
          )}
        </div>

        {/* ── Sender Address ── */}
        <div className="space-y-2">
          <label htmlFor="senderAddress" className="field-label">Sender address</label>
          <input
            id="senderAddress"
            type="text"
            value={senderAddress}
            onChange={e => setSenderAddress(e.target.value)}
            disabled={loading}
            className="field font-mono text-xs"
          />
        </div>

        {/* ── Receiver Address ── */}
        <div className="space-y-2">
          <label htmlFor="receiverAddress" className="field-label">Receiver address</label>
          <input
            id="receiverAddress"
            type="text"
            value={receiverAddress}
            onChange={e => setReceiverAddress(e.target.value)}
            disabled={loading}
            className="field font-mono text-xs"
          />
        </div>

        {/* ── Amount ── */}
        <div className="space-y-2">
          <label htmlFor="amount" className="field-label">Amount (USD)</label>
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
              className="field"
            />
        </div>

        {/* ── Available Compliance Evidence ── */}
        <div className="space-y-2.5">
          <div className="field-label">Evidence (self-attested)</div>
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
          <div className="text-sm text-red-800">{error}</div>
        )}

        <button
          type="submit"
          id="run-compliance-btn"
          disabled={loading || !amount || parseFloat(amount) <= 0}
          className="btn-primary"
        >
          {loading ? 'Running check…' : 'Run check'}
        </button>
      </form>
    </div>
  )
}

/* ── ToggleRow ─────────────────────────────────────────────── */
function ToggleRow({ id, label, sublabel, checked, onChange, disabled }) {
  return (
    <label htmlFor={id} className={`flex items-start gap-3 py-2 ${disabled ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        id={id}
        className="mt-0.5"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <div>
        <div className="text-sm text-neutral-800">{label}</div>
        <div className="text-xs text-neutral-500">{sublabel}</div>
      </div>
    </label>
  )
}
