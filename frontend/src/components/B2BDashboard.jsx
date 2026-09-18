import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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
      const res = await fetch('/api/v1/compliance/history?limit=50')
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
    if (!addr) return 'Unknown'
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatDate = (isoString) => {
    const d = new Date(isoString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(d)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Compliance Hub</h2>
          <p className="text-slate-400 text-sm mt-1">Real-time audit log of all agent-cleared transactions</p>
        </div>
        <button
          onClick={fetchHistory}
          className="px-4 py-2 bg-[#0d1326] border border-indigo-500/20 text-indigo-400 text-sm font-semibold rounded-lg hover:bg-indigo-900/20 transition-all shadow-[0_0_15px_rgba(99,102,241,0.1)]"
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="bg-[#0b101e] border border-white/5 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
        
        <div className="overflow-x-auto relative z-10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-[#0d1326]/50">
                <th className="p-4 text-[11px] font-mono text-slate-500 font-semibold tracking-wider uppercase">Date</th>
                <th className="p-4 text-[11px] font-mono text-slate-500 font-semibold tracking-wider uppercase">Network</th>
                <th className="p-4 text-[11px] font-mono text-slate-500 font-semibold tracking-wider uppercase">Amount</th>
                <th className="p-4 text-[11px] font-mono text-slate-500 font-semibold tracking-wider uppercase">Route (Jurisdictions)</th>
                <th className="p-4 text-[11px] font-mono text-slate-500 font-semibold tracking-wider uppercase">Status</th>
                <th className="p-4 text-[11px] font-mono text-slate-500 font-semibold tracking-wider uppercase text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && !loading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-500 text-sm italic">
                    No transactions found in the database.
                  </td>
                </tr>
              ) : (
                history.map((tx) => {
                  const isApprove = tx.status?.toUpperCase() === 'APPROVE'
                  const isExpanded = expandedId === tx.id
                  return (
                    <React.Fragment key={tx.id}>
                      <tr 
                        onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                        className={`border-b border-white/5 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-900/10' : 'hover:bg-white/5'}`}
                      >
                        <td className="p-4 text-xs text-slate-300 font-mono">{formatDate(tx.checked_at)}</td>
                        <td className="p-4 text-xs">
                          <span className="px-2 py-1 bg-slate-800 rounded-md border border-slate-700 text-slate-300 font-semibold tracking-wide">
                            {tx.network || 'XRPL'}
                          </span>
                        </td>
                        <td className="p-4 text-sm font-semibold text-white">
                          ${tx.amount?.toFixed(2)} <span className="text-slate-500 text-xs font-normal">{tx.stablecoin_type}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                            <span className="text-slate-300" title={tx.sender_address}>{formatAddress(tx.sender_address)}</span>
                            <span className="px-1.5 py-0.5 bg-black/40 rounded border border-white/10 text-[9px]">{tx.sender_jurisdiction}</span>
                            <span className="text-indigo-400">→</span>
                            <span className="text-slate-300" title={tx.receiver_address}>{formatAddress(tx.receiver_address)}</span>
                            <span className="px-1.5 py-0.5 bg-black/40 rounded border border-white/10 text-[9px]">{tx.receiver_jurisdiction}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border ${
                            isApprove ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30' : 'bg-rose-900/30 text-rose-400 border-rose-500/30'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold">
                            {isExpanded ? 'Collapse' : 'Audit'}
                          </button>
                        </td>
                      </tr>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-[#090d18] border-b border-indigo-500/10"
                          >
                            <td colSpan="6" className="p-0">
                              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* AI Reasoning Block */}
                                <div className="space-y-3">
                                  <h4 className="text-[10px] font-bold tracking-widest uppercase text-indigo-400 flex items-center gap-2">
                                    <span>🧠</span> LexIO AI Reasoning
                                  </h4>
                                  <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-xs text-slate-300 leading-relaxed font-mono">
                                    {tx.reason || 'No reasoning provided by the AI engine.'}
                                  </div>
                                </div>

                                {/* On-Chain Proof Block */}
                                <div className="space-y-3">
                                  <h4 className="text-[10px] font-bold tracking-widest uppercase text-emerald-400 flex items-center gap-2">
                                    <span>🛡️</span> Zero-Knowledge Anchor
                                  </h4>
                                  <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-2">
                                    <div className="flex flex-col">
                                      <span className="text-[10px] text-slate-500 font-mono uppercase">Transaction Hash</span>
                                      <span className="text-xs text-emerald-300 font-mono break-all">{tx.authorization_hash || 'N/A'}</span>
                                    </div>
                                    <div className="flex flex-col pt-2 border-t border-white/5">
                                      <span className="text-[10px] text-slate-500 font-mono uppercase">LexIO Credential Standard</span>
                                      <span className="text-xs text-slate-300 font-mono">W3C Verifiable Credential (Groth16/bn128)</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}
