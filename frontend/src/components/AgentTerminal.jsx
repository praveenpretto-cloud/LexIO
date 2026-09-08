import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal } from 'lucide-react';

export default function AgentTerminal({ logs = [], isThinking = false }) {
  return (
    <div className="glass-panel rounded-2xl border overflow-hidden flex flex-col w-full mt-4">
      <div className="px-4 py-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-slate-400 uppercase font-bold">
          <Terminal size={14} className="text-indigo-400" />
          Live Agent Swarm Terminal
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isThinking ? 'bg-indigo-400 animate-pulse' : 'bg-emerald-400'}`} />
          <span className="text-[9px] font-mono uppercase text-slate-500 font-bold tracking-widest">
            {isThinking ? 'Processing' : 'Idle'}
          </span>
        </div>
      </div>
      <div className="p-5 bg-black/50 min-h-[180px] max-h-[220px] overflow-y-auto font-mono text-[11px] flex flex-col gap-2">
        <AnimatePresence>
          {logs.map((log, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-start gap-3 leading-relaxed"
            >
              <span className="text-slate-600 select-none flex-shrink-0">
                {new Date(log.timestamp).toISOString().split('T')[1].slice(0, 12)}
              </span>
              <span className="flex-1 break-words">
                <span className="font-bold" style={{ color: getAgentColor(log.agent) }}>
                  [{log.agent}]
                </span>{' '}
                <span className="text-slate-300">{log.message}</span>
              </span>
            </motion.div>
          ))}
          {isThinking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 mt-2 text-indigo-400 ml-[85px]"
            >
              <span className="w-1.5 h-1.5 bg-indigo-400/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-indigo-400/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-indigo-400/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function getAgentColor(agentName) {
  switch (agentName?.toLowerCase()) {
    case 'risk agent':
      return '#fb7185';
    case 'kyc agent':
      return '#38bdf8';
    case 'execution agent':
      return '#34d399';
    case 'swarm':
      return '#a5b4fc';
    default:
      return '#94a3b8';
  }
}
