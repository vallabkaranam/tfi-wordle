'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { fetchMovies, submitGuess } from '../lib/api';
import { Movie, GuessResult } from '../lib/types';
import { loadStats, recordDailyGame, GameStats } from '../lib/stats';
import { buildShareText, clearStoredGame, loadStoredGame, saveStoredGame } from '../lib/gameState';
import { canUseNativeShare, copyText } from '../lib/share';
import { trackError, trackEvent } from '../lib/telemetry';
import SearchBar from '../components/SearchBar';
import Grid from '../components/Grid';
import StatsModal from '../components/StatsModal';
import HowToPlay from '../components/HowToPlay';
import LanguageToggle, { Language } from '../components/LanguageToggle';
import { Trophy, HelpCircle, Calendar, Shuffle, Loader2, Share2, Check, Sparkles, Flame, Clapperboard, Copy } from 'lucide-react';

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
const LANG_THEME: Record<Language, { accent: string; accentBg: string; industry: string; label: string }> = {
  te: { accent: 'text-gold',       accentBg: 'bg-yellow-500/10', industry: 'Tollywood', label: 'TFI' },
  hi: { accent: 'text-orange-400', accentBg: 'bg-orange-500/10', industry: 'Bollywood', label: 'BFI' },
  ta: { accent: 'text-red-400',    accentBg: 'bg-red-500/10',    industry: 'Kollywood', label: 'KFI' },
};
const MAX_ATTEMPTS = 6;

const HERO_COPY: Record<Language, { title: string; blurb: string; chips: string[] }> = {
  te: {
    title: 'Decode the Telugu movie from the people behind it.',
    blurb: 'Every guess reveals hero, heroine, director, music, producer, and year clues. It is movie nerdery with Wordle tension.',
    chips: ['Daily puzzle', 'Shareable score', 'Tollywood deep cuts'],
  },
  hi: {
    title: 'Crack the Hindi movie using cast-and-crew clues.',
    blurb: 'Search any Hindi title, compare the key roles plus year, and hunt down the answer in six shots or less.',
    chips: ['Daily puzzle', 'Bollywood mode', 'Built for bragging rights'],
  },
  ta: {
    title: 'Read the room, then guess the Tamil movie.',
    blurb: 'A fast movie puzzle where the real clue trail is hero, heroine, director, music, producer, and year.',
    chips: ['Daily puzzle', 'Kollywood mode', 'Perfect to share'],
  },
};

/**
 * Home Component
 * --------------
 * The heart of the TFI Wordle experience. Orchestrates state management
 * for different languages (Telugu, Hindi, Tamil) and game modes (Daily vs Random).
 * 
 * Features:
 * - Language Switching with industry-specific themes.
 * - Mode Toggling: Daily (seeded by date) vs Random (infinite playability).
 * - Persistence: Game statistics saved via localStorage.
 * - Visuals: Dynamic backgrounds, confetti on win, and responsive grid.
 */
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
  const [isGuessing, setIsGuessing] = useState(false);

  // UI panels
  const [showStats, setShowStats] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [stats, setStats] = useState<GameStats>(() => loadStats());
  const [copiedShare, setCopiedShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [hasLoadedStoredGame, setHasLoadedStoredGame] = useState(false);
  const hasTrackedInitialView = useRef(false);

  const countdown = useCountdown();

  // Derived: total wrong guesses (no field matched at all)
  const wrongGuesses = useMemo(() => 
    guesses.filter(g => !g.matches.hero && !g.matches.heroine && !g.matches.director && !g.matches.music && !g.matches.producer).length,
    [guesses]
  );

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
    fetchMovies(language)
      .then((loadedMovies) => {
        setMovies(loadedMovies);
        trackEvent({ event: 'movie_pool_loaded', lang: language, metadata: { count: loadedMovies.length } });
      })
      .catch((error) => {
        console.error(error);
        trackError('movie_pool_failed', error, { lang: language });
      });
    resetGame(); // Switch language → back to daily for that language
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasTrackedInitialView.current) {
      return;
    }
    hasTrackedInitialView.current = true;
    trackEvent({ event: 'page_view', lang: language, seed });
  }, [language, seed]);

  useEffect(() => {
    trackEvent({ event: 'language_changed', lang: language, seed });
  }, [language, seed]);

  useEffect(() => {
    setHasLoadedStoredGame(false);
    const storedGame = loadStoredGame(language, seed);
    if (!storedGame) {
      setGuesses([]);
      setGameStatus('in_progress');
      setTarget(null);
      setHasLoadedStoredGame(true);
      return;
    }

    setGuesses(storedGame.guesses);
    setGameStatus(storedGame.status);
    setTarget(storedGame.target);
    setHasLoadedStoredGame(true);
  }, [language, seed]);

  useEffect(() => {
    if (!hasLoadedStoredGame) {
      return;
    }
    saveStoredGame(language, { guesses, status: gameStatus, target }, seed);
  }, [language, guesses, gameStatus, target, seed, hasLoadedStoredGame]);

  useEffect(() => {
    if (!copiedShare) {
      return;
    }

    const timeout = window.setTimeout(() => setCopiedShare(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copiedShare]);

  useEffect(() => {
    if (!shareError) {
      return;
    }

    const timeout = window.setTimeout(() => setShareError(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [shareError]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleGuess = useCallback(async (id: number) => {
    setIsGuessing(true);
    try {
      const response = await submitGuess(id, guesses, seed, language);
      if (!response.valid) return;

      setGuesses(response.attempts);
      setGameStatus(response.status as typeof gameStatus);
      trackEvent({
        event: 'guess_submitted',
        lang: language,
        seed,
        status: response.status,
        attempts: response.attempts.length,
        metadata: { movie_id: id },
      });

      if (response.status === 'won') {
        if (response.answer) setTarget(response.answer);
        // Only record stats for daily mode — random games shouldn't affect streak
        if (!isRandom) {
          setStats(recordDailyGame(language, true, response.attempts.length));
        }
        triggerConfetti();
      } else if (response.status === 'lost') {
        if (response.answer) setTarget(response.answer);
        if (!isRandom) {
          setStats(recordDailyGame(language, false, response.attempts.length));
        }
      }
    } catch (err) {
      console.error('Guess error:', err);
      trackError('guess_failed', err, { lang: language, seed, previous_attempts: guesses.length });
    } finally {
      setIsGuessing(false);
    }
  }, [guesses, seed, language]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchToRandom = () => {
    trackEvent({ event: 'mode_changed', lang: language, metadata: { mode: 'random' } });
    resetGame(Math.floor(Math.random() * 1_000_000));
  };
  const switchToDaily  = () => {
    trackEvent({ event: 'mode_changed', lang: language, metadata: { mode: 'daily' } });
    resetGame(undefined);
  };
  const playAgain      = () => {
    if (seed !== undefined) {
      clearStoredGame(language, seed);
    }
    trackEvent({ event: 'play_again', lang: language, seed });
    resetGame(Math.floor(Math.random() * 1_000_000));
  };

  const handleCopyShare = useCallback(async () => {
    const shareText = buildShareText(
      gameStatus,
      guesses,
      theme.label,
      isRandom,
      typeof window !== 'undefined' ? window.location.origin : undefined
    );

    try {
      await copyText(shareText);
      trackEvent({
        event: 'result_copied',
        lang: language,
        seed,
        status: gameStatus,
        attempts: guesses.length,
        metadata: { is_random: isRandom },
      });
      setShareError(null);
      setCopiedShare(true);
    } catch (error) {
      console.error('Copy failed:', error);
      trackError('copy_failed', error, { lang: language, seed, status: gameStatus });
      setShareError('Copy failed on this browser.');
    }
  }, [gameStatus, guesses, theme.label, isRandom, language, seed]);

  const handleNativeShare = useCallback(async () => {
    const shareText = buildShareText(
      gameStatus,
      guesses,
      theme.label,
      isRandom,
      typeof window !== 'undefined' ? window.location.origin : undefined
    );

    if (!canUseNativeShare()) {
      await handleCopyShare();
      return;
    }

    try {
      await navigator.share({
        title: `${theme.label} Wordle`,
        text: shareText,
        url: typeof window !== 'undefined' ? window.location.origin : undefined,
      });
      trackEvent({
        event: 'result_shared',
        lang: language,
        seed,
        status: gameStatus,
        attempts: guesses.length,
        metadata: { is_random: isRandom },
      });
      setShareError(null);
      setCopiedShare(true);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Share failed:', error);
      trackError('share_failed', error, { lang: language, seed, status: gameStatus });
      setShareError('Share failed. Try copying instead.');
    }
  }, [gameStatus, guesses, theme.label, isRandom, language, seed, handleCopyShare]);

  async function triggerConfetti() {
    const confetti = (await import('canvas-confetti')).default;
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
  const canShare = gameStatus !== 'in_progress' && guesses.length > 0;
  const nativeShareAvailable = canUseNativeShare();
  const shareText = canShare
    ? buildShareText(
        gameStatus,
        guesses,
        theme.label,
        isRandom,
        typeof window !== 'undefined' ? window.location.origin : undefined
      )
    : '';
  const hero = HERO_COPY[language];

  return (
    <main className="flex min-h-screen flex-col items-center bg-cinema text-white font-sans">

      {/* ── Header ── */}
      <header className="w-full max-w-5xl flex items-center gap-3 py-3 px-4 border-b border-white/10 sticky top-0 bg-cinema/95 backdrop-blur-md z-40">

        {/* Brand */}
        <h1 className="text-xl font-bold tracking-tighter shrink-0 mr-1">
          <span className={theme.accent}>{theme.label}</span>
          <span className="text-white"> WORDLE</span>
        </h1>

        {/* Mode toggle — Daily / Random — prominent, always visible */}
        <div className="flex items-center gap-1 p-1 bg-black/30 rounded-xl border border-white/5 shrink-0">
          <button
            onClick={switchToDaily}
            title="Daily puzzle"
            disabled={!isRandom}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
              !isRandom
                ? 'bg-white/10 text-white ring-1 ring-white/20 cursor-default'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            <Calendar className="h-3 w-3" />
            Daily
          </button>
          <button
            onClick={switchToRandom}
            title={isRandom ? "New random movie" : "Random movie"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
              isRandom
                ? `${theme.accentBg} ${theme.accent} ring-1 ring-current/30`
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            <Shuffle className="h-3 w-3" />
            {isRandom ? 'New Random' : 'Random'}
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
      <div className="w-full max-w-5xl flex-1 px-4 pt-5 pb-24">
        <section className="mb-6 overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,215,0,0.18),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-5 sm:p-7 shadow-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-gray-300">
                <Sparkles className="h-3.5 w-3.5 text-gold" />
                Movie puzzle for actual Indian cinema fans
              </p>
              <h2 className="max-w-xl text-3xl font-black leading-tight text-white sm:text-4xl">
                {hero.title}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-gray-300 sm:text-base">
                {hero.blurb}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {hero.chips.map((chip) => (
                  <span key={chip} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-200">
                    {chip}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-left text-xs sm:min-w-[260px]">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <Clapperboard className={`mb-2 h-4 w-4 ${theme.accent}`} />
                <div className="font-bold text-white">Search any title</div>
                <div className="mt-1 text-gray-400">Pull from TMDB and local movie pools.</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <Flame className="mb-2 h-4 w-4 text-orange-400" />
                <div className="font-bold text-white">Six-column deduction</div>
                <div className="mt-1 text-gray-400">Hero, heroine, director, music, producer, year.</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <Share2 className="mb-2 h-4 w-4 text-sky-300" />
                <div className="font-bold text-white">Share the flex</div>
                <div className="mt-1 text-gray-400">Post your score after every daily win.</div>
              </div>
            </div>
          </div>
        </section>

        {/* Context strip */}
        <div className="text-center mb-5">
          <p className="text-[11px] text-gray-600 uppercase tracking-widest font-semibold mb-0.5">
            {theme.industry} · {isRandom ? 'Random Mode' : 'Daily Puzzle'}
          </p>
          {gameStatus === 'in_progress' && (
            <p className="text-sm text-gray-400">
              <span className={`font-bold ${theme.accent}`}>{MAX_ATTEMPTS - guesses.length}</span>
              {' '}guess{MAX_ATTEMPTS - guesses.length !== 1 ? 'es' : ''} left
            </p>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <SearchBar
            movies={movies}
            onGuess={handleGuess}
            disabled={gameStatus !== 'in_progress' || isGuessing}
            lang={language}
          />
          {isGuessing && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-cinema/40 backdrop-blur-[2px] rounded-xl pointer-events-none">
              <div className="flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full border border-gold/30 shadow-lg animate-pulse">
                <Loader2 className="h-4 w-4 text-gold animate-spin" />
                <span className="text-xs font-bold text-gold uppercase tracking-widest">Checking...</span>
              </div>
            </div>
          )}
        </div>

        {/* Guess grid */}
        <div className="mt-5">
          <Grid guesses={guesses} />
        </div>
      </div>

      {/* ── Modals ── */}
      <HowToPlay isOpen={showHelp} onClose={() => setShowHelp(false)} language={language} />
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
                  <Image
                    src={`https://image.tmdb.org/t/p/w185${target.poster_path}`}
                    alt={target.title}
                    width={56}
                    height={80}
                    sizes="56px"
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
                    <div className="col-span-2">
                      <span className="text-gray-600 uppercase text-[9px] font-semibold tracking-wider">Year</span>
                      <p className="text-white/80 font-medium leading-tight truncate">{target.year ?? 'Unknown'}</p>
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
                {isRandom ? 'New Random' : 'Play Random'}
              </button>
              {!isRandom && (
                <button
                  onClick={switchToRandom}
                  className="px-4 py-3 bg-white/5 border border-white/10 text-gray-300 font-medium rounded-xl hover:bg-white/10 active:scale-95 transition-all text-sm"
                >
                  Random
                </button>
              )}
              {isRandom && (
                <button
                  onClick={switchToDaily}
                  className="px-4 py-3 bg-white/5 border border-white/10 text-gray-300 font-medium rounded-xl hover:bg-white/10 active:scale-95 transition-all text-sm"
                >
                  Daily
                </button>
              )}
            </div>
            {canShare && (
              <>
                <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-gray-500">Share Preview</div>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5 text-gray-200">{shareText}</pre>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleCopyShare}
                    className="flex-1 py-3 bg-white/5 border border-white/10 text-white font-medium rounded-xl hover:bg-white/10 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
                  >
                    {copiedShare ? <Check className="h-4 w-4 text-wordle-green" /> : <Copy className="h-4 w-4" />}
                    {copiedShare ? 'Copied' : 'Copy Result'}
                  </button>
                  {nativeShareAvailable && (
                    <button
                      onClick={handleNativeShare}
                      className="flex-1 py-3 bg-white/5 border border-white/10 text-white font-medium rounded-xl hover:bg-white/10 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>
                  )}
                </div>
                {shareError && (
                  <p className="mt-2 text-center text-xs text-rose-300">{shareError}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
