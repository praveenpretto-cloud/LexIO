import { useState } from 'react'
import { motion } from 'framer-motion'
import Header           from './components/Header'
import ComplianceForm   from './components/ComplianceForm'
import ResultPanel      from './components/ResultPanel'
import SessionHistory   from './components/SessionHistory'
import AgentPaymentDemo from './components/AgentPaymentDemo'
import PolicyStudio     from './components/PolicyStudio'
import EcosystemPulse   from './components/EcosystemPulse'
import B2BDashboard     from './components/B2BDashboard'

export default function App() {
  const [result,       setResult]       = useState(null)
  const [flashKey,     setFlashKey]     = useState(0)
  const [checkCount,   setCheckCount]   = useState(0)
  const [isLoading,    setIsLoading]    = useState(false)
  const [lastRequest,  setLastRequest]  = useState(null)
  const [lastResponse, setLastResponse] = useState(null)
  const [latency,      setLatency]      = useState(null)
  const [activeTab,    setActiveTab]    = useState('policy')

  /**
   * Called by ComplianceForm on every API round-trip.
   * data          — full response object (or null on error)
   * requestPayload — the raw payload sent
   * latencyStr    — human-readable latency string from X-Process-Time or client-side perf
   */
  const handleResult = (data, requestPayload, latencyStr) => {
    setLastRequest(requestPayload)
    setLatency(latencyStr)

    if (!data) {
      // error path — show in inspector but don't update result card
      setLastResponse(null)
      return
    }

    // Strip UI-only metadata and raw backend fields before showing in inspector
    // eslint-disable-next-line no-unused-vars
    const { _amount, _asset, status, reason, ...responseForInspector } = data

    setLastResponse(responseForInspector)
    setResult(data)
    setFlashKey(k => k + 1)
    setCheckCount(c => c + 1)
  }

  const isApprove = result?.status?.toUpperCase() === 'APPROVE'

  const TABS = [
    { key: 'policy', label: 'Policy Engine', icon: '⚖',  sublabel: 'MAS / MiCA / GENIUS' },
    { key: 'agent',  label: 'Agent Demo',    icon: '🤖', sublabel: 'SCDD / CDD / EDD' },
    { key: 'dashboard', label: 'B2B Dashboard', icon: '🏢', sublabel: 'Compliance Hub' },
    { key: 'studio', label: 'Policy Studio', icon: '🛠️', sublabel: 'No-Code Builder' },
  ]

  return (
    <div className="relative min-h-screen flex flex-col">
      <div className="bg-glow-mesh" />
      <Header checkCount={checkCount} />

      {/* ── Floating Dock Tab Bar ── */}
      <div className="relative z-20 flex justify-center mt-6 mb-2">
        <div className="bg-[#000] border border-[#222] rounded-full p-1.5 flex gap-1 items-center shadow-2xl">
          {TABS.map(tab => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                id={`tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 outline-none`}
                style={{
                  color: isActive ? '#fff' : '#64748b',
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-full bg-[#111] border border-[#333] shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <span className={isActive ? 'text-white' : 'text-[#666]'}>{tab.icon}</span>
                  <span className="tracking-wide">{tab.label}</span>
                </span>
                {isActive && tab.sublabel && (
                  <span className="relative z-10 hidden sm:block text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
                    {tab.sublabel}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Page content ── */}
      <div className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-6 py-8 flex flex-col gap-6">

        {activeTab === 'studio' ? (
          <PolicyStudio />
        ) : activeTab === 'dashboard' ? (
          <B2BDashboard />
        ) : activeTab === 'agent' ? (
          <>
            {/* Agent Demo page */}
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white">
                Agentic{' '}
                <span className="text-[#888]">Payment Flow</span>
              </h1>
              <p className="text-sm text-[#555] mt-1">
                End-to-end agent-to-agent payment pipeline: risk-tier compliance &rarr; W3C Verifiable Credential &rarr; XRPL on-chain anchor.
              </p>
            </div>
            <AgentPaymentDemo />
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-700 pb-2">
              <span>LexIO Agentic Compliance Engine v2.0</span>
              <a href="http://127.0.0.1:8000/docs#/Agentic%20Compliance" target="_blank" rel="noopener noreferrer" className="hover:text-slate-500 transition-colors">
                API Docs &rarr;
              </a>
            </div>
          </>
        ) : (
          <>
            {/* ── Policy Engine tab ── */}
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white">
                  Programmable{' '}
                  <span className="text-[#888]">Policy Engine</span>
                </h1>
                <p className="text-sm text-[#555] mt-1">
                  Evaluate regulated digital asset transactions using machine-executable policy rules derived from MAS, MiCA, and GENIUS Act frameworks.
                </p>
                <p className="text-[11px] font-mono text-[#444] mt-1.5 tracking-wide">
                  Powered by the{' '}
                  <span className="font-semibold text-[#888]">
                    LexIO Compliance Compiler
                  </span>
                </p>
              </div>
              <div className="hidden md:flex items-center gap-2">
                {['MAS Pack v0.9.2', 'MiCA Pack v1.0.1', 'GENIUS Act v1.0'].map(r => (
                  <span
                    key={r}
                    className="text-[11px] font-mono px-3 py-1.5 rounded-full border border-white/6 text-slate-500 bg-white/2"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Two-column main grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Left — form */}
              <ComplianceForm
                onResult={handleResult}
                onLoadingChange={setIsLoading}
              />

              {/* Right — result panel */}
              <div
                className="relative border rounded-2xl backdrop-blur-sm overflow-hidden transition-all duration-500"
                style={{
                  background:  result ? 'rgba(10,10,10,0.8)' : 'rgba(10,10,10,0.6)',
                  borderColor: isLoading
                    ? 'rgba(255,255,255,0.2)'
                    : result
                      ? isApprove ? 'rgba(0,255,0,0.30)' : 'rgba(255,0,0,0.30)'
                      : 'rgba(255,255,255,0.05)',
                  boxShadow: isLoading
                    ? '0 0 40px rgba(255,255,255,0.05)'
                    : result
                      ? isApprove ? '0 0 40px rgba(0,255,0,0.1)' : '0 0 40px rgba(255,0,0,0.1)'
                      : 'none',
                  transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
                }}
              >
                {/* Top accent line — animates color on state change */}
                <div
                  className="absolute top-0 left-0 right-0 h-0.5 transition-all duration-700"
                  style={{
                    background: isLoading
                      ? 'linear-gradient(90deg,#fff,#666,#fff)'
                      : result
                        ? isApprove
                          ? 'linear-gradient(90deg,#00FF00,#00CC00,#00FF00)'
                          : 'linear-gradient(90deg,#FF0000,#CC0000,#FF0000)'
                        : 'transparent',
                    opacity: (isLoading || result) ? 1 : 0,
                  }}
                />
                <ResultPanel
                  result={result}
                  flashKey={flashKey}
                  isLoading={isLoading}
                />
              </div>
            </div>

            {/* ── Session history (Auto-polling) ── */}
            <SessionHistory />

            {/* ── Footer ── */}
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-700 pb-2">
              <span>LexIO Agentic Compliance Engine v2.0 — React + Tailwind + FastAPI</span>
              <a
                href="http://127.0.0.1:8000/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-500 transition-colors"
              >
                API Docs &rarr;
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
