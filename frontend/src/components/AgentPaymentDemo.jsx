import { useState } from 'react'
import AgentTerminal from './AgentTerminal'

const DEMO_WALLETS = {
  CLEAN_SOURCE: 'rN7n7otQDd6FczFgLdQqhkFGzPb7E4k7Ud',
  CLEAN_DEST: 'rAbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfG',
  PEP_DEST: 'rU6K7V8oST9vMN2pQr4sT5uV6wX7yZ8aA',
  HIGH_RISK_DEST: 'rHighRiskCountryWalletXxXxXxXxXx',
  CAYMAN_DEST: 'rCaymanFundWalletXxXxXxXxXxXxXx',
}

const CHAINS = ['xrpl', 'ethereum', 'solana', 'base', 'polygon', 'arbitrum', 'aptos']

const PRESETS = [
  { label: 'Clean → Clean', sublabel: 'SCDD · Approve', source: DEMO_WALLETS.CLEAN_SOURCE, dest: DEMO_WALLETS.CLEAN_DEST },
  { label: 'Clean → PEP fixture', sublabel: 'EDD · Reject', source: DEMO_WALLETS.CLEAN_SOURCE, dest: DEMO_WALLETS.PEP_DEST },
  { label: 'Clean → High-risk', sublabel: 'EDD · Watch', source: DEMO_WALLETS.CLEAN_SOURCE, dest: DEMO_WALLETS.HIGH_RISK_DEST },
  { label: 'Clean → Cayman', sublabel: 'CDD · Approve', source: DEMO_WALLETS.CLEAN_SOURCE, dest: DEMO_WALLETS.CAYMAN_DEST },
]

export default function AgentPaymentDemo() {
  const [sourceWallet, setSourceWallet] = useState(DEMO_WALLETS.CLEAN_SOURCE)
  const [destWallet, setDestWallet] = useState(DEMO_WALLETS.CLEAN_DEST)
  const [amount, setAmount] = useState('100')
  const [useZk, setUseZk] = useState(false)
  const [chain, setChain] = useState('xrpl')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [latency, setLatency] = useState(null)
  const [terminalLogs, setTerminalLogs] = useState([])
  const [isTerminalThinking, setIsTerminalThinking] = useState(false)

  const reset = () => {
    setResult(null)
    setError(null)
    setLatency(null)
  }

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

    const t0 = performance.now()
    try {
      const params = new URLSearchParams({
        source_wallet: sourceWallet,
        destination_wallet: destWallet,
        amount: parseFloat(amount) || 100,
        use_zk: useZk,
        chain,
      })
      const res = await fetch(`/api/v1/demo/agent-payment?${params}`, { method: 'POST' })
      const ms = (performance.now() - t0).toFixed(0)
      setLatency(ms)
      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? `HTTP ${res.status}`)
        return
      }
      setResult(data)
      setTerminalLogs([
        { timestamp: Date.now(), message: `POST /api/v1/demo/agent-payment (${chain})` },
        { timestamp: Date.now(), message: `Decision: ${data.compliance_decision.decision}` },
      ])
    } catch {
      setError('Cannot reach the API.')
    } finally {
      setLoading(false)
      setIsTerminalThinking(false)
    }
  }

  const decision = result?.compliance_decision
  const decisionKey = decision?.decision ?? ''
  const statusClass =
    decisionKey === 'APPROVE' ? 'status-approve' : decisionKey === 'REJECT' ? 'status-reject' : 'status-watch'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="btn text-left" onClick={() => applyPreset(p)}>
            <div>{p.label}</div>
            <div className="text-[11px] text-neutral-500">{p.sublabel}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={runDemo} className="panel flex flex-col gap-4">
          <div>
            <label htmlFor="agentSource" className="field-label">Source wallet</label>
            <input id="agentSource" className="field font-mono text-xs" value={sourceWallet} disabled={loading} onChange={(e) => { setSourceWallet(e.target.value); reset() }} />
          </div>
          <div>
            <label htmlFor="agentDest" className="field-label">Destination wallet</label>
            <input id="agentDest" className="field font-mono text-xs" value={destWallet} disabled={loading} onChange={(e) => { setDestWallet(e.target.value); reset() }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="agentAmount" className="field-label">Amount (USD)</label>
              <input id="agentAmount" type="number" step="0.01" min="0" className="field" value={amount} disabled={loading} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <div className="field-label">Groth16 proof</div>
              <button type="button" className={`btn w-full ${useZk ? 'btn-active' : ''}`} onClick={() => setUseZk(!useZk)}>
                {useZk ? 'On' : 'Off'}
              </button>
            </div>
          </div>
          <div>
            <div className="field-label">Chain</div>
            <div className="flex flex-wrap gap-1.5">
              {CHAINS.map((id) => (
                <button key={id} type="button" disabled={loading} onClick={() => setChain(id)} className={`btn text-xs ${chain === id ? 'btn-active' : ''}`}>
                  {id}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="text-sm text-red-800">{error}</div>}
          <button id="run-agent-demo-btn" type="submit" className="btn-primary" disabled={loading || !sourceWallet || !destWallet}>
            {loading ? 'Submitting…' : 'Submit transfer'}
          </button>
          {latency && !loading && <div className="text-xs text-neutral-500">{latency} ms</div>}
        </form>

        <div>
          {result ? (
            <div className="panel flex flex-col gap-3">
              <div className={`text-sm font-semibold ${statusClass}`}>{decisionKey}</div>
              <div className="text-xs text-neutral-500">Tier {decision?.risk_tier}</div>
              {decision?.reasons?.length > 0 && (
                <ul className="text-sm list-disc pl-4 text-neutral-800">
                  {decision.reasons.map((r) => <li key={r}>{r}</li>)}
                </ul>
              )}
            </div>
          ) : (
            <div className="panel text-sm text-neutral-500">No transfer submitted.</div>
          )}
          <AgentTerminal logs={terminalLogs} isThinking={isTerminalThinking} />
        </div>
      </div>
    </div>
  )
}
