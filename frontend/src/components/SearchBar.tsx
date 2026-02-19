
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Movie } from '../lib/types';
import { searchMovies } from '../lib/api';
import Fuse from 'fuse.js';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchBarProps {
  movies: Partial<Movie>[];
  onGuess: (id: number, title: string) => void;
  disabled?: boolean;
}

export default function SearchBar({ movies: initialMovies, onGuess, disabled }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Partial<Movie>[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Still use Fuse for local fast search of initially fetched movies (Popular/Top 100)
  const fuse = useMemo(() => new Fuse(initialMovies, {
    keys: ['title'],
    threshold: 0.3,
  }), [initialMovies]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
     if (!query) {
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

     const timer = setTimeout(async () => {
         setLoading(true);
         try {
             const remoteResults = await searchMovies(query);
             setResults(remoteResults.slice(0, 10));
             setActiveIndex(-1);
         } catch (e) {
             console.error(e);
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
            "w-full bg-cinema-light/90 backdrop-blur-md border border-white/10 text-white pl-10 pr-4 py-3 rounded-xl shadow-2xl focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all placeholder:text-gray-500",
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
        
        <AnimatePresence>
          {isOpen && (results.length > 0 || loading) && (
            <motion.ul
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute w-full mt-2 bg-cinema-light/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto z-50"
            >
              {loading && results.length === 0 && (
                  <li className="px-4 py-6 text-gray-500 text-sm text-center italic">Searching for blockbusters...</li>
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
                    <div className="flex flex-col">
                      <span className={cn(
                        "font-medium transition-colors truncate pr-2",
                        index === activeIndex ? "text-gold" : "text-white"
                      )}>
                        {movie.title}
                      </span>
                      {movie.year && (
                        <span className="text-[10px] text-gray-500 mt-0.5">Telugu Movie</span>
                      )}
                    </div>
                    <span className={cn(
                      "text-xs shrink-0 border border-white/10 px-1.5 py-0.5 rounded tabular-nums",
                      index === activeIndex ? "border-gold/30 text-gold" : "text-gray-500"
                    )}>
                      {movie.year || '????'}
                    </span>
                  </button>
                </li>
              ))}
              {!loading && results.length === 0 && query.length >= 2 && (
                   <li className="px-4 py-6 text-gray-500 text-sm text-center italic">
                     No matches found. Try a different title.
                   </li>
              )}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
