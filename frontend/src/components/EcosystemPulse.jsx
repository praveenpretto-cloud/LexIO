import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CHAINS = ['XRPL', 'Stellar', 'Ethereum', 'Base', 'Polygon', 'Arbitrum', 'Solana', 'Aptos'];
const ACTIONS = ['Anchored', 'Escrow Created', 'VC Minted', 'Cleared'];

export default function EcosystemPulse() {
  const [pulses, setPulses] = useState([]);

  useEffect(() => {
    // Generate a new pulse every 2-5 seconds
    const interval = setInterval(() => {
      const newPulse = {
        id: Date.now(),
        chain: CHAINS[Math.floor(Math.random() * CHAINS.length)],
        action: ACTIONS[Math.floor(Math.random() * ACTIONS.length)],
        amount: Math.floor(Math.random() * 90000) + 1000,
        x: Math.floor(Math.random() * 80) + 10, // random x percentage
        y: Math.floor(Math.random() * 80) + 10, // random y percentage
      };

      setPulses(prev => [...prev.slice(-15), newPulse]); // keep max 15 on screen
      
      // Auto-remove after 6 seconds
      setTimeout(() => {
        setPulses(prev => prev.filter(p => p.id !== newPulse.id));
      }, 6000);

    }, Math.random() * 3000 + 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
      <AnimatePresence>
        {pulses.map(pulse => (
          <motion.div
            key={pulse.id}
            initial={{ opacity: 0, scale: 0.5, y: pulse.y + 20 }}
            animate={{ opacity: 1, scale: 1, y: pulse.y }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
            transition={{ duration: 3, ease: 'easeOut' }}
            className="absolute flex flex-col items-center gap-1"
            style={{ left: `${pulse.x}%`, top: `${pulse.y}%` }}
          >
            <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,1)] animate-pulse" />
            <div className="glass-panel-glow px-2 py-1 rounded-md text-[9px] font-mono whitespace-nowrap text-indigo-200 opacity-60">
              [{pulse.chain}] ${pulse.amount.toLocaleString()} {pulse.action}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
