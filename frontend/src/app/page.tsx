
'use client';

import { useEffect, useState } from 'react';
import { fetchMovies, submitGuess } from '../lib/api';
import { Movie, GuessResult } from '../lib/types';
import SearchBar from '../components/SearchBar';
import Grid from '../components/Grid';
import confetti from 'canvas-confetti';

/**
 * Main Application Component for TFI Wordle.
 * 
 * Logic Overview:
 * - Manages the global game state including guesses, remaining attempts, and game status.
 * - Supports two modes: 'Daily' (fixed movie per date) and 'Unlimited' (random movie via seed).
 * - Orchestrates the guess submission and feedback loop.
 */
export default function Home() {
  // Shared curated movies for search bar suggestions
  const [movies, setMovies] = useState<Partial<Movie>[]>([]);
  
  // Game state
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [gameStatus, setGameStatus] = useState<'in_progress' | 'won' | 'lost'>('in_progress');
  const [target, setTarget] = useState<Movie | null>(null);
  
  // Custom seed for "Unlimited Mode". If undefined, the backend defaults to the Daily target.
  const [seed, setSeed] = useState<number | undefined>(undefined);

  /**
   * Initial effect to fetch curated movie list.
   * This is used by the SearchBar to provide instant suggestions for popular movies.
   */
  useEffect(() => {
    fetchMovies().then(setMovies).catch(console.error);
    // Future expansion: Load state from LocalStorage to persist daily progress
  }, []);

  /**
   * Handles user movie selection from SearchBar.
   * Sends the guess to the backend and updates the UI based on the match result.
   */
  const handleGuess = async (id: number, title: string) => {
    try {
      const response = await submitGuess(id, guesses, seed);
      
      if (response.valid) {
          setGuesses(response.attempts);
          setGameStatus(response.status);
          
          // Trigger celebrations on Win
          if (response.status === 'won') {
              triggerWinConfetti();
              if (response.answer) setTarget(response.answer);
          } else if (response.status === 'lost') {
              // Reveal the answer on Loss
              if (response.answer) setTarget(response.answer);
          }
      }
    } catch (e) {
      console.error("Guess Submission Error:", e);
      alert("Failed to submit guess. Please try again.");
    }
  };

  /**
   * Resets the game state and generates a new random seed for "Unlimited Mode".
   */
  const startNewGame = () => {
      const newSeed = Math.floor(Math.random() * 1000000);
      setSeed(newSeed);
      setGuesses([]);
      setGameStatus('in_progress');
      setTarget(null);
  };
  
  /**
   * Decides which action to take when the user wants to play again.
   */
  const reloadPage = () => {
      // Regardless of current mode, "Play New Game" starts a fresh Unlimited session
      startNewGame();
  };

  /**
   * Visual reward using canvas-confetti.
   * Animates star and circle particles from both sides of the screen.
   */
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
      {/* 
          Sticky Header: 
          Displays Branding and Mode indicator.
      */}
      <header className="w-full max-w-6xl flex items-center justify-between py-6 border-b border-white/10 mb-8 sticky top-0 bg-cinema/90 backdrop-blur-md z-40 px-4">
        <h1 className="text-3xl font-bold tracking-tighter text-gold">
          TFI <span className="text-white">WORDLE</span>
        </h1>
        <div className="flex gap-4 text-sm text-gray-400 items-center">
            {seed !== undefined && <span className="text-xs bg-gold/20 text-gold px-2 py-1 rounded font-bold">UNLIMITED MODE</span>}
            <span className="hidden sm:inline">🍿 GUESS THE MOVIE</span>
        </div>
      </header>
      
      {/* 
          Main Game Engine:
          Contains Search (Input) and Grid (History).
      */}
      <div className="w-full max-w-6xl relative pb-20">
        <div className="w-full max-w-lg mx-auto mb-2 text-center">
            {gameStatus === 'in_progress' ? (
                <p className="text-sm text-gray-400 mb-2 animate-pulse">You have <span className="text-gold font-bold">{5 - guesses.length}</span> guesses remaining</p>
            ) : (
                <p className="text-sm text-gold font-bold mb-2 uppercase tracking-widest">Game Over</p>
            )}
        </div>

        {/* Global Search Component: Decoupled for complex async search logic */}
        <SearchBar 
          movies={movies} 
          onGuess={handleGuess} 
          disabled={gameStatus !== 'in_progress'} 
        />
        
        {/* Guess History Grid */}
        <div className="mt-8">
           <Grid guesses={guesses} />
        </div>
      </div>

      {/* 
          End Game Overlay (Modal):
          Only appears when status is 'won' or 'lost'.
          Displays result summary and correct movie details.
      */}
      {gameStatus !== 'in_progress' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-cinema-light border border-gold/30 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl transform scale-100 overflow-hidden relative">
            
            {/* Header Section */}
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

            {/* Movie Reveal Card */}
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
                         </div>
                     </div>
                     
                     {/* Role Breakdown (Metadata Display) */}
                     <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm border-t border-white/10 pt-3">
                         <div className="col-span-1"><span className="text-gray-500 text-xs uppercase">Hero</span><br/><span className="text-white font-medium">{target.hero}</span></div>
                         <div className="col-span-1"><span className="text-gray-500 text-xs uppercase">Heroine</span><br/><span className="text-white font-medium">{target.heroine}</span></div>
                         <div className="col-span-1 mt-2"><span className="text-gray-500 text-xs uppercase">Director</span><br/><span className="text-white font-medium">{target.director}</span></div>
                         <div className="col-span-1 mt-2"><span className="text-gray-500 text-xs uppercase">Music</span><br/><span className="text-white font-medium">{target.music}</span></div>
                         <div className="col-span-2 mt-2"><span className="text-gray-500 text-xs uppercase">Producer</span><br/><span className="text-white font-medium">{target.producer}</span></div>
                     </div>
                 </div>
            )}

            {/* Navigation Buttons */}
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
