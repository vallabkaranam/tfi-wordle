
'use client';

import { useEffect, useState } from 'react';
import { fetchMovies, submitGuess } from '../lib/api';
import { Movie, GuessResult } from '../lib/types';
import SearchBar from '../components/SearchBar';
import Grid from '../components/Grid';
import confetti from 'canvas-confetti';

export default function Home() {
  const [movies, setMovies] = useState<Partial<Movie>[]>([]);
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [gameStatus, setGameStatus] = useState<'in_progress' | 'won' | 'lost'>('in_progress');
  const [target, setTarget] = useState<Movie | null>(null);
  // Seed support for Unlimited Mode
  const [seed, setSeed] = useState<number | undefined>(undefined);

  useEffect(() => {
    fetchMovies().then(setMovies).catch(console.error);
    // TODO: Load previous attempts from local storage if persisting
  }, []);

  const handleGuess = async (id: number, title: string) => {
    try {
      const response = await submitGuess(id, guesses, seed);
      
      if (response.valid) {
          setGuesses(response.attempts);
          setGameStatus(response.status);
          
          if (response.status === 'won') {
              triggerWinConfetti();
              if (response.answer) setTarget(response.answer);
          } else if (response.status === 'lost') {
              if (response.answer) setTarget(response.answer);
          }
      }
    } catch (e) {
      console.error(e);
      alert("Failed to submit guess");
    }
  };

  const startNewGame = () => {
      // Generate random seed
      const newSeed = Math.floor(Math.random() * 1000000);
      setSeed(newSeed);
      setGuesses([]);
      setGameStatus('in_progress');
      setTarget(null);
  };
  
  const reloadPage = () => {
      // Reloads for daily mode reset (or back to daily if we were in random mode)
      // Play New Game implies starting a new random game
      if (seed === undefined && (gameStatus === 'won' || gameStatus === 'lost')) {
          startNewGame();
      } else {
          startNewGame();
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
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, shapes: ['star'] as any, colors: ['#FFD700', '#FFFFFF'] });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, shapes: ['circle'] as any, colors: ['#FFD700', '#FFFFFF'] });
    }, 250);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 bg-cinema text-white font-sans">
      {/* Header */}
      <header className="w-full max-w-6xl flex items-center justify-between py-6 border-b border-white/10 mb-8 sticky top-0 bg-cinema/90 backdrop-blur-md z-40 px-4">
        <h1 className="text-3xl font-bold tracking-tighter text-gold">
          TFI <span className="text-white">WORDLE</span>
        </h1>
        <div className="flex gap-4 text-sm text-gray-400 items-center">
            {seed !== undefined && <span className="text-xs bg-gold/20 text-gold px-2 py-1 rounded">UNLIMITED MODE</span>}
            <span className="hidden sm:inline">🍿 GUESS THE MOVIE</span>
        </div>
      </header>
      
      {/* Game Area */}
      <div className="w-full max-w-6xl relative pb-20">
        <div className="w-full max-w-lg mx-auto mb-2 text-center">
            {gameStatus === 'in_progress' ? (
                <p className="text-sm text-gray-400 mb-2">You have <span className="text-gold font-bold">{5 - guesses.length}</span> guesses remaining</p>
            ) : (
                <p className="text-sm text-gray-400 mb-2">Game Over</p>
            )}
        </div>

        <SearchBar 
          movies={movies} 
          onGuess={handleGuess} 
          disabled={gameStatus !== 'in_progress'} 
        />
        
        <div className="mt-8">
           <Grid guesses={guesses} />
        </div>
      </div>

      {/* End Game Modal / Overlay */}
      {gameStatus !== 'in_progress' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-cinema-light border border-gold/30 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl transform scale-100 overflow-hidden relative">
            
            {/* Close / Dismiss? No, force decision. */}

            {gameStatus === 'won' ? (
              <>
                <div className="text-6xl mb-4 animate-bounce">🍿</div>
                <h2 className="text-3xl font-bold text-gold mb-2">BLOCKBUSTER!</h2>
                <p className="text-gray-300 mb-6">You won in <span className="text-white font-bold">{guesses.length}</span> guess{guesses.length > 1 ? 'es' : ''}!</p>
              </>
            ) : (
             <>
                <div className="text-6xl mb-4 grayscale opacity-50">🎬</div>
                <h2 className="text-3xl font-bold text-white mb-2">FLOP</h2>
                <p className="text-gray-300 mb-4">You ran out of guesses.</p>
             </>   
            )}

            {target && (
                 <div className="bg-black/40 p-5 rounded-xl mb-6 text-left border border-white/5">
                     <div className="flex gap-4 mb-4">
                         {target.poster_path ? (
                             <img src={`https://image.tmdb.org/t/p/w200${target.poster_path}`} className="w-20 h-28 object-cover rounded shadow-lg" alt={target.title} />
                         ) : (
                             <div className="w-20 h-28 bg-gray-800 rounded flex items-center justify-center text-xs text-gray-500">No Poster</div>
                         )}
                         <div className="flex-1 min-w-0">
                             <h3 className="text-xl font-bold text-gold truncate">{target.title}</h3>
                             <p className="text-gray-400 text-sm mb-2">{target.year} • {target.language.toUpperCase()}</p>
                             <div className="flex flex-wrap gap-2 mt-2">
                                {/* Small badges for quick info if needed, but the grid below is better */}
                             </div>
                         </div>
                     </div>
                     <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm border-t border-white/10 pt-3">
                         <div className="col-span-1"><span className="text-gray-500 text-xs uppercase">Hero</span><br/><span className="text-white font-medium">{target.hero}</span></div>
                         <div className="col-span-1"><span className="text-gray-500 text-xs uppercase">Heroine</span><br/><span className="text-white font-medium">{target.heroine}</span></div>
                         <div className="col-span-1 mt-2"><span className="text-gray-500 text-xs uppercase">Director</span><br/><span className="text-white font-medium">{target.director}</span></div>
                         <div className="col-span-1 mt-2"><span className="text-gray-500 text-xs uppercase">Music</span><br/><span className="text-white font-medium">{target.music}</span></div>
                         <div className="col-span-2 mt-2"><span className="text-gray-500 text-xs uppercase">Producer</span><br/><span className="text-white font-medium">{target.producer}</span></div>
                     </div>
                 </div>
            )}

            <div className="flex gap-3 flex-col sm:flex-row">
                <button 
                onClick={reloadPage}
                className="flex-1 px-6 py-3 bg-gold text-black font-bold rounded-xl hover:bg-yellow-400 transition-colors shadow-lg shadow-gold/20"
                >
                Play New Game
                </button>
                <button 
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-white/5 text-white font-medium rounded-xl hover:bg-white/10 transition-colors border border-white/10"
                >
                Back to Daily
                </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
