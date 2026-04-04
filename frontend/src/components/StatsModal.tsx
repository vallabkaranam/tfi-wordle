'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy } from 'lucide-react';
import { GameStats, winRate } from '../lib/stats';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: GameStats;
}

/**
 * StatsModal — Player Performance Dashboard
 *
 * Displays four headline numbers:
 *  - Games Played
 *  - Win % 
 *  - Current Streak
 *  - Max Streak
 *
 * Also renders a horizontal bar chart of guess distribution (how often
 * the player won in 1-6 guesses) to encourage improvement.
 */
export default function StatsModal({ isOpen, onClose, stats }: StatsModalProps) {
  const wr = winRate(stats);

  // Max value in distribution for proportional bar-width scaling
  const maxDist = Math.max(...Object.values(stats.guessDistribution), 1);

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
            className="bg-cinema-light border border-white/10 rounded-2xl p-8 max-w-sm w-full shadow-2xl relative"
            onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-gold" />
                <h2 className="text-xl font-bold text-white tracking-wide uppercase">Statistics</h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-white transition-colors"
                aria-label="Close stats"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Headline Numbers */}
            <div className="grid grid-cols-4 gap-3 mb-8">
              {[
                { label: 'Played', value: stats.gamesPlayed },
                { label: 'Win %', value: wr },
                { label: 'Streak', value: stats.currentStreak },
                { label: 'Best', value: stats.maxStreak },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col items-center bg-black/20 rounded-xl p-3">
                  <span className="text-2xl sm:text-3xl font-bold text-gold">{value}</span>
                  <span className="text-[10px] text-gray-400 uppercase mt-1 text-center leading-tight">{label}</span>
                </div>
              ))}
            </div>

            {/* Guess Distribution Bar Chart */}
            <div>
              <h3 className="text-xs uppercase text-gray-500 font-bold tracking-widest mb-3">
                Guess Distribution
              </h3>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6].map((n) => {
                  const count = stats.guessDistribution[n] ?? 0;
                  const pct = Math.max((count / maxDist) * 100, count > 0 ? 8 : 4);
                  return (
                    <div key={n} className="flex items-center gap-2 text-xs text-white">
                      <span className="w-3 shrink-0 text-gray-400">{n}</span>
                      <div className="flex-1 h-6 bg-black/30 rounded overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: n * 0.1 }}
                          className="h-full bg-wordle-green flex items-center justify-end pr-2 rounded"
                        >
                          <span className="font-bold text-white text-[10px]">{count}</span>
                        </motion.div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer note */}
            <p className="text-[10px] text-gray-600 text-center mt-6">Stats are stored locally in your browser.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
