// JsonInspector.jsx
// Side-by-side raw JSON inspector panel: request on the left, response on the right.

import { useEffect, useRef } from 'react'

/* Syntax-highlight a JSON string with spans */
function highlight(json) {
  if (!json) return ''
  return json
    .replace(/(\"(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*\"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'text-[#a5b4fc]'         // number default (purple)
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-[#7dd3fc]'         // key (sky blue)
        } else {
          cls = 'text-[#86efac]'         // string value (green)
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-[#fbbf24]'           // boolean (amber)
      } else if (/null/.test(match)) {
        cls = 'text-[#f87171]'           // null (red)
      }
      return `<span class="${cls}">${match}</span>`
    })
}

function CodeBlock({ label, icon, data, accentColor, visible }) {
  const formatted = data ? JSON.stringify(data, null, 2) : null

  return (
    <div
      className="flex-1 min-w-0 flex flex-col rounded-xl border overflow-hidden transition-all duration-500"
      style={{
        borderColor: accentColor + '25',
        background: 'rgba(0,0,0,0.35)',
        opacity: visible ? 1 : 0.35,
      }}
    >
      {/* Block header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b"
        style={{ borderColor: accentColor + '20', background: accentColor + '08' }}
      >
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accentColor }}>
          {label}
        </span>
        {data && (
          <span className="ml-auto text-[9px] font-mono text-slate-700">
            {JSON.stringify(data).length}B
          </span>
        )}
      </div>

      {/* Code body */}
      <div className="flex-1 overflow-auto p-4">
        {formatted ? (
          <pre
            className="text-[11.5px] font-mono leading-relaxed text-slate-400 whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: highlight(formatted) }}
          />
        ) : (
          <div className="flex items-center justify-center h-full min-h-[60px]">
            <span className="text-[11px] font-mono text-slate-700 italic">— awaiting data —</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* Default payloads shown before first submission */
const DEFAULT_REQUEST = {
  origin:           'SG',
  destination:      'EU',
  institution_type: 'MPI',
  activity:         'transfer',
  asset:            'USDC',
  amount:           500000,
  evidence: {
    kyc:       true,
    ownership: true,
    sanctions: true,
  },
}

const DEFAULT_RESPONSE = {
  decision:     'approved',
  risk:         'low',
  policy_packs: ['MAS Pack v0.9.2', 'MiCA Pack v1.0.1'],
  rules_triggered: ['MAS-PSN02', 'MiCA-14', 'EU-TFR'],
  obligations:  ['Travel Rule Required', 'Record Retention'],
}

export default function JsonInspector({ request, response, latency, isLoading }) {
  const hasData = request || response

  // Use default payloads when no real data yet
  const displayRequest  = request  ?? DEFAULT_REQUEST
  const displayResponse = response ?? DEFAULT_RESPONSE

  return (
    <div
      className="rounded-2xl border border-white/5 overflow-hidden transition-all duration-500"
      style={{ background: 'rgba(5,8,15,0.7)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: isLoading ? '#fbbf24' : hasData ? '#34d399' : '#374151',
              boxShadow: isLoading ? '0 0 6px rgba(251,191,36,0.6)' : hasData ? '0 0 6px rgba(52,211,153,0.5)' : 'none',
              animation: isLoading ? 'pulse 1s infinite' : 'none',
            }}
          />
          <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500">
            API Inspector
          </span>
        </div>
        <div className="flex items-center gap-3">
          {latency && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/4 border border-white/6 text-slate-500">
              ⚡ {latency}
            </span>
          )}
          <span className="text-[10px] font-mono text-slate-700">
            POST /v1/policy/evaluate
          </span>
        </div>
      </div>

      {/* Two code blocks */}
      <div className="flex gap-3 p-4 min-h-[180px]">
        <CodeBlock
          label="Request Payload"
          icon="→"
          data={displayRequest}
          accentColor="#818cf8"
          visible={true}
        />
        <CodeBlock
          label="Response Body"
          icon="←"
          data={displayResponse}
          accentColor={
            response?.status === 'APPROVE' ? '#34d399' :
            response?.status === 'REJECT'  ? '#fb7185' :
            response?.error ? '#fb7185' : '#34d399'
          }
          visible={true}
        />
      </div>
    </div>
  )
}
