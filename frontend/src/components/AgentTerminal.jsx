export default function AgentTerminal({ logs = [], isThinking = false }) {
  return (
    <div className="panel mt-4 p-0 overflow-hidden">
      <div className="px-4 py-2 border-b border-neutral-200 flex justify-between text-xs text-neutral-500">
        <span>Log</span>
        <span>{isThinking ? 'Running' : 'Idle'}</span>
      </div>
      <div className="p-4 min-h-[120px] max-h-[200px] overflow-y-auto font-mono text-xs flex flex-col gap-1.5">
        {logs.map((log, i) => (
          <div key={i} className="text-neutral-700">
            <span className="text-neutral-400 mr-2">
              {new Date(log.timestamp).toISOString().split('T')[1].slice(0, 8)}
            </span>
            {log.message}
          </div>
        ))}
        {logs.length === 0 && !isThinking && (
          <div className="text-neutral-400">No log lines yet.</div>
        )}
      </div>
    </div>
  )
}
