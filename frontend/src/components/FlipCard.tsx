
'use client';

import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

interface FlipCardProps {
  content: string;
  label?: string; // e.g. "Hero"
  status?: 'correct' | 'present' | 'absent' | 'empty';
  delay?: number;
  imageUrl?: string;
}

export default function FlipCard({ content, label, status = 'empty', delay = 0, imageUrl }: FlipCardProps) {
  const isRevealed = status !== 'empty';

  return (
    <div className="relative w-full aspect-[3/4] group perspective-1000">
      <motion.div
        className="w-full h-full relative preserve-3d"
        initial={false}
        animate={{ rotateY: isRevealed ? 180 : 0 }}
        transition={{ duration: 0.6, delay: delay }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front (Empty/Hidden) */}
        {!isRevealed && (
          <div className="absolute inset-0 backface-hidden bg-cinema-light border-2 border-white/10 rounded-lg flex flex-col items-center justify-center p-2">
            {label && <span className="text-xs text-white/50 uppercase mb-2">{label}</span>}
            <div className="w-8 h-8 rounded-full border border-white/20" />
          </div>
        )}

        {/* Back (Revealed) */}
        <div 
          className={cn(
            "absolute inset-0 backface-hidden rounded-lg flex flex-col items-center justify-center p-2 text-center border-2 overflow-hidden",
            status === 'correct' ? "bg-wordle-green border-wordle-green" :
            status === 'present' ? "bg-wordle-yellow border-wordle-yellow" :
            "bg-wordle-gray border-wordle-gray",
            // If image is present, we might want to show it as background or contain
          )}
          style={{ transform: "rotateY(180deg)" }}
        >
           {imageUrl ? (
             <img src={`https://image.tmdb.org/t/p/w200${imageUrl}`} alt={content} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay" />
           ) : null}
           
           {label && <span className="text-[10px] text-white/70 uppercase mb-1 z-10">{label}</span>}
           <span className="text-xs sm:text-sm font-bold text-white z-10 leading-tight line-clamp-2">{content}</span>
        </div>
      </motion.div>
    </div>
  );
}
