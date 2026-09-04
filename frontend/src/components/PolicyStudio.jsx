import { useState } from 'react'

export default function PolicyStudio() {
  const [rules, setRules] = useState([
    { id: 1, condition: 'Amount > 10,000 USD', action: 'Require Enhanced Due Diligence (EDD)' },
    { id: 2, condition: 'Jurisdiction == "North Korea"', action: 'BLOCK (Sanctions)' },
    { id: 3, condition: 'Wallet Type == "Unhosted" AND Jurisdiction == "EU"', action: 'Require Cryptographic Proof (MiCA)' },
    { id: 4, condition: 'Jurisdiction == "US" AND Stablecoin != "USDC"', action: 'BLOCK (US GENIUS Act)' },
  ])

  const [newCondition, setNewCondition] = useState('')
  const [newAction, setNewAction] = useState('BLOCK')

  const addRule = (e) => {
    e.preventDefault()
    if (!newCondition) return
    setRules([...rules, { id: Date.now(), condition: newCondition, action: newAction }])
    setNewCondition('')
  }

  const deleteRule = (id) => {
    setRules(rules.filter(r => r.id !== id))
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Policy <span style={{ color: '#818cf8' }}>Studio</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visual no-code builder for Agentic Compliance rules. Define how autonomous agents transact globally.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <span className="text-[11px] font-mono px-3 py-1.5 rounded-full border border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
            LexIO Compiler Active
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Rule Builder Form */}
        <div className="lg:col-span-1 rounded-2xl p-6 border backdrop-blur-sm flex flex-col gap-5" style={{ background: 'rgba(13,18,32,0.6)', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)' }}>
              🛠️
            </div>
            <div>
              <div className="text-sm font-bold text-white">Create New Policy</div>
              <div className="text-[11px] text-slate-600">Draft rules to be compiled into the engine</div>
            </div>
          </div>
          
          <form onSubmit={addRule} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
                IF (Condition)
              </label>
              <input 
                type="text" 
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)}
                placeholder="e.g. Asset == 'USDT' AND Jurisdiction == 'US'"
                className="w-full bg-[#111827]/60 border border-white/8 rounded-xl px-4 py-3 text-white font-mono text-xs outline-none transition-all focus:border-[#6366f1]/60"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold tracking-widest uppercase text-slate-500">
                THEN (Action)
              </label>
              <select 
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
                className="w-full bg-[#111827]/60 border border-white/8 rounded-xl px-4 py-3 text-white font-mono text-xs outline-none focus:border-[#6366f1]/60"
              >
                <option value="APPROVE">Approve (SCDD)</option>
                <option value="WATCH">Require Human Review (EDD)</option>
                <option value="BLOCK">Block Transaction</option>
              </select>
            </div>
            
            <button type="submit" className="w-full py-3 rounded-xl font-black text-xs tracking-widest uppercase text-white bg-indigo-600 hover:bg-indigo-500 transition-colors mt-2">
              + Deploy Rule to Engine
            </button>
          </form>
        </div>
        
        {/* Right: Active Rule Set */}
        <div className="lg:col-span-2 rounded-2xl p-6 border backdrop-blur-sm" style={{ background: 'rgba(13,18,32,0.6)', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-5">
            Active Global Policies ({rules.length})
          </div>
          <div className="flex flex-col gap-3">
            {rules.map((rule, idx) => (
              <div key={rule.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5 gap-4">
                <div className="flex-1 font-mono text-xs">
                  <span className="text-slate-500">IF </span>
                  <span className="text-indigo-300">{rule.condition}</span>
                  <br className="md:hidden" />
                  <span className="text-slate-500"> THEN </span>
                  <span className="text-amber-400 font-bold">{rule.action}</span>
                </div>
                <button 
                  onClick={() => deleteRule(rule.id)}
                  className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  REVOKE
                </button>
              </div>
            ))}
            {rules.length === 0 && (
              <div className="text-center py-10 text-slate-600 text-sm font-mono italic">
                No active policies. System will approve all agent transactions.
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  )
}
