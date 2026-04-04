
'use client';

import { useMemo } from 'react';
import { GuessResult } from '../lib/types';
import FlipCard from './FlipCard';

interface GridProps {
  /** Array of guess results filtered from the backend */
  guesses: GuessResult[];
}

/**
 * Grid Component:
 * - Renders the history of guesses in reverse chronological order (newest at top).
 * - Displays a header indicating the role categories (Hero, Heroine, etc.).
 * - Map each guess into a structured row containing FlipCards for validation feedback.
 */
export default function Grid({ guesses }: GridProps) {
  const reversedGuesses = useMemo(() => [...guesses].reverse(), [guesses]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-3 sm:space-y-4 pb-20">
      
      {/* Column Labels (Hero, heroine, etc.) */}
      <div className="grid grid-cols-6 gap-1 sm:gap-2 text-center text-[10px] sm:text-xs uppercase text-gray-400 mb-2 px-2 sm:px-4 font-bold tracking-widest opacity-80">
        <div>Hero</div>
        <div>Heroine</div>
        <div>Director</div>
        <div>Music</div>
        <div>Producer</div>
        <div>Year</div>
      </div>
      
      {/* 
          Guess Rows:
          reversedGuesses ensures the user sees their latest guess immediately at the top.
      */}
      {reversedGuesses.map((guess, i) => (
        <div key={`${guess.id}-${i}`} className="bg-cinema-light/40 p-2 sm:p-4 rounded-xl border border-white/5 shadow-sm hover:border-white/10 transition-colors">
          
          {/* Guess Title: Large gold text identifying the movie picked */}
          <div className="text-white font-bold text-sm sm:text-lg mb-2 text-center text-gold flex items-center justify-center gap-2 truncate px-1">
            {guess.title}
          </div>
          
          {/* Individual Field FlipCards: Color-coded results per field */}
          <div className="grid grid-cols-6 gap-1 sm:gap-2">
            <FlipCard 
              content={guess.values.hero} 
              label="Hero" 
              status={guess.matches.hero ? 'correct' : 'absent'} 
              delay={0}
              imageUrl={guess.images?.hero}
            />
            <FlipCard 
              content={guess.values.heroine} 
              label="Heroine" 
              status={guess.matches.heroine ? 'correct' : 'absent'} 
              delay={0.1}
              imageUrl={guess.images?.heroine}
            />
            <FlipCard 
              content={guess.values.director} 
              label="Director" 
              status={guess.matches.director ? 'correct' : 'absent'} 
              delay={0.2}
              imageUrl={guess.images?.director}
            />
            <FlipCard 
              content={guess.values.music} 
              label="Music" 
              status={guess.matches.music ? 'correct' : 'absent'} 
              delay={0.3}
              imageUrl={guess.images?.music}
            />
            <FlipCard 
              content={guess.values.producer} 
              label="Producer" 
              status={guess.matches.producer ? 'correct' : 'absent'} 
              delay={0.4}
              imageUrl={guess.images?.producer}
            />
            <FlipCard
              content={guess.values.year ? String(guess.values.year) : '????'}
              label="Year"
              status={
                guess.matches.year === 'correct'
                  ? 'correct'
                  : guess.matches.year === 'unknown'
                    ? 'absent'
                    : guess.matches.year
              }
              indicator={
                guess.matches.year === 'higher'
                  ? '↑'
                  : guess.matches.year === 'lower'
                    ? '↓'
                    : undefined
              }
              delay={0.5}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
