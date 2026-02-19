
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
import HowToPlay from '../components/HowToPlay';
import LanguageToggle, { Language } from '../components/LanguageToggle';
import confetti from 'canvas-confetti';
import { Trophy, HelpCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Utility: format a Date to "19 Feb 2026" for display / share text
// ---------------------------------------------------------------------------
function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Feature 1: Live countdown hook — seconds until next local midnight
// ---------------------------------------------------------------------------
function useCountdown(): string {
  const getSecondsLeft = () => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
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
// Language metadata for visual theming — mirrors LanguageToggle.tsx
// ---------------------------------------------------------------------------
const LANG_META: Record<Language, { label: string; industry: string; headerColor: string }> = {
  te: { label: 'Telugu',  industry: 'Tollywood',  headerColor: 'text-gold' },
  hi: { label: 'Hindi',   industry: 'Bollywood',  headerColor: 'text-orange-400' },
  ta: { label: 'Tamil',   industry: 'Kollywood',  headerColor: 'text-red-400' },
};

// ---------------------------------------------------------------------------
// Main Game Component
// ---------------------------------------------------------------------------

/**
 * Home — Root Page for TFI Wordle.
 *
 * Manages all game state and wires together:
 *  - Language toggle (te / hi / ta) [Language Toggle Feature]
 *  - Countdown timer to next daily puzzle [Feature 1]
 *  - Stats dashboard via trophy button [Feature 2]
 *  - Share emoji-grid button in end modal [Feature 3]
 *  - Stats ticker marquee [Feature 4]
 *  - Progressive blur hint poster [Feature 5]
 *  - How-to-Play modal via ? button
 *  - SearchBar with global TMDB lookup (lang-threaded)
 *  - Guess Grid (reverse-chronological)
 *  - End-game modal with answer reveal
 */
export default function Home() {
  // ── Language state ──────────────────────────────────────────────────────
  const [language, setLanguage] = useState<Language>('te');

  // ── Curation ─────────────────────────────────────────────────────────────
  /** Curated movie list for instant SearchBar suggestions */
  const [movies, setMovies] = useState<Partial<Movie>[]>([]);

  // ── Core game state ───────────────────────────────────────────────────────
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [gameStatus, setGameStatus] = useState<'in_progress' | 'won' | 'lost'>('in_progress');
  const [target, setTarget] = useState<Movie | null>(null);
  const [seed, setSeed] = useState<number | undefined>(undefined);

  // ── UI panels ────────────────────────────────────────────────────────────
  const [showStats, setShowStats] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [stats, setStats] = useState<GameStats>(() => loadStats());

  // ── Derived values ────────────────────────────────────────────────────────
  const dateLabel = formatDate(new Date());
  const countdown = useCountdown();
  const langMeta = LANG_META[language];

  // Wrong guesses drives the blur level in HintPoster
  const wrongGuesses = guesses.filter((g) =>
    !g.matches.hero && !g.matches.heroine && !g.matches.director && !g.matches.music && !g.matches.producer
  ).length;
  const hintPosterPath = guesses.length >= 2 ? guesses[guesses.length - 1]?.poster_path : undefined;

  // ── Effects ───────────────────────────────────────────────────────────────

  /**
   * Reload curated suggestions whenever the language changes.
   * Also resets all game state so language pools never bleed into each other.
   */
  useEffect(() => {
    fetchMovies(language).then(setMovies).catch(console.error);
    // Reset the board for the new language
    setGuesses([]);
    setGameStatus('in_progress');
    setTarget(null);
    setSeed(undefined);
  }, [language]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  /**
   * handleGuess — Core turn logic.
   * Sends movieId + current language + prior attempts to the backend,
   * then updates state based on the response.
   */
  const handleGuess = useCallback(async (id: number, title: string) => {
    try {
      const response = await submitGuess(id, guesses, seed, language);

      if (response.valid) {
        setGuesses(response.attempts);
        setGameStatus(response.status);

        if (response.status === 'won') {
          triggerWinConfetti();
          if (response.answer) setTarget(response.answer);
          const updated = recordGame(true, response.attempts.length);
          setStats(updated);
        } else if (response.status === 'lost') {
          if (response.answer) setTarget(response.answer);
          const updated = recordGame(false, response.attempts.length);
          setStats(updated);
        }
      }
    } catch (e) {
      console.error('Guess submission error:', e);
      alert('Failed to submit guess. Check your connection and try again.');
    }
  }, [guesses, seed, language]);

  /**
   * handleLanguageChange — Switches language and resets the full game state.
   * A clean reset prevents any cross-language data contamination.
   */
  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang); // triggers useEffect above
  };

  /** startNewGame — Random seed generates an Unlimited Mode round. */
  const startNewGame = () => {
    const newSeed = Math.floor(Math.random() * 1_000_000);
    setSeed(newSeed);
    setGuesses([]);
    setGameStatus('in_progress');
    setTarget(null);
  };

  /** triggerWinConfetti — Dual-origin gold star burst animation. */
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="flex min-h-screen flex-col items-center bg-cinema text-white font-sans">

      {/* ================================================================
          HEADER — Branding, Language Toggle, Countdown (F1), Icons
      ================================================================ */}
      <header className="w-full max-w-6xl flex items-center justify-between py-4 px-4 border-b border-white/10 sticky top-0 bg-cinema/95 backdrop-blur-md z-40">

        {/* Left: Brand + optional mode badge */}
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tighter shrink-0">
            <span className={langMeta.headerColor}>TFI</span>
            <span className="text-white"> WORDLE</span>
          </h1>
          {seed !== undefined && (
            <span className="hidden sm:inline text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded font-bold uppercase tracking-widest border border-white/10">
              ∞ Unlimited
            </span>
          )}
        </div>

        {/* Center: Language Toggle */}
        <div className="flex-1 flex justify-center px-2">
          <LanguageToggle value={language} onChange={handleLanguageChange} />
        </div>

        {/* Right: Countdown + icon buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {seed === undefined && (
            <div className="hidden lg:flex flex-col items-end">
              <span className="text-[9px] text-gray-600 uppercase tracking-widest">Next puzzle</span>
              <span className="text-xs font-mono text-gray-400 tabular-nums">{countdown}</span>
            </div>
          )}
          {/* How-to-Play button */}
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            title="How to Play"
            aria-label="How to Play"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
          {/* Stats button */}
          <button
            onClick={() => setShowStats(true)}
            className="p-2 rounded-lg text-gray-400 hover:text-gold hover:bg-white/5 transition-colors"
            title="Statistics"
            aria-label="View Statistics"
          >
            <Trophy className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ================================================================
          FEATURE 4: Stats Ticker Marquee
      ================================================================ */}
      <StatsTicker />

      {/* ================================================================
          GAME AREA
      ================================================================ */}
      <div className="w-full max-w-6xl flex-1 px-4 pt-6 pb-20">

        {/* Industry context + guess counter */}
        <div className="w-full max-w-lg mx-auto mb-4 text-center">
          <p className="text-[11px] text-gray-500 mb-1 uppercase tracking-widest font-bold">
            {langMeta.industry} · {langMeta.label} Cinema
          </p>
          {gameStatus === 'in_progress' ? (
            <p className="text-sm text-gray-400">
              <span className={`font-bold ${langMeta.headerColor}`}>{5 - guesses.length}</span>
              {' '}guess{5 - guesses.length !== 1 ? 'es' : ''} remaining
            </p>
          ) : (
            <p className="text-sm font-bold uppercase tracking-widest text-gold">Game Over</p>
          )}
        </div>

        {/* Search — language-aware TMDB lookup */}
        <SearchBar
          movies={movies}
          onGuess={handleGuess}
          disabled={gameStatus !== 'in_progress'}
          lang={language}
        />

        {/* Feature 5: Blur hint poster after 2+ wrong guesses */}
        {gameStatus === 'in_progress' && (
          <HintPoster
            posterPath={hintPosterPath}
            wrongGuesses={wrongGuesses}
          />
        )}

        {/* Guess history — newest at top */}
        <div className="mt-6">
          <Grid guesses={guesses} />
        </div>
      </div>

      {/* ================================================================
          Modals: How-to-Play, Stats
      ================================================================ */}
      <HowToPlay isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <StatsModal isOpen={showStats} onClose={() => setShowStats(false)} stats={stats} />

      {/* ================================================================
          END-GAME OVERLAY — Win / Loss + Feature 3 Share
      ================================================================ */}
      {gameStatus !== 'in_progress' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-cinema-light border border-gold/30 p-7 rounded-2xl max-w-md w-full text-center shadow-2xl overflow-y-auto max-h-[90vh]">

            {gameStatus === 'won' ? (
              <>
                <div className="text-6xl mb-3 animate-bounce">🍿</div>
                <h2 className="text-3xl font-bold text-gold mb-1">BLOCKBUSTER!</h2>
                <p className="text-gray-300 mb-1">
                  Won in <span className="text-white font-bold">{guesses.length}</span> guess{guesses.length !== 1 ? 'es' : ''}
                </p>
                {stats.currentStreak > 1 && (
                  <p className="text-xs text-gold/80 mb-4">🔥 {stats.currentStreak}-day streak!</p>
                )}
              </>
            ) : (
              <>
                <div className="text-6xl mb-3 grayscale opacity-60">🎬</div>
                <h2 className="text-3xl font-bold text-white mb-2">FLOP</h2>
                <p className="text-gray-300 mb-4">You ran out of guesses.</p>
              </>
            )}

            {/* Answer reveal */}
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
                    <div className="w-16 h-24 bg-gray-800 rounded flex items-center justify-center text-xs text-gray-500 shrink-0">No Poster</div>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-gold truncate">{target.title}</h3>
                    <p className="text-gray-400 text-xs mb-1">{target.year} · {target.language?.toUpperCase()}</p>
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
            <div className="flex gap-2 flex-col sm:flex-row">
              <button
                onClick={startNewGame}
                className="flex-1 px-4 py-3 bg-gold text-black font-bold rounded-xl hover:bg-yellow-400 transition-colors text-sm shadow-lg shadow-gold/20"
              >
                New Game
              </button>
              <ShareButton guesses={guesses} gameStatus={gameStatus} dateLabel={dateLabel} />
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-3 bg-white/5 text-white font-medium rounded-xl hover:bg-white/10 transition-colors border border-white/10 text-sm"
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
