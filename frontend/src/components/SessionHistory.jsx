import { useState, useEffect } from 'react'
import TransactionModal from './TransactionModal'

export default function SessionHistory() {
  const [history, setHistory] = useState([])
  const [selectedTxn, setSelectedTxn] = useState(null)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/v1/compliance/history?limit=10')
        const data = await res.json()
        if (data.records) setHistory(data.records)
      } catch (err) {
        console.error('Failed to fetch history:', err)
      }
    }
    fetchHistory()
    const interval = setInterval(fetchHistory, 3000)
    return () => clearInterval(interval)
  }, [])

  if (!history.length) return null

  return (
    <div className="panel">
      <div className="text-xs font-medium text-neutral-500 mb-3">Recent checks</div>
      <div className="flex flex-col divide-y divide-neutral-200">
        {history.map((h, i) => {
          const isApprove = h.status?.toUpperCase() === 'APPROVE'
          return (
            <button
              key={h.id || i}
              type="button"
              onClick={() => setSelectedTxn(h)}
              className="flex items-center gap-3 py-2 text-left text-xs font-mono hover:bg-neutral-50"
            >
              <span className={isApprove ? 'status-approve' : 'status-reject'}>{h.status}</span>
              <span className="text-neutral-800">${Number(h.amount).toLocaleString()}</span>
              <span className="text-neutral-400 ml-auto">
                {new Date(h.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </button>
          )
        })}
      </div>
      {selectedTxn && (
        <TransactionModal transaction={selectedTxn} onClose={() => setSelectedTxn(null)} />
      )}
    </div>
  )
}
