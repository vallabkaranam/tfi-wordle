
'use client';

import { GuessResult } from '../lib/types';
import FlipCard from './FlipCard';

interface GridProps {
  guesses: GuessResult[];
}

export default function Grid({ guesses }: GridProps) {
  return (
    <div className="w-full max-w-6xl mx-auto space-y-3 sm:space-y-4 pb-20">
      <div className="grid grid-cols-5 gap-1 sm:gap-2 text-center text-[10px] sm:text-xs uppercase text-gray-500 mb-2 px-2 sm:px-4">
        <div>Hero</div>
        <div>Heroine</div>
        <div>Director</div>
        <div>Music</div>
        <div>Producer</div>
      </div>
      
      {guesses.map((guess, i) => (
        <div key={i} className="bg-cinema-light/50 p-2 sm:p-4 rounded-xl border border-white/5 shadow-sm">
          <div className="text-white font-bold text-sm sm:text-lg mb-2 text-center text-gold flex items-center justify-center gap-2 truncate px-1">
            {guess.title}
          </div>
          <div className="grid grid-cols-5 gap-1 sm:gap-2">
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
          </div>
        </div>
      ))}
    </div>
  );
}
