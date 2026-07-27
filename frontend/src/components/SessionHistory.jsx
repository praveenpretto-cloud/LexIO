import { useState, useEffect } from 'react'
import TransactionModal from './TransactionModal'

export default function SessionHistory() {
  const [history, setHistory] = useState([])
  const [selectedTxn, setSelectedTxn] = useState(null)

  // Poll the backend history every 3 seconds to get live hash updates
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/v1/compliance/history?limit=10')
        const data = await res.json()
        if (data.records) {
          setHistory(data.records)
        }
      } catch (err) {
        console.error("Failed to fetch history:", err)
      }
    }
    
    fetchHistory()
    const interval = setInterval(fetchHistory, 3000)
    return () => clearInterval(interval)
  }, [])

  if (!history.length) return null

  return (
    <div className="bg-[#0d1220]/40 border border-white/5 rounded-2xl p-5 slide-up">
      <div className="text-[10px] font-bold tracking-widest uppercase text-slate-600 mb-3">
        Recent Checks (Live Polling)
      </div>
      <div className="flex flex-wrap gap-2">
        {history.map((h, i) => {
          const isApprove = h.status?.toUpperCase() === 'APPROVE'
          return (
            <div
              key={h.id || i}
              onClick={() => setSelectedTxn(h)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-mono cursor-pointer hover:scale-[1.03] transition-transform"
              style={{
                background:  isApprove ? 'rgba(16,185,129,0.08)'  : 'rgba(244,63,94,0.08)',
                borderColor: isApprove ? 'rgba(16,185,129,0.20)'  : 'rgba(244,63,94,0.20)',
                color:       isApprove ? '#34d399'                 : '#fb7185',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: isApprove ? '#34d399' : '#fb7185' }}
              />
              <span className="font-bold">{h.status}</span>
              <span className="text-slate-700">·</span>
              <span className="text-slate-400">{Number(h.amount).toLocaleString()}</span>
              {h.authorization_hash && (
                <>
                  <span className="text-slate-700">·</span>
                  <span className="text-emerald-400/50">
                    {h.authorization_hash.substring(0, 4)}...
                  </span>
                </>
              )}
              <span className="text-slate-700">·</span>
              <span className="text-slate-700">
                {new Date(h.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          )
        })}
      </div>
      
      {selectedTxn && (
        <TransactionModal transaction={selectedTxn} onClose={() => setSelectedTxn(null)} />
      )}
    </div>
  )
}
