'use client';

import { motion } from 'framer-motion';

interface HintPosterProps {
  /** TMDB poster_path (e.g. '/abc123.jpg') */
  posterPath: string | null | undefined;
  /** Number of wrong guesses so far */
  wrongGuesses: number;
}

/**
 * HintPoster — Progressive Blur Reveal
 *
 * Shows a teaser of the daily movie's poster that becomes progressively
 * clearer as the player uses more guesses. This adds pressure and excitement
 * without giving away the answer too easily.
 *
 * Blur progression (CSS pixels):
 *  - 0 wrong guesses: hidden (not shown)
 *  - 2 wrong guesses: blur(20px) + very dark
 *  - 3 wrong guesses: blur(14px)
 *  - 4 wrong guesses: blur(8px)
 *  - 5 wrong guesses: blur(2px) — almost clear at game end
 */
export default function HintPoster({ posterPath, wrongGuesses }: HintPosterProps) {
  // Only appear after 2 wrong guesses
  if (wrongGuesses < 2 || !posterPath) return null;

  // Map wrong guess count to blur level — significantly reduced for better helpfulness
  const blurMap: Record<number, number> = {
    2: 8,
    3: 5,
    4: 2,
    5: 0,
  };
  const blurPx = blurMap[Math.min(wrongGuesses, 5)] ?? 2;
  const brightness = 0.5 + (wrongGuesses - 2) * 0.15; // increased for better visibility

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center gap-1 my-4"
    >
      <span className="text-[10px] uppercase text-gray-500 font-bold tracking-widest animate-pulse">
        🎯 Hint Unlocked — {blurPx > 10 ? 'Barely there...' : blurPx > 5 ? 'Getting warmer...' : 'Almost!'}
      </span>
      <div className="relative w-20 h-28 overflow-hidden rounded-lg border border-gold/20 shadow-xl shadow-gold/5">
        <img
          src={`https://image.tmdb.org/t/p/w300${posterPath}`}
          alt="Hint"
          className="w-full h-full object-cover transition-all duration-700"
          style={{
            filter: `blur(${blurPx}px) brightness(${brightness})`,
          }}
        />
        {/* Overlay glow ring */}
        <div className="absolute inset-0 rounded-lg ring-1 ring-gold/20" />
      </div>
    </motion.div>
  );
}
