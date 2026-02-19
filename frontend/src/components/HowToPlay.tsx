'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, HelpCircle } from 'lucide-react';

interface HowToPlayProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * HowToPlay Modal — Game Instructions
 *
 * Explains the five-column Wordle mechanic:
 *  - Pick a movie from the search bar
 *  - Five fields (Hero, Heroine, Director, Music, Producer) reveal ✅ or ❌
 *  - Match all 5 to win in ≤ 5 guesses
 *
 * Includes a worked visual example so new players understand instantly.
 */
export default function HowToPlay({ isOpen, onClose }: HowToPlayProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-cinema-light border border-white/10 rounded-2xl p-7 max-w-md w-full shadow-2xl overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-gold" />
                <h2 className="text-xl font-bold text-white uppercase tracking-wide">How to Play</h2>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Rules */}
            <div className="space-y-3 mb-6">
              <p className="text-gray-300 text-sm leading-relaxed">
                Guess the <span className="text-gold font-bold">secret Telugu movie</span> in 5 tries or fewer!
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300 pl-1">
                <li>Search for any Telugu movie in the input.</li>
                <li>Each guess reveals how five key roles compare to the target.</li>
                <li>
                  <span className="inline-block w-4 h-4 bg-wordle-green rounded-sm mr-1 align-middle" /> 
                  <strong className="text-white">Green</strong> = exact match for that role.
                </li>
                <li>
                  <span className="inline-block w-4 h-4 bg-wordle-gray rounded-sm mr-1 align-middle" />
                  <strong className="text-white">Gray</strong> = wrong person for that role.
                </li>
                <li>Match all five roles to win 🍿</li>
              </ol>
              <p className="text-xs text-gray-500 mt-2">A new puzzle drops every day at midnight.</p>
            </div>

            {/* Divider */}
            <div className="border-t border-white/10 mb-5" />

            {/* Visual example */}
            <h3 className="text-xs uppercase text-gray-500 font-bold tracking-widest mb-3">Example Guess</h3>
            <p className="text-xs text-gray-400 mb-3">
              If you guessed <span className="text-gold font-semibold">Baahubali: The Beginning</span>:
            </p>

            <div className="grid grid-cols-5 gap-1 text-center text-[9px] uppercase text-gray-400 mb-1 font-bold tracking-wider">
              <div>Hero</div><div>Heroine</div><div>Director</div><div>Music</div><div>Producer</div>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {/* Green: Prabhas matched */}
              <ExampleCell color="green" name="Prabhas" label="✓ Match" />
              {/* Gray: Anushka wrong */}
              <ExampleCell color="gray" name="Anushka" label="✗ Wrong" />
              {/* Gray: Rajamouli wrong */}
              <ExampleCell color="gray" name="Rajamouli" label="✗ Wrong" />
              {/* Green: M.M. Keeravani matched */}
              <ExampleCell color="green" name="M.M. Keeravani" label="✓ Match" />
              {/* Gray: producer wrong */}
              <ExampleCell color="gray" name="Shobu" label="✗ Wrong" />
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center">
              Hero & Music matched — only 3 more roles to crack!
            </p>

            {/* Close CTA */}
            <button
              onClick={onClose}
              className="w-full mt-6 py-3 bg-gold text-black font-bold rounded-xl hover:bg-yellow-400 transition-colors text-sm"
            >
              Let&apos;s Play! 🎬
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Micro-component for the example rows in the instructions */
function ExampleCell({ color, name, label }: { color: 'green' | 'gray'; name: string; label: string }) {
  return (
    <div
      className={`rounded-lg p-2 text-center flex flex-col items-center justify-center min-h-[60px] ${
        color === 'green' ? 'bg-wordle-green' : 'bg-wordle-gray'
      }`}
    >
      <span className="text-white font-bold text-[10px] leading-tight line-clamp-2">{name}</span>
      <span className="text-white/60 text-[8px] mt-1">{label}</span>
    </div>
  );
}
