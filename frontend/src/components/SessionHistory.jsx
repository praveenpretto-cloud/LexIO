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
    <div className="bg-[#050505] border border-[#222] rounded-xl p-6 slide-up shadow-2xl relative overflow-hidden">
      <div className="relative z-10 text-[10px] font-bold tracking-widest uppercase text-[#888] mb-4 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#00FF00] animate-pulse" />
        Live Audit Trail
      </div>
      <div className="relative z-10 flex flex-wrap gap-2">
        {history.map((h, i) => {
          const isApprove = h.status?.toUpperCase() === 'APPROVE'
          return (
            <div
              key={h.id || i}
              onClick={() => setSelectedTxn(h)}
              className="flex items-center gap-2 px-3 py-2 rounded border text-[11px] font-mono cursor-pointer hover:bg-[#111] transition-all"
              style={{
                background:  '#000000',
                borderColor: isApprove ? 'rgba(0,255,0,0.2)'  : 'rgba(255,0,0,0.2)',
                color:       isApprove ? '#00FF00'                 : '#FF0000',
                boxShadow:   isApprove ? '0 0 10px rgba(0,255,0,0.05)' : '0 0 10px rgba(255,0,0,0.05)',
              }}
            >
              <span className="font-black tracking-widest uppercase text-[9px]">{h.status}</span>
              <span className="text-[#333]">/</span>
              <span className="text-[#999]">${Number(h.amount).toLocaleString()}</span>
              {h.authorization_hash && (
                <>
                  <span className="text-[#333]">/</span>
                  <span className="text-[#666]">
                    {h.authorization_hash.substring(0, 4)}...
                  </span>
                </>
              )}
              <span className="text-[#333]">/</span>
              <span className="text-[#555]">
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
