'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchMovies, submitGuess } from '../lib/api';
import { Movie, GuessResult } from '../lib/types';
import { loadStats, recordGame, GameStats } from '../lib/stats';
import SearchBar from '../components/SearchBar';
import Grid from '../components/Grid';
import StatsModal from '../components/StatsModal';
import StatsTicker from '../components/StatsTicker';
import HintPoster from '../components/HintPoster';
import HowToPlay from '../components/HowToPlay';
import LanguageToggle, { Language } from '../components/LanguageToggle';
import confetti from 'canvas-confetti';
import { Trophy, HelpCircle, Calendar, Shuffle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Countdown hook — ticks every second to midnight
// ---------------------------------------------------------------------------
function useCountdown(): string {
  const getSecsLeft = () => {
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    return Math.max(0, Math.floor((midnight.getTime() - Date.now()) / 1000));
  };
  const [secs, setSecs] = useState(getSecsLeft);
  useEffect(() => {
    const id = setInterval(() => setSecs(getSecsLeft()), 1000);
    return () => clearInterval(id);
  }, []);
  const h = String(Math.floor(secs / 3600)).padStart(2, '0');
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Per-language colour theme
const LANG_THEME: Record<Language, { accent: string; accentBg: string; industry: string }> = {
  te: { accent: 'text-gold',       accentBg: 'bg-yellow-500/10', industry: 'Tollywood' },
  hi: { accent: 'text-orange-400', accentBg: 'bg-orange-500/10', industry: 'Bollywood' },
  ta: { accent: 'text-red-400',    accentBg: 'bg-red-500/10',    industry: 'Kollywood' },
};

// ---------------------------------------------------------------------------
// Home — Main game page
// ---------------------------------------------------------------------------
export default function Home() {
  // Game mode — undefined seed = daily, number seed = random
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const isRandom = seed !== undefined;

  // Language
  const [language, setLanguage] = useState<Language>('te');
  const theme = LANG_THEME[language];

  // Movie pool for SearchBar suggestions
  const [movies, setMovies] = useState<Partial<Movie>[]>([]);

  // Core game state
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [gameStatus, setGameStatus] = useState<'in_progress' | 'won' | 'lost'>('in_progress');
  const [target, setTarget] = useState<Movie | null>(null);

  // UI panels
  const [showStats, setShowStats] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [stats, setStats] = useState<GameStats>(() => loadStats());

  const countdown = useCountdown();

  // Derived: total wrong guesses (no field matched at all)
  const wrongGuesses = guesses.filter(
    g => !g.matches.hero && !g.matches.heroine && !g.matches.director && !g.matches.music && !g.matches.producer
  ).length;

  // ---------------------------------------------------------------------------
  // Game reset helper — shared by language switch and mode switch
  // ---------------------------------------------------------------------------
  const resetGame = (nextSeed?: number) => {
    setSeed(nextSeed);
    setGuesses([]);
    setGameStatus('in_progress');
    setTarget(null);
  };

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Re-fetch suggestions & reset board on language change
  useEffect(() => {
    fetchMovies(language).then(setMovies).catch(console.error);
    resetGame(); // Switch language → back to daily for that language
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleGuess = useCallback(async (id: number) => {
    try {
      const response = await submitGuess(id, guesses, seed, language);
      if (!response.valid) return;

      setGuesses(response.attempts);
      setGameStatus(response.status as typeof gameStatus);

      if (response.status === 'won') {
        if (response.answer) setTarget(response.answer);
        setStats(recordGame(true, response.attempts.length));
        triggerConfetti();
      } else if (response.status === 'lost') {
        if (response.answer) setTarget(response.answer);
        setStats(recordGame(false, response.attempts.length));
      }
    } catch (err) {
      console.error('Guess error:', err);
    }
  }, [guesses, seed, language]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchToRandom = () => resetGame(Math.floor(Math.random() * 1_000_000));
  const switchToDaily  = () => resetGame(undefined);
  const playAgain      = () => resetGame(Math.floor(Math.random() * 1_000_000));

  function triggerConfetti() {
    const end = Date.now() + 3000;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
    const rng = (lo: number, hi: number) => Math.random() * (hi - lo) + lo;
    const tick = () => {
      const left = end - Date.now();
      if (left <= 0) return;
      const n = 50 * (left / 3000);
      confetti({ ...defaults, particleCount: n, colors: ['#FFD700', '#fff'], shapes: ['star'] as any, origin: { x: rng(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount: n, colors: ['#FFD700', '#fff'], shapes: ['circle'] as any, origin: { x: rng(0.7, 0.9), y: Math.random() - 0.2 } });
      setTimeout(tick, 250);
    };
    tick();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <main className="flex min-h-screen flex-col items-center bg-cinema text-white font-sans">

      {/* ── Header ── */}
      <header className="w-full max-w-5xl flex items-center gap-3 py-3 px-4 border-b border-white/10 sticky top-0 bg-cinema/95 backdrop-blur-md z-40">

        {/* Brand */}
        <h1 className="text-xl font-bold tracking-tighter shrink-0 mr-1">
          <span className={theme.accent}>TFI</span>
          <span className="text-white"> WORDLE</span>
        </h1>

        {/* Mode toggle — Daily / Random — prominent, always visible */}
        <div className="flex items-center gap-1 p-1 bg-black/30 rounded-xl border border-white/5 shrink-0">
          <button
            onClick={switchToDaily}
            title="Daily puzzle"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
              !isRandom
                ? 'bg-white/10 text-white ring-1 ring-white/20'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            <Calendar className="h-3 w-3" />
            Daily
          </button>
          <button
            onClick={switchToRandom}
            title="Random movie"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
              isRandom
                ? `${theme.accentBg} ${theme.accent} ring-1 ring-current/30`
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            <Shuffle className="h-3 w-3" />
            Random
          </button>
        </div>

        {/* Language toggle — center */}
        <div className="flex-1 flex justify-center">
          <LanguageToggle value={language} onChange={setLanguage} />
        </div>

        {/* Right icons + countdown */}
        <div className="flex items-center gap-1 shrink-0">
          {!isRandom && (
            <div className="hidden sm:flex flex-col items-end mr-1">
              <span className="text-[9px] text-gray-600 uppercase tracking-widest leading-none">Next puzzle</span>
              <span className="text-xs font-mono text-gray-500 tabular-nums">{countdown}</span>
            </div>
          )}
          <button onClick={() => setShowHelp(true)} title="How to Play" aria-label="How to Play"
            className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
            <HelpCircle className="h-4.5 w-4.5" />
          </button>
          <button onClick={() => setShowStats(true)} title="My Stats" aria-label="Statistics"
            className="p-2 rounded-lg text-gray-500 hover:text-gold hover:bg-white/5 transition-colors">
            <Trophy className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      {/* ── Ticker ── */}
      <StatsTicker />

      {/* ── Game area ── */}
      <div className="w-full max-w-5xl flex-1 px-4 pt-5 pb-24">

        {/* Context strip */}
        <div className="text-center mb-5">
          <p className="text-[11px] text-gray-600 uppercase tracking-widest font-semibold mb-0.5">
            {theme.industry} · {isRandom ? 'Random Mode' : 'Daily Puzzle'}
          </p>
          {gameStatus === 'in_progress' && (
            <p className="text-sm text-gray-400">
              <span className={`font-bold ${theme.accent}`}>{5 - guesses.length}</span>
              {' '}guess{5 - guesses.length !== 1 ? 'es' : ''} left
            </p>
          )}
        </div>

        {/* Search */}
        <SearchBar
          movies={movies}
          onGuess={handleGuess}
          disabled={gameStatus !== 'in_progress'}
          lang={language}
        />

        {/* Hint poster — appears after 2 wrong guesses */}
        {gameStatus === 'in_progress' && (
          <HintPoster
            posterPath={guesses.length >= 2 ? guesses[guesses.length - 1]?.poster_path : undefined}
            wrongGuesses={wrongGuesses}
          />
        )}

        {/* Guess grid */}
        <div className="mt-5">
          <Grid guesses={guesses} />
        </div>
      </div>

      {/* ── Modals ── */}
      <HowToPlay isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <StatsModal isOpen={showStats} onClose={() => setShowStats(false)} stats={stats} />

      {/* ── End-game overlay ── */}
      {gameStatus !== 'in_progress' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-cinema-light border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl overflow-y-auto max-h-[90vh]">

            {/* Result headline */}
            {gameStatus === 'won' ? (
              <div className="text-center mb-5">
                <div className="text-5xl mb-2 animate-bounce">🍿</div>
                <h2 className="text-2xl font-black text-gold tracking-tight">BLOCKBUSTER!</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Cracked it in <span className="text-white font-bold">{guesses.length}</span> guess{guesses.length !== 1 ? 'es' : ''}
                  {stats.currentStreak > 1 && (
                    <span className="ml-2 text-gold/80">· 🔥 {stats.currentStreak}-day streak</span>
                  )}
                </p>
              </div>
            ) : (
              <div className="text-center mb-5">
                <div className="text-5xl mb-2 opacity-50">🎬</div>
                <h2 className="text-2xl font-black text-white">FLOP</h2>
                <p className="text-gray-500 text-sm mt-1">Better luck tomorrow.</p>
              </div>
            )}

            {/* Answer card */}
            {target && (
              <div className="flex gap-4 bg-black/40 border border-white/5 rounded-xl p-4 mb-5">
                {target.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w185${target.poster_path}`}
                    alt={target.title}
                    className="w-14 h-20 rounded-lg object-cover shrink-0 shadow-lg"
                  />
                ) : (
                  <div className="w-14 h-20 rounded-lg bg-gray-800 shrink-0 flex items-center justify-center text-[10px] text-gray-600">No poster</div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className={`font-bold text-base truncate ${theme.accent}`}>{target.title}</h3>
                  <p className="text-gray-500 text-xs mb-2">{target.year}</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {([['Hero', target.hero], ['Heroine', target.heroine], ['Director', target.director], ['Music', target.music]] as const).map(([role, name]) => (
                      <div key={role}>
                        <span className="text-gray-600 uppercase text-[9px] font-semibold tracking-wider">{role}</span>
                        <p className="text-white/80 font-medium leading-tight truncate">{name}</p>
                      </div>
                    ))}
                    <div className="col-span-2">
                      <span className="text-gray-600 uppercase text-[9px] font-semibold tracking-wider">Producer</span>
                      <p className="text-white/80 font-medium leading-tight truncate">{target.producer}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CTAs */}
            <div className="flex gap-2">
              <button
                onClick={playAgain}
                className="flex-1 py-3 bg-gold text-black font-bold rounded-xl hover:bg-yellow-400 active:scale-95 transition-all text-sm"
              >
                Play Again
              </button>
              {isRandom && (
                <button
                  onClick={switchToDaily}
                  className="px-4 py-3 bg-white/5 border border-white/10 text-gray-300 font-medium rounded-xl hover:bg-white/10 active:scale-95 transition-all text-sm"
                >
                  Daily
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
