
'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchMovies, submitGuess } from '../lib/api';
import { Movie, GuessResult } from '../lib/types';
import { loadStats, recordGame, GameStats } from '../lib/stats';
import SearchBar from '../components/SearchBar';
import Grid from '../components/Grid';
import StatsModal from '../components/StatsModal';
import ShareButton from '../components/ShareButton';
import StatsTicker from '../components/StatsTicker';
import HintPoster from '../components/HintPoster';
import confetti from 'canvas-confetti';
import { Trophy } from 'lucide-react';

// ---------------------------------------------------------------------------
// Helper: format a Date to "19 Feb 2026"
// ---------------------------------------------------------------------------
function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Feature 1: Countdown Hook — calculates seconds until next midnight (UTC)
// ---------------------------------------------------------------------------
function useCountdown(): string {
  const getSecondsLeft = () => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0); // Next local midnight
    return Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  };

  const [secs, setSecs] = useState(getSecondsLeft);

  useEffect(() => {
    const id = setInterval(() => setSecs(getSecondsLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  const h = String(Math.floor(secs / 3600)).padStart(2, '0');
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * Home — Main Game Page for TFI Wordle.
 *
 * Orchestrates all game logic and renders the full UI:
 *  - Header with live countdown (Feature 1) and stats button (Feature 2)
 *  - Stats Ticker marquee below header (Feature 4)
 *  - SearchBar with global TMDB search
 *  - Progressive blur hint poster after 2 wrong guesses (Feature 5)
 *  - Guess history Grid (reverse chronological order)
 *  - End-game modal with Share button (Feature 3) and stats recording
 */
export default function Home() {
  // Initial curated movie list for fast suggestions in search bar
  const [movies, setMovies] = useState<Partial<Movie>[]>([]);

  // Core game state
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [gameStatus, setGameStatus] = useState<'in_progress' | 'won' | 'lost'>('in_progress');
  const [target, setTarget] = useState<Movie | null>(null);

  // Custom seed for "Unlimited Mode"; undefined = use daily mode
  const [seed, setSeed] = useState<number | undefined>(undefined);

  // Feature 2: Stats dashboard visibility
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<GameStats>(() => loadStats());

  // Feature 3: Share button data
  const dateLabel = formatDate(new Date());

  // Feature 1: Countdown to next puzzle
  const countdown = useCountdown();

  // Feature 5: Number of wrong guesses for hint poster
  const wrongGuesses = guesses.filter((g) =>
    !g.matches.hero && !g.matches.heroine && !g.matches.director && !g.matches.music && !g.matches.producer
  ).length;

  // Target poster path for hint poster (only set once game over or from last guess mismatches)
  // We use a heuristic: show after 2 missed guesses for ANY of the last guess's poster.
  const hintPosterPath = guesses.length >= 2 ? guesses[guesses.length - 1]?.poster_path : undefined;

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  /** Load curated movies on mount for search bar instant suggestions */
  useEffect(() => {
    fetchMovies().then(setMovies).catch(console.error);
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /**
   * handleGuess — Core turn logic.
   * Sends movieId + prior attempts to backend, updates game state on response.
   */
  const handleGuess = useCallback(async (id: number, title: string) => {
    try {
      const response = await submitGuess(id, guesses, seed);

      if (response.valid) {
        setGuesses(response.attempts);
        setGameStatus(response.status);

        if (response.status === 'won') {
          triggerWinConfetti();
          if (response.answer) setTarget(response.answer);
          // Feature 2: Record win and update stats
          const updated = recordGame(true, response.attempts.length);
          setStats(updated);
        } else if (response.status === 'lost') {
          if (response.answer) setTarget(response.answer);
          // Feature 2: Record loss
          const updated = recordGame(false, response.attempts.length);
          setStats(updated);
        }
      }
    } catch (e) {
      console.error('Guess submission error:', e);
      alert('Failed to submit guess. Please check your connection and try again.');
    }
  }, [guesses, seed]);

  /**
   * startNewGame — Generates a new random seed and resets all game state.
   * This enters "Unlimited Mode" — a new random movie each round.
   */
  const startNewGame = () => {
    const newSeed = Math.floor(Math.random() * 1_000_000);
    setSeed(newSeed);
    setGuesses([]);
    setGameStatus('in_progress');
    setTarget(null);
  };

  // ---------------------------------------------------------------------------
  // Win Animation
  // ---------------------------------------------------------------------------

  /**
   * triggerWinConfetti — Launches a timed, dual-origin gold confetti burst.
   */
  const triggerWinConfetti = () => {
    const duration = 3_000;
    const end = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
    const rng = (lo: number, hi: number) => Math.random() * (hi - lo) + lo;

    const interval: ReturnType<typeof setInterval> = setInterval(() => {
      const left = end - Date.now();
      if (left <= 0) return clearInterval(interval);
      const n = 50 * (left / duration);
      confetti({ ...defaults, particleCount: n, origin: { x: rng(0.1, 0.3), y: Math.random() - 0.2 }, shapes: ['star'] as any, colors: ['#FFD700', '#FFFFFF'] });
      confetti({ ...defaults, particleCount: n, origin: { x: rng(0.7, 0.9), y: Math.random() - 0.2 }, shapes: ['circle'] as any, colors: ['#FFD700', '#FFFFFF'] });
    }, 250);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main className="flex min-h-screen flex-col items-center bg-cinema text-white font-sans">

      {/* ==================================================================
          HEADER — Branding, countdown (F1), stats button (F2), mode badge
      ================================================================== */}
      <header className="w-full max-w-6xl flex items-center justify-between py-5 px-4 border-b border-white/10 sticky top-0 bg-cinema/95 backdrop-blur-md z-40">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tighter text-gold">
            TFI <span className="text-white">WORDLE</span>
          </h1>
          {seed !== undefined && (
            <span className="text-[10px] bg-gold/20 text-gold px-2 py-0.5 rounded font-bold uppercase tracking-widest border border-gold/20">
              ∞ Unlimited
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Feature 1: Live countdown to next daily puzzle */}
          {seed === undefined && (
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[9px] text-gray-600 uppercase tracking-widest">Next puzzle</span>
              <span className="text-xs font-mono text-gray-400 tabular-nums">{countdown}</span>
            </div>
          )}

          {/* Feature 2: Stats trigger button */}
          <button
            onClick={() => setShowStats(true)}
            className="p-2 rounded-lg text-gray-400 hover:text-gold hover:bg-white/5 transition-colors"
            title="View Statistics"
            aria-label="View your statistics"
          >
            <Trophy className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ==================================================================
          FEATURE 4: Scrolling stats ticker / marquee
      ================================================================== */}
      <StatsTicker />

      {/* ==================================================================
          GAME AREA
      ================================================================== */}
      <div className="w-full max-w-6xl flex-1 px-4 pt-6 pb-20">

        {/* Remaining attempts counter */}
        <div className="w-full max-w-lg mx-auto mb-4 text-center">
          {gameStatus === 'in_progress' ? (
            <p className="text-sm text-gray-400">
              You have{' '}
              <span className="text-gold font-bold">{5 - guesses.length}</span>{' '}
              guess{5 - guesses.length !== 1 ? 'es' : ''} remaining
            </p>
          ) : (
            <p className="text-sm text-gold font-bold uppercase tracking-widest">Game Over</p>
          )}
        </div>

        {/* Search input — globally enabled TMDB lookup */}
        <SearchBar
          movies={movies}
          onGuess={handleGuess}
          disabled={gameStatus !== 'in_progress'}
        />

        {/* ==============================================================
            FEATURE 5: Progressive blur hint poster (after 2 wrong guesses)
        ============================================================== */}
        {gameStatus === 'in_progress' && (
          <HintPoster
            posterPath={hintPosterPath}
            wrongGuesses={wrongGuesses}
          />
        )}

        {/* Guess history — newest guess at the top */}
        <div className="mt-6">
          <Grid guesses={guesses} />
        </div>
      </div>

      {/* ==================================================================
          FEATURE 2: Stats Modal
      ================================================================== */}
      <StatsModal isOpen={showStats} onClose={() => setShowStats(false)} stats={stats} />

      {/* ==================================================================
          END-GAME OVERLAY — Win / Loss + Share (F3)
      ================================================================== */}
      {gameStatus !== 'in_progress' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-cinema-light border border-gold/30 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl overflow-y-auto max-h-[90vh]">

            {/* Result emoji and headline */}
            {gameStatus === 'won' ? (
              <>
                <div className="text-6xl mb-4 animate-bounce">🍿</div>
                <h2 className="text-3xl font-bold text-gold mb-1">BLOCKBUSTER!</h2>
                <p className="text-gray-300 mb-2">
                  Won in <span className="text-white font-bold">{guesses.length}</span> guess{guesses.length > 1 ? 'es' : ''}
                </p>
                {/* Streak callout */}
                {stats.currentStreak > 1 && (
                  <p className="text-xs text-gold/80 mb-4">🔥 {stats.currentStreak} day streak!</p>
                )}
              </>
            ) : (
              <>
                <div className="text-6xl mb-4 grayscale opacity-60">🎬</div>
                <h2 className="text-3xl font-bold text-white mb-2">FLOP</h2>
                <p className="text-gray-300 mb-4">You ran out of guesses.</p>
              </>
            )}

            {/* Answer reveal card */}
            {target && (
              <div className="bg-black/40 p-4 rounded-xl mb-5 text-left border border-white/5">
                <div className="flex gap-4 mb-3">
                  {target.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w200${target.poster_path}`}
                      className="w-16 h-24 object-cover rounded shadow-lg shrink-0"
                      alt={target.title}
                    />
                  ) : (
                    <div className="w-16 h-24 bg-gray-800 rounded flex items-center justify-center text-xs text-gray-500 shrink-0">
                      No Poster
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gold truncate">{target.title}</h3>
                    <p className="text-gray-400 text-xs mb-2">
                      {target.year} · {target.language?.toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs border-t border-white/10 pt-3">
                  <div><span className="text-gray-500 uppercase text-[10px]">Hero</span><br /><span className="text-white font-medium">{target.hero}</span></div>
                  <div><span className="text-gray-500 uppercase text-[10px]">Heroine</span><br /><span className="text-white font-medium">{target.heroine}</span></div>
                  <div className="mt-1"><span className="text-gray-500 uppercase text-[10px]">Director</span><br /><span className="text-white font-medium">{target.director}</span></div>
                  <div className="mt-1"><span className="text-gray-500 uppercase text-[10px]">Music</span><br /><span className="text-white font-medium">{target.music}</span></div>
                  <div className="col-span-2 mt-1"><span className="text-gray-500 uppercase text-[10px]">Producer</span><br /><span className="text-white font-medium">{target.producer}</span></div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 flex-col sm:flex-row">
              <button
                onClick={startNewGame}
                className="flex-1 px-5 py-3 bg-gold text-black font-bold rounded-xl hover:bg-yellow-400 transition-colors shadow-lg shadow-gold/20 text-sm"
              >
                Play New Game
              </button>
              {/* Feature 3: Share button */}
              <ShareButton
                guesses={guesses}
                gameStatus={gameStatus}
                dateLabel={dateLabel}
              />
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-3 bg-white/5 text-white font-medium rounded-xl hover:bg-white/10 transition-colors border border-white/10 text-sm"
              >
                Daily
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
