import { useEffect, useState } from 'react'

export default function TransactionModal({ transaction, onClose }) {
  const [copied, setCopied] = useState(false)

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  if (!transaction) return null

  const isApprove = transaction.status?.toUpperCase() === 'APPROVE'

  const explorerUrl = transaction.authorization_hash
    ? transaction.network === 'XRPL'
      ? `https://testnet.xrpl.org/transactions/${transaction.authorization_hash}`
      : `https://stellar.expert/explorer/testnet/tx/${transaction.authorization_hash}`
    : null

  const handleCopy = () => {
    if (transaction.authorization_hash) {
      navigator.clipboard.writeText(transaction.authorization_hash)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm slide-up">
      <div 
        className="w-full max-w-2xl bg-[#0d1220] border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          borderColor: isApprove ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'
        }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-white tracking-wide">Transaction Details</h3>
            {transaction.network && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-widest uppercase"
                style={{
                  background: transaction.network === 'XRPL' ? 'rgba(251,191,36,0.1)' : 'rgba(99,102,241,0.1)',
                  borderColor: transaction.network === 'XRPL' ? 'rgba(251,191,36,0.3)' : 'rgba(99,102,241,0.3)',
                  color: transaction.network === 'XRPL' ? '#fbbf24' : '#a5b4fc',
                }}
              >
                {transaction.network === 'XRPL' ? '◈ XRPL' : '✦ Stellar'}
              </span>
            )}
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 text-sm font-mono">
            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
              <div className="text-[10px] uppercase text-slate-500 mb-1">Status</div>
              <div style={{ color: isApprove ? '#34d399' : '#fb7185' }} className="font-bold">
                {transaction.status}
              </div>
            </div>
            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
              <div className="text-[10px] uppercase text-slate-500 mb-1">Amount</div>
              <div className="text-white">
                {Number(transaction.amount || transaction._amount).toLocaleString()} {transaction.stablecoin_type || transaction._asset || 'USDC'}
              </div>
            </div>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <div className="text-[10px] uppercase text-slate-500 mb-2">Reason</div>
            <div className="text-sm text-slate-300 font-mono leading-relaxed">
              {transaction.reason}
            </div>
          </div>

          {transaction.authorization_hash && (
            <div className="flex flex-col gap-2">
              <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">
                Clearance Signature / Txn Hash
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-black/40 border border-white/10 p-3 rounded-xl font-mono text-[11px] text-emerald-400/80 break-all select-all">
                  {transaction.authorization_hash}
                </div>
                <button
                  onClick={handleCopy}
                  className="px-4 py-3 rounded-xl font-bold text-xs tracking-wider border transition-all"
                  style={{
                    background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                    borderColor: copied ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)',
                    color: copied ? '#34d399' : '#94a3b8'
                  }}
                >
                  {copied ? 'COPIED!' : 'COPY'}
                </button>
              </div>
              <div className="text-[10px] text-slate-500 italic mt-1">
                (Note: Hash updates within 5 seconds once the network confirms the block).
              </div>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[11px] font-mono font-bold px-4 py-2 rounded-xl border transition-all hover:scale-[1.02]"
                  style={{
                    background: 'rgba(99,102,241,0.08)',
                    borderColor: 'rgba(99,102,241,0.25)',
                    color: '#818cf8',
                  }}
                >
                  <span>↗</span>
                  View on {transaction.network === 'XRPL' ? 'XRPL Testnet Explorer' : 'Stellar Expert Testnet'}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
