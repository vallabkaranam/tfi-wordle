
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Movie } from '../lib/types';
import { searchMovies } from '../lib/api';
import Fuse from 'fuse.js';
import { Search } from 'lucide-react';
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

  // Still use Fuse for local fast search of initially fetched movies (Popular/Top 100)
  const fuse = useMemo(() => new Fuse(initialMovies, {
    keys: ['title'],
    threshold: 0.3,
  }), [initialMovies]);

  useEffect(() => {
     if (!query) {
         setResults([]);
         return;
     }

     if (query.length < 2) {
         // Local search only for very short queries
         const localResults = fuse.search(query).map(r => r.item).slice(0, 5);
         setResults(localResults);
         return;
     }

     const timer = setTimeout(async () => {
         setLoading(true);
         try {
             // Combine Local + Remote? 
             // Or just switch to remote for robustness?
             // Let's do Remote search to satisfy "any movie".
             const remoteResults = await searchMovies(query);
             // Maybe dedupe with local?
             // Remote is usually better for 'all movies'.
             setResults(remoteResults.slice(0, 10)); // Limit to 10
         } catch (e) {
             console.error(e);
         } finally {
             setLoading(false);
         }
     }, 300); // 300ms debounce

     return () => clearTimeout(timer);
  }, [query, fuse]);

  const handleSelect = (movie: Partial<Movie>) => {
    if (movie.id && movie.title) {
        onGuess(movie.id, movie.title);
        setQuery('');
        setIsOpen(false);
    }
  };

  return (
    <div className="sticky top-4 z-50 w-full max-w-lg mx-auto px-4">
      <div className="relative group">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className={cn("h-5 w-5 text-gray-400 group-focus-within:text-gold transition-colors", loading && "animate-pulse text-gold")} />
        </div>
        <input
          type="text"
          className={cn(
            "w-full bg-cinema-light/90 backdrop-blur-md border border-white/10 text-white pl-10 pr-4 py-3 rounded-xl shadow-2xl focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all placeholder:text-gray-500",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          placeholder="Search for any Telugu movie..."
          value={query}
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
              className="absolute w-full mt-2 bg-cinema-light border border-white/10 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto"
            >
              {loading && results.length === 0 && (
                  <li className="px-4 py-3 text-gray-500 text-sm text-center">Searching TMDB...</li>
              )}
              {results.map((movie) => (
                <li key={movie.id}>
                  <button
                    className="w-full text-left px-4 py-3 text-white hover:bg-white/10 transition-colors flex items-center justify-between group"
                    onClick={() => handleSelect(movie)}
                  >
                    <span className="font-medium group-hover:text-gold transition-colors truncate pr-2">{movie.title}</span>
                    <span className="text-xs text-gray-500 shrink-0 border border-white/10 px-1.5 py-0.5 rounded">{movie.year || '????'}</span>
                  </button>
                </li>
              ))}
              {!loading && results.length === 0 && query.length >= 2 && (
                   <li className="px-4 py-3 text-gray-500 text-sm text-center">No movies found</li>
              )}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
