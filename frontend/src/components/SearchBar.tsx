
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Movie } from '../lib/types';
import { searchMovies } from '../lib/api';
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
export default function SearchBar({ movies: initialMovies, onGuess, disabled }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Partial<Movie>[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize Fuse.js for high-speed local string matching
  const fuse = useMemo(() => new Fuse(initialMovies, {
    keys: ['title'],
    threshold: 0.3, // Balance between exact and fuzzy matches
  }), [initialMovies]);

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
   * Search Logic:
   * - < 2 chars: Use curated suggestions.
   * - >= 2 chars: Trigger debounced API search for global Telugu movies.
   */
  useEffect(() => {
     if (!query) {
         // Show a few curated suggestions when the bar is empty but focused
         setResults(initialMovies.slice(0, 5));
         setActiveIndex(-1);
         return;
     }

     if (query.length < 2) {
         const localResults = fuse.search(query).map(r => r.item).slice(0, 5);
         setResults(localResults);
         setActiveIndex(-1);
         return;
     }

     // Debounce to prevent multiple API hits on every keystroke
     const timer = setTimeout(async () => {
         setLoading(true);
         try {
             // Fetch global results from the backend proxy
             const remoteResults = await searchMovies(query);
             setResults(remoteResults.slice(0, 10)); // Limit dropdown size
             setActiveIndex(-1); // Reset keyboard selection
         } catch (e) {
             console.error("Async Search Error:", e);
         } finally {
             setLoading(false);
         }
     }, 300);

     return () => clearTimeout(timer);
  }, [query, fuse, initialMovies]);

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
          placeholder="Search for any Telugu movie..."
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
                        <span className="text-[10px] text-gray-500 mt-0.5 font-bold uppercase tracking-tighter">Telugu Cinema</span>
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
