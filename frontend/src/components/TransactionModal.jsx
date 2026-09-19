import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const CHAIN_META = {
  xrpl: { name: 'XRPL Testnet', explorer: (hash) => `https://testnet.xrpl.org/transactions/${hash}` },
  ethereum: { name: 'Sepolia', explorer: (hash) => `https://sepolia.etherscan.io/tx/${hash}` },
  solana: { name: 'Solana Devnet', explorer: (hash) => `https://explorer.solana.com/tx/${hash}?cluster=devnet` },
  base: { name: 'Base Sepolia', explorer: (hash) => `https://sepolia.basescan.org/tx/${hash}` },
  polygon: { name: 'Polygon Amoy', explorer: (hash) => `https://amoy.polygonscan.com/tx/${hash}` },
  arbitrum: { name: 'Arbitrum Sepolia', explorer: (hash) => `https://sepolia.arbiscan.io/tx/${hash}` },
  aptos: { name: 'Aptos Devnet', explorer: (hash) => `https://explorer.aptoslabs.com/txn/${hash}?network=devnet` },
}

export default function TransactionModal({ transaction, onClose }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  if (!transaction) return null

  const isApprove = transaction.status?.toUpperCase() === 'APPROVE'
  const networkKey = transaction.network?.toLowerCase() || 'xrpl'
  const meta = CHAIN_META[networkKey] || CHAIN_META.xrpl
  const explorerUrl =
    transaction.authorization_hash && !transaction.authorization_hash.startsWith('SIM_')
      ? meta.explorer(transaction.authorization_hash)
      : null

  const handleCopy = () => {
    if (transaction.authorization_hash) {
      navigator.clipboard.writeText(transaction.authorization_hash)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg bg-white border border-neutral-200 p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Transaction</h3>
          <button type="button" className="btn" onClick={onClose}>Close</button>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div>
            <dt className="field-label">Status</dt>
            <dd className={isApprove ? 'status-approve' : 'status-reject'}>{transaction.status}</dd>
          </div>
          <div>
            <dt className="field-label">Amount</dt>
            <dd className="font-mono">
              {Number(transaction.amount || transaction._amount).toLocaleString()}{' '}
              {transaction.stablecoin_type || transaction._asset || 'USDC'}
            </dd>
          </div>
        </dl>
        <div className="field-label">Reason</div>
        <p className="text-sm text-neutral-800 mb-4 whitespace-pre-wrap">{transaction.reason}</p>
        {transaction.authorization_hash && (
          <div>
            <div className="field-label">Hash</div>
            <div className="flex gap-2">
              <div className="flex-1 font-mono text-xs break-all border border-neutral-200 p-2 bg-neutral-50">
                {transaction.authorization_hash}
              </div>
              <button type="button" className="btn shrink-0" onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            {explorerUrl && (
              <a className="inline-block mt-3 text-sm" href={explorerUrl} target="_blank" rel="noopener noreferrer">
                View on {meta.name}
              </a>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
