
'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { cn } from '../lib/utils';

interface FlipCardProps {
  /** The value to display inside the card (e.g. Actor Name) */
  content: string;
  /** Role label for accessibility and context */
  label?: string;
  /** Wordle-style status plus directional year hints */
  status?: 'correct' | 'present' | 'absent' | 'empty' | 'higher' | 'lower';
  /** Animation stagger delay */
  delay?: number;
  /** Optional profile image path from TMDB */
  imageUrl?: string;
  /** Optional sub-indicator like ↑ / ↓ for year hints */
  indicator?: string;
  /** Slightly denser layout once multiple rows are on screen */
  compact?: boolean;
}

/**
 * FlipCard Component:
 * - Implements a 3D flip animation using Framer Motion.
 * - Displays different colors based on the validation status.
 * - Shows a portrait of the person (if available) as a subtle background.
 */
export default function FlipCard({ content, label, status = 'empty', delay = 0, imageUrl, indicator, compact = false }: FlipCardProps) {
  const isRevealed = status !== 'empty';

  return (
    <div className={cn("relative w-full group perspective-1000", compact ? "aspect-square sm:aspect-[1.05]" : "aspect-[0.9] sm:aspect-square")}>
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
          <div className={cn("absolute inset-0 backface-hidden bg-cinema-light border-2 border-white/10 rounded-lg flex flex-col items-center justify-center", compact ? "p-1.5" : "p-2")}>
            {label && <span className={cn("text-white/50 uppercase", compact ? "mb-1 text-[9px]" : "mb-2 text-[10px] sm:text-xs")}>{label}</span>}
            <div className={cn("rounded-full border border-white/20 animate-pulse", compact ? "h-6 w-6" : "h-7 w-7 sm:h-8 sm:w-8")} />
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
            status === 'present' || status === 'higher' || status === 'lower' ? "bg-wordle-yellow border-wordle-yellow shadow-yellow-900/50" :
            "bg-wordle-gray border-wordle-gray shadow-gray-900/50",
          )}
          style={{ transform: "rotateY(180deg)" }}
        >
           {/* Face Portrait: Mixed with the status color for a premium look */}
           {imageUrl ? (
             <Image
                src={`https://image.tmdb.org/t/p/w200${imageUrl}`}
                alt={content}
                fill
                sizes="(max-width: 640px) 20vw, 120px"
                className="absolute inset-0 object-cover opacity-40 mix-blend-overlay"
             />
           ) : null}
           
           <div className="relative z-10 flex flex-col items-center">
                {label && <span className={cn("text-white/70 uppercase font-bold tracking-tighter", compact ? "mb-0.5 text-[8px]" : "mb-1 text-[9px] sm:text-[10px]")}>{label}</span>}
                <span className={cn("font-bold text-white leading-tight line-clamp-2 drop-shadow-md", compact ? "text-[10px] sm:text-xs" : "text-[11px] sm:text-sm")}>
                    {content}
                </span>
                {indicator ? (
                  <span className={cn("font-black text-white drop-shadow-md", compact ? "mt-0.5 text-base sm:text-lg" : "mt-1 text-lg")}>{indicator}</span>
                ) : null}
           </div>
        </div>
      </motion.div>
    </div>
  );
}
