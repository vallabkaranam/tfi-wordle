
'use client';

import { useEffect, useState } from 'react';
import { fetchMovies, submitGuess } from '@/lib/api';
import { Movie, GuessResult } from '@/lib/types';
import SearchBar from '@/components/SearchBar';
import Grid from '@/components/Grid';
import confetti from 'canvas-confetti';

export default function Home() {
  const [movies, setMovies] = useState<Partial<Movie>[]>([]);
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [target, setTarget] = useState<Movie | null>(null);

  useEffect(() => {
    fetchMovies().then(setMovies).catch(console.error);
    // In a real app we might verify session here
  }, []);

  const handleGuess = async (title: string) => {
    try {
      const { guess, correct } = await submitGuess(title);
      setGuesses(prev => [guess, ...prev]); // Add new guess to top
      
      if (correct) {
        setGameStatus('won');
        triggerWinConfetti();
      } else if (guesses.length >= 5) {
         // Simple 6 guess limit logic (5 previous + 1 current = 6)
         setGameStatus('lost');
         // We should fetch the actual target to show it
         const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
         const dailyRes = await fetch(`${apiUrl}/daily`);
         const dailyData = await dailyRes.json();
         setTarget(dailyData);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to submit guess");
    }
  };

  const triggerWinConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      // since particles fall down, start a bit higher than random
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, shapes: ['star'] as any, colors: ['#FFD700', '#FFFFFF'] });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, shapes: ['circle'] as any, colors: ['#FFD700', '#FFFFFF'] });
    }, 250);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 bg-cinema text-white font-sans">
      {/* Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-6 border-b border-white/10 mb-8">
        <h1 className="text-3xl font-bold tracking-tighter text-gold">
          TOLLYWOOD <span className="text-white">WORDLE</span>
        </h1>
        <div className="flex gap-4 text-sm text-gray-400">
          <span>🍿 GUESS THE MOVIE</span>
        </div>
      </header>

      {/* Game Area */}
      <div className="w-full max-w-4xl relative">
        <SearchBar 
          movies={movies} 
          onGuess={handleGuess} 
          disabled={gameStatus !== 'playing'} 
        />
        
        <div className="mt-8">
           {/* Column Headers */}
           <div className="grid grid-cols-5 gap-2 text-center text-xs uppercase text-gray-500 mb-2 px-4 max-w-4xl mx-auto">
             <div>Hero</div>
             <div>Heroine</div>
             <div>Director</div>
             <div>Music</div>
             <div>Producer</div>
           </div>
           
           <Grid guesses={guesses} />
        </div>
      </div>

      {/* End Game Modal / Overlay */}
      {gameStatus !== 'playing' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-cinema-light border border-gold/30 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-300">
            {gameStatus === 'won' ? (
              <>
                <div className="text-6xl mb-4">🍿</div>
                <h2 className="text-4xl font-bold text-gold mb-2">BLOCKBUSTER!</h2>
                <p className="text-gray-300 mb-6">You guessed the movie correctly.</p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">🎬</div>
                <h2 className="text-4xl font-bold text-white mb-2">FLOP</h2>
                <p className="text-gray-300 mb-4">Better luck tomorrow.</p>
                {target && (
                   <div className="bg-black/50 p-4 rounded-lg mb-4">
                     <p className="text-sm text-gray-400 mb-1">The movie was:</p>
                     <p className="text-xl font-bold text-gold">{target.title}</p>
                   </div>
                )}
              </>
            )}
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gold text-black font-bold rounded-full hover:bg-yellow-400 transition-colors w-full"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
