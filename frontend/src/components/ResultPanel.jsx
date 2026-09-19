function detectRule(reason) {
  if (!reason) return null
  if (reason.includes('MAS')) return 'MAS PSN02'
  if (reason.includes('TFR') || reason.includes('MiCA')) return 'MiCA / TFR'
  if (reason.includes('GENIUS')) return 'GENIUS Act'
  return 'Rule engine'
}

export default function ResultPanel({ result, isLoading }) {
  const isApprove = result?.status?.toUpperCase() === 'APPROVE'
  const rule = result ? detectRule(result.reason) : null

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-sm text-neutral-500">
        Running check…
      </div>
    )
  }

  if (!result) {
    return (
      <div className="h-full flex flex-col justify-center p-6 text-sm text-neutral-500">
        <div>No result yet.</div>
        <div className="text-xs mt-1">Submit a transfer. The decision comes from the API.</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className={`text-sm font-semibold ${isApprove ? 'status-approve' : 'status-reject'}`}>
          {isApprove ? 'Approve' : 'Block'}
        </div>
        {rule && <div className="text-xs text-neutral-500">{rule}</div>}
      </div>
      <p className="text-sm leading-relaxed text-neutral-800">{result.reason}</p>
      {isApprove && result.authorization_hash && (
        <div>
          <div className="field-label">Authorization hash</div>
          <div className="font-mono text-xs break-all text-neutral-600 border border-neutral-200 p-2 bg-neutral-50">
            {result.authorization_hash}
          </div>
        </div>
      )}
      <dl className="grid grid-cols-3 gap-3 text-xs text-neutral-500 pt-2 border-t border-neutral-200">
        <div>
          <dt>Amount</dt>
          <dd className="text-neutral-800 font-mono mt-0.5">
            {result._amount ? Number(result._amount).toLocaleString() : '—'}
          </dd>
        </div>
        <div>
          <dt>Asset</dt>
          <dd className="text-neutral-800 font-mono mt-0.5">{result._asset ?? '—'}</dd>
        </div>
        <div>
          <dt>Version</dt>
          <dd className="text-neutral-800 font-mono mt-0.5">0.1.0</dd>
        </div>
      </dl>
    </div>
  )
}
