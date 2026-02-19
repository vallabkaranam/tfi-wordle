
'use client';

import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

interface FlipCardProps {
  /** The value to display inside the card (e.g. Actor Name) */
  content: string;
  /** Role label for accessibility and context */
  label?: string;
  /** Wordle-style status: 'correct' (green), 'present' (yellow), 'absent' (gray) */
  status?: 'correct' | 'present' | 'absent' | 'empty';
  /** Animation stagger delay */
  delay?: number;
  /** Optional profile image path from TMDB */
  imageUrl?: string;
}

/**
 * FlipCard Component:
 * - Implements a 3D flip animation using Framer Motion.
 * - Displays different colors based on the validation status.
 * - Shows a portrait of the person (if available) as a subtle background.
 */
export default function FlipCard({ content, label, status = 'empty', delay = 0, imageUrl }: FlipCardProps) {
  const isRevealed = status !== 'empty';

  return (
    <div className="relative w-full aspect-[3/4] group perspective-1000">
      <motion.div
        className="w-full h-full relative preserve-3d"
        initial={false}
        animate={{ rotateY: isRevealed ? 180 : 0 }}
        transition={{ duration: 0.6, delay: delay, ease: "easeOut" }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* 
            Front Face:
            Shown before the guess is submitted. 
        */}
        {!isRevealed && (
          <div className="absolute inset-0 backface-hidden bg-cinema-light border-2 border-white/10 rounded-lg flex flex-col items-center justify-center p-2">
            {label && <span className="text-xs text-white/50 uppercase mb-2">{label}</span>}
            <div className="w-8 h-8 rounded-full border border-white/20 animate-pulse" />
          </div>
        )}

        {/* 
            Back Face (Revealed):
            Color coded based on success.
        */}
        <div 
          className={cn(
            "absolute inset-0 backface-hidden rounded-lg flex flex-col items-center justify-center p-2 text-center border-2 overflow-hidden shadow-inner",
            status === 'correct' ? "bg-wordle-green border-wordle-green shadow-green-900/50" :
            status === 'present' ? "bg-wordle-yellow border-wordle-yellow shadow-yellow-900/50" :
            "bg-wordle-gray border-wordle-gray shadow-gray-900/50",
          )}
          style={{ transform: "rotateY(180deg)" }}
        >
           {/* Face Portrait: Mixed with the status color for a premium look */}
           {imageUrl ? (
             <img 
                src={`https://image.tmdb.org/t/p/w200${imageUrl}`} 
                alt={content} 
                className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay" 
             />
           ) : null}
           
           <div className="relative z-10 flex flex-col items-center">
                {label && <span className="text-[10px] text-white/70 uppercase mb-1 font-bold tracking-tighter">{label}</span>}
                <span className="text-xs sm:text-sm font-bold text-white leading-tight line-clamp-2 drop-shadow-md">
                    {content}
                </span>
           </div>
        </div>
      </motion.div>
    </div>
  );
}
