
'use client';

import { useState, useMemo } from 'react';
import { Movie } from '../lib/types';
import Fuse from 'fuse.js';
import { Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchBarProps {
  movies: Partial<Movie>[];
  onGuess: (id: number, title: string) => void;
  disabled?: boolean;
}

export default function SearchBar({ movies, onGuess, disabled }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const fuse = useMemo(() => new Fuse(movies, {
    keys: ['title'],
    threshold: 0.3,
  }), [movies]);

  const results = useMemo(() => {
    if (!query) return [];
    return fuse.search(query).map(r => r.item).slice(0, 5);
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
          <Search className="h-5 w-5 text-gray-400 group-focus-within:text-gold transition-colors" />
        </div>
        <input
          type="text"
          className={cn(
            "w-full bg-cinema-light/90 backdrop-blur-md border border-white/10 text-white pl-10 pr-4 py-3 rounded-xl shadow-2xl focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          placeholder="Search for a Telugu movie..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          disabled={disabled}
          onFocus={() => setIsOpen(true)}
        />
        
        <AnimatePresence>
          {isOpen && results.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute w-full mt-2 bg-cinema-light border border-white/10 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto"
            >
              {results.map((movie) => (
                <li key={movie.id}>
                  <button
                    className="w-full text-left px-4 py-3 text-white hover:bg-white/10 transition-colors flex items-center justify-between"
                    onClick={() => handleSelect(movie)}
                  >
                    <span>{movie.title}</span>
                    <span className="text-xs text-gray-400">{movie.year}</span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
