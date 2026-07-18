// SessionHistory.jsx — compact strip of the last 10 checks this session
export default function SessionHistory({ history }) {
  if (!history.length) return null

  return (
    <div
      className="bg-[#0d1220]/40 border border-white/5 rounded-2xl p-5 slide-up"
    >
      <div className="text-[10px] font-bold tracking-widest uppercase text-slate-600 mb-3">
        Recent Checks — this session
      </div>
      <div className="flex flex-wrap gap-2">
        {history.map((h, i) => {
          const isApprove = h.status === 'APPROVE'
          return (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-mono"
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
              <span className="text-slate-400">{Number(h._amount).toLocaleString()}</span>
              <span className="text-slate-700">·</span>
              <span className="text-slate-500">{h._wallet}</span>
              <span className="text-slate-700">·</span>
              <span className="text-slate-700">{h.ts}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
