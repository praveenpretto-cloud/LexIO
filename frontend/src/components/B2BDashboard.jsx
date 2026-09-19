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
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Compliance Hub</h2>
          <p className="text-[#888] text-sm mt-1 font-mono tracking-wide">Secure Audit Log // ZK-Attested Omnichain Verifications</p>
        </div>
        <button
          onClick={fetchHistory}
          className="px-5 py-2.5 bg-black border border-[#333] text-white text-sm font-semibold rounded-md hover:border-white/50 hover:bg-[#111] transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)] flex items-center gap-2"
        >
          {loading ? (
             <span className="flex items-center gap-2">
               <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
               SYNCING LEDGER
             </span>
          ) : (
            'REFRESH DATA'
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-500/50 rounded-lg text-red-400 text-sm font-mono">
          [SYS_ERROR]: {error}
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-[#050505] border border-[#222] rounded-xl overflow-hidden shadow-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
        
        <div className="overflow-x-auto relative z-10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#222] bg-[#000000]">
                <th className="p-5 text-[10px] font-mono text-[#666] font-bold tracking-widest uppercase">Timestamp</th>
                <th className="p-5 text-[10px] font-mono text-[#666] font-bold tracking-widest uppercase">Network</th>
                <th className="p-5 text-[10px] font-mono text-[#666] font-bold tracking-widest uppercase">Amount</th>
                <th className="p-5 text-[10px] font-mono text-[#666] font-bold tracking-widest uppercase">Route</th>
                <th className="p-5 text-[10px] font-mono text-[#666] font-bold tracking-widest uppercase">Status</th>
                <th className="p-5 text-[10px] font-mono text-[#666] font-bold tracking-widest uppercase text-right">Audit</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && !loading ? (
                <tr>
                  <td colSpan="6" className="p-10 text-center text-[#555] text-sm font-mono italic">
                    NO TRANSACTIONS FOUND IN ACTIVE LEDGER.
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
                        className={`border-b border-[#1a1a1a] transition-all cursor-pointer ${isExpanded ? 'bg-[#0a0a0a]' : 'hover:bg-[#0f0f0f]'}`}
                      >
                        <td className="p-5 text-xs text-[#999] font-mono tracking-tight">{formatDate(tx.checked_at)}</td>
                        <td className="p-5 text-xs">
                          <span className="px-2 py-1 bg-[#111] rounded border border-[#333] text-[#bbb] font-mono tracking-wide uppercase text-[10px]">
                            {tx.network || 'XRPL'}
                          </span>
                        </td>
                        <td className="p-5 text-sm font-semibold text-white font-mono">
                          ${tx.amount?.toFixed(2)} <span className="text-[#666] text-[10px] uppercase ml-1">USD</span>
                        </td>
                        <td className="p-5">
                          <div className="flex items-center gap-2 text-xs font-mono text-[#777]">
                            <span className="text-white hover:text-white transition-colors" title={tx.sender_address}>{formatAddress(tx.sender_address)}</span>
                            <span className="text-[#333]">&rarr;</span>
                            <span className="text-white hover:text-white transition-colors" title={tx.receiver_address}>{formatAddress(tx.receiver_address)}</span>
                          </div>
                        </td>
                        <td className="p-5">
                          <span className={`px-2.5 py-1 rounded-sm text-[9px] font-black tracking-widest uppercase border flex items-center justify-center w-fit gap-1.5 ${
                            isApprove 
                              ? 'bg-[#00FF00]/10 text-[#00FF00] border-[#00FF00]/30 shadow-[0_0_10px_rgba(0,255,0,0.1)]' 
                              : 'bg-[#FF0000]/10 text-[#FF0000] border-[#FF0000]/30 shadow-[0_0_10px_rgba(255,0,0,0.1)]'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isApprove ? 'bg-[#00FF00] animate-pulse' : 'bg-[#FF0000]'}`} />
                            {tx.status}
                          </span>
                        </td>
                        <td className="p-5 text-right">
                          <button className="text-[#666] hover:text-white text-[10px] font-mono tracking-widest uppercase transition-colors">
                            {isExpanded ? 'Collapse' : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-[#020202] border-b border-[#222]"
                          >
                            <td colSpan="6" className="p-0">
                              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 relative overflow-hidden">
                                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/[0.01] via-transparent to-transparent pointer-events-none" />
                                
                                {/* AI Reasoning Block */}
                                <div className="space-y-4 relative z-10">
                                  <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-white">
                                    <div className="w-1 h-3 bg-white" /> LexIO Sentinel (AI Engine)
                                  </div>
                                  <div className="p-4 bg-black rounded-lg border border-[#333] text-xs text-[#aaa] leading-relaxed font-mono whitespace-pre-wrap shadow-inner">
                                    {tx.reason || 'No reasoning provided by the AI engine.'}
                                  </div>
                                </div>

                                {/* On-Chain Proof Block */}
                                <div className="space-y-4 relative z-10">
                                  <div className={`flex items-center justify-between w-full text-[10px] font-bold tracking-widest uppercase ${tx.use_zk ? 'text-[#00FF00]' : 'text-[#888]'}`}>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-1 h-3 ${tx.use_zk ? 'bg-[#00FF00]' : 'bg-[#888]'}`} /> 
                                      {tx.use_zk ? 'ZK Cryptographic Proof' : 'Public Ledger Proof'}
                                    </div>
                                    {tx.use_zk && (
                                      <div className="flex items-center gap-3">
                                        <a href="/static/zk/proof.json" download="proof.json" className="text-[#00FF00] hover:text-white transition-colors underline decoration-[#00FF00]/30 underline-offset-4">proof.json</a>
                                        <a href="/static/zk/public.json" download="publicSignals.json" className="text-[#00FF00] hover:text-white transition-colors underline decoration-[#00FF00]/30 underline-offset-4">publicSignals.json</a>
                                        <a href="/static/zk/vkey.json" download="vkey.json" className="text-[#00FF00] hover:text-white transition-colors underline decoration-[#00FF00]/30 underline-offset-4">vkey.json</a>
                                      </div>
                                    )}
                                  </div>
                                  <div className={`p-4 bg-black rounded-lg border space-y-3 shadow-inner ${tx.use_zk ? 'border-[#00FF00]/20' : 'border-[#333]'}`}>
                                    <div className="flex flex-col">
                                      <span className="text-[9px] text-[#555] font-mono uppercase tracking-widest mb-1">Authorization Hash</span>
                                      <span className={`text-xs font-mono break-all ${tx.use_zk ? 'text-[#00FF00]' : 'text-white'}`}>{tx.authorization_hash || 'N/A'}</span>
                                    </div>
                                    <div className="flex flex-col pt-3 border-t border-[#222]">
                                      <span className="text-[9px] text-[#555] font-mono uppercase tracking-widest mb-1">Architecture</span>
                                      <span className="text-[11px] text-[#ccc] font-mono">
                                        {tx.use_zk 
                                          ? 'W3C Verifiable Credential // Groth16 (bn128)' 
                                          : `Native ${tx.network ? tx.network.toUpperCase() : 'XRPL'} Transaction`}
                                      </span>
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
