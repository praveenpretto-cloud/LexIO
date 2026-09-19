import { Fragment, useState, useEffect } from 'react'

export default function B2BDashboard() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/v1/agent/history?limit=50')
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to fetch history')
      setHistory(data.records || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatAddress = (addr) => {
    if (!addr) return '—'
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
  }

  const formatDate = (isoString) => {
    const d = new Date(isoString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Audit log</h1>
          <p className="text-sm text-neutral-500 mt-1">GET /api/v1/agent/history</p>
        </div>
        <button type="button" className="btn" onClick={fetchHistory}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="panel text-sm text-red-800 border-red-200">{error}</div>
      )}

      <div className="panel p-0 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs text-neutral-500">
              <th className="p-3 font-medium">Time</th>
              <th className="p-3 font-medium">Network</th>
              <th className="p-3 font-medium">Amount</th>
              <th className="p-3 font-medium">Route</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && !loading ? (
              <tr>
                <td colSpan="6" className="p-8 text-center text-neutral-500 text-sm">
                  No records.
                </td>
              </tr>
            ) : (
              history.map((tx) => {
                const isApprove = tx.status?.toUpperCase() === 'APPROVE'
                const isExpanded = expandedId === tx.id
                return (
                  <Fragment key={tx.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                      className="border-b border-neutral-100 cursor-pointer hover:bg-neutral-50"
                    >
                      <td className="p-3 font-mono text-xs text-neutral-600">{formatDate(tx.checked_at)}</td>
                      <td className="p-3 text-xs">{tx.network || 'XRPL'}</td>
                      <td className="p-3 font-mono text-xs">${tx.amount?.toFixed(2)}</td>
                      <td className="p-3 font-mono text-xs text-neutral-600">
                        {formatAddress(tx.sender_address)} → {formatAddress(tx.receiver_address)}
                      </td>
                      <td className={`p-3 text-xs ${isApprove ? 'status-approve' : 'status-reject'}`}>
                        {tx.status}
                      </td>
                      <td className="p-3 text-xs text-neutral-500">{isExpanded ? 'Hide' : 'Detail'}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-neutral-200 bg-neutral-50">
                        <td colSpan="6" className="p-4 text-xs">
                          <div className="field-label">Reason</div>
                          <p className="mb-3 whitespace-pre-wrap text-neutral-800">{tx.reason || '—'}</p>
                          {tx.use_zk && (
                            <div className="flex gap-3 mb-2">
                              <a href="/static/zk/proof.json" download="proof.json">proof.json</a>
                              <a href="/static/zk/public.json" download="publicSignals.json">publicSignals.json</a>
                              <a href="/static/zk/vkey.json" download="vkey.json">vkey.json</a>
                            </div>
                          )}
                          <div className="field-label">Hash</div>
                          <div className="font-mono break-all text-neutral-600">{tx.authorization_hash || '—'}</div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
