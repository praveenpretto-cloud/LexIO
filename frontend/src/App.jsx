import { useState } from 'react'
import Header from './components/Header'
import ComplianceForm from './components/ComplianceForm'
import ResultPanel from './components/ResultPanel'
import SessionHistory from './components/SessionHistory'
import AgentPaymentDemo from './components/AgentPaymentDemo'
import B2BDashboard from './components/B2BDashboard'

const TABS = [
  { key: 'policy', label: 'Check' },
  { key: 'agent', label: 'Transfer' },
  { key: 'dashboard', label: 'Log' },
]

export default function App() {
  const [result, setResult] = useState(null)
  const [flashKey, setFlashKey] = useState(0)
  const [checkCount, setCheckCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('policy')

  const handleResult = (data) => {
    if (!data) return
    setResult(data)
    setFlashKey((k) => k + 1)
    setCheckCount((c) => c + 1)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        checkCount={checkCount}
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 flex flex-col gap-6">
        {activeTab === 'dashboard' && <B2BDashboard />}

        {activeTab === 'agent' && (
          <>
            <div>
              <h1 className="text-lg font-semibold">Transfer</h1>
              <p className="text-sm text-neutral-500 mt-1">
                Rule engine, optional Groth16 proof, testnet submit.
              </p>
            </div>
            <AgentPaymentDemo />
          </>
        )}

        {activeTab === 'policy' && (
          <>
            <div>
              <h1 className="text-lg font-semibold">Policy check</h1>
              <p className="text-sm text-neutral-500 mt-1">
                MAS PSN02, MiCA/TFR, and GENIUS Act gates. Screening lists are fixtures.
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ComplianceForm onResult={handleResult} onLoadingChange={setIsLoading} />
              <div className="panel min-h-[280px]">
                <ResultPanel result={result} flashKey={flashKey} isLoading={isLoading} />
              </div>
            </div>
            <SessionHistory />
            <p className="text-xs text-neutral-400">
              LexIO 0.1.0 ·{' '}
              <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noopener noreferrer">
                API docs
              </a>
            </p>
          </>
        )}
      </main>
    </div>
  )
}
