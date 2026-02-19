
'use client';

import { GuessResult } from '@/lib/types';
import FlipCard from './FlipCard';

interface GridProps {
  guesses: GuessResult[];
}

export default function Grid({ guesses }: GridProps) {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-20">
      {guesses.map((guess, i) => (
        <div key={i} className="bg-cinema-light/50 p-4 rounded-xl border border-white/5">
          <div className="text-white font-bold text-lg mb-2 text-center text-gold">{guess.title}</div>
          <div className="grid grid-cols-5 gap-2">
            <FlipCard 
              content={guess.values.hero} 
              label="Hero" 
              status={guess.matches.hero ? 'correct' : 'absent'} 
              delay={0}
              imageUrl={guess.matches.hero ? guess.poster_path : undefined} 
            />
            <FlipCard 
              content={guess.values.heroine} 
              label="Heroine" 
              status={guess.matches.heroine ? 'correct' : 'absent'} 
              delay={0.2}
              imageUrl={guess.matches.heroine ? guess.poster_path : undefined}
            />
            <FlipCard 
              content={guess.values.director} 
              label="Director" 
              status={guess.matches.director ? 'correct' : 'absent'} 
              delay={0.4}
            />
            <FlipCard 
              content={guess.values.music} 
              label="Music" 
              status={guess.matches.music ? 'correct' : 'absent'} 
              delay={0.6}
            />
            <FlipCard 
              content={guess.values.producer} 
              label="Producer" 
              status={guess.matches.producer ? 'correct' : 'absent'} 
              delay={0.8}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
