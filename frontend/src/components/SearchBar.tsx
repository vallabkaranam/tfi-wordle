
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Movie } from '../lib/types';
import { searchMovies } from '../lib/api';
import { buildMovieSearchAliases, loosenMovieTitle, normalizeMovieTitle } from '../lib/search';
import { trackError, trackEvent } from '../lib/telemetry';
import { Language } from './LanguageToggle';

/** Maps language codes to human-readable industry names for UI display */
const INDUSTRY_LABEL: Record<Language, string> = {
  te: 'Telugu Cinema',
  hi: 'Hindi Cinema',
  ta: 'Tamil Cinema',
};
import Fuse from 'fuse.js';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchBarProps {
  /** List of curated movies for fast initial suggestions */
  movies: Partial<Movie>[];
  /** Callback fired when a movie is selected */
  onGuess: (id: number, title: string) => void;
  /** Disables input when the game is over */
  disabled?: boolean;
  /** Current language–scope — ensures search results match selected industry */
  lang?: Language;
}

function mergeResults(localResults: Partial<Movie>[], remoteResults: Partial<Movie>[]) {
  const merged: Partial<Movie>[] = [];
  const seen = new Set<number>();

  for (const movie of [...localResults, ...remoteResults]) {
    if (!movie.id || seen.has(movie.id)) {
      continue;
    }
    seen.add(movie.id);
    merged.push(movie);
    if (merged.length >= 10) {
      break;
    }
  }

  return merged;
}

/**
 * Intelligent Search Bar with Debounced TMDB Integration.
 * Features:
 * - Local search (via Fuse.js) for curated movies.
 * - Remote search (via TMDB API) for global movie lookup.
 * - Keyboard navigation (Arrows + Enter).
 * - Click-outside to close.
 * - Accessible focus states and loading indicators.
 */
export default function SearchBar({ movies: initialMovies, onGuess, disabled, lang = 'te' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Partial<Movie>[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  // Initialize Fuse.js for high-speed local string matching
  const searchIndex = useMemo(
    () =>
      initialMovies.map((movie) => ({
        ...movie,
        searchAliases: movie.title ? buildMovieSearchAliases(movie.title) : [],
        normalizedTitle: movie.title ? normalizeMovieTitle(movie.title) : '',
      })),
    [initialMovies]
  );

  const fuse = useMemo(() => new Fuse(searchIndex, {
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'searchAliases', weight: 0.3 },
    ],
    threshold: 0.42,
    ignoreLocation: true,
    minMatchCharLength: 2,
  }), [searchIndex]);

  // Listener to close the dropdown when clicking outside the component
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /**
   * Search logic:
   * - Empty: show cached suggestions (Fuse on initialMovies).
   * - 1 char + cache warm: local Fuse only (fast).
   * - 2+ chars, or cache still empty: debounced backend search (TMDB directly).
   */
  useEffect(() => {
    const trimmedQuery = query.trim();
    const fuzzyQuery = loosenMovieTitle(trimmedQuery);
    const localResults = trimmedQuery
      ? fuse.search(fuzzyQuery).map((result) => result.item as Partial<Movie>).slice(0, 8)
      : initialMovies.slice(0, 6);
    const currentRequestId = ++requestIdRef.current;
    const controller = new AbortController();

    setResults(localResults);
    setActiveIndex(-1);

    if (!trimmedQuery) {
      setLoading(false);
      return () => {
        controller.abort();
      };
    }

    if (trimmedQuery.length < 2) {
      setLoading(false);
      return () => {
        controller.abort();
      };
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const remoteResults = await searchMovies(trimmedQuery, lang, controller.signal);
        if (requestIdRef.current !== currentRequestId) {
          return;
        }
        trackEvent({
          event: 'search_completed',
          lang,
          query_length: trimmedQuery.length,
          metadata: { result_count: remoteResults.length },
        });
        setResults(mergeResults(localResults, remoteResults));
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Search error:', error);
          trackError('search_failed', error, { lang, query_length: trimmedQuery.length });
        }
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, fuse, initialMovies, lang]);

  const handleSelect = (movie: Partial<Movie>) => {
    if (movie.id && movie.title) {
        onGuess(movie.id, movie.title);
        setQuery('');
        setIsOpen(false);
        setActiveIndex(-1);
    }
  };

  /** Keyboard control for better UX */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="sticky top-4 z-50 w-full max-w-lg mx-auto px-4" ref={containerRef}>
      <div className="relative group">
        {/* Search Icon / Loader */}
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="h-5 w-5 text-gold animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-gold transition-colors" />
          )}
        </div>
        
        <input
          type="text"
          className={cn(
            "w-full bg-cinema-light/95 backdrop-blur-md border border-white/10 text-white pl-10 pr-4 py-3 rounded-xl shadow-2xl focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all placeholder:text-gray-500",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          placeholder={`Search for any ${INDUSTRY_LABEL[lang ?? 'te'].split(' ')[0]} movie...`}
          value={query}
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          disabled={disabled}
          onFocus={() => setIsOpen(true)}
        />
        
        {/* Dropdown Results */}
        <AnimatePresence>
          {isOpen && (results.length > 0 || loading) && (
            <motion.ul
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute w-full mt-2 bg-cinema-light/98 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto z-50"
            >
              {loading && results.length === 0 && (
                  <li className="px-4 py-8 text-gray-500 text-sm text-center italic animate-pulse">Scanning the multiverse...</li>
              )}
              
              {results.map((movie, index) => (
                <li key={`${movie.id}-${index}`}>
                  <button
                    className={cn(
                      "w-full text-left px-4 py-3 text-white transition-colors flex items-center justify-between group outline-none",
                      index === activeIndex ? "bg-gold/20 text-gold" : "hover:bg-white/5"
                    )}
                    onClick={() => handleSelect(movie)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className={cn(
                        "font-medium transition-colors truncate",
                        index === activeIndex ? "text-gold" : "text-white"
                      )}>
                        {movie.title}
                      </span>
                      {movie.year && (
                        <span className="text-[10px] text-gray-500 mt-0.5 font-bold uppercase tracking-tighter">{INDUSTRY_LABEL[lang ?? 'te']}</span>
                      )}
                    </div>
                    <span className={cn(
                      "text-xs shrink-0 border border-white/10 px-2 py-0.5 rounded tabular-nums font-mono bg-black/30",
                      index === activeIndex ? "border-gold/30 text-gold shadow-[0_0_10px_rgba(255,215,0,0.2)]" : "text-gray-500"
                    )}>
                      {movie.year || '????'}
                    </span>
                  </button>
                </li>
              ))}
              
              {!loading && results.length === 0 && query.length >= 2 && (
                   <li className="px-4 py-8 text-gray-500 text-sm text-center italic border-t border-white/5">
                     No results in TMDB for &quot;{query}&quot;.
                   </li>
              )}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
