'use client';

import { useEffect, useRef } from 'react';

/**
 * StatsTicker — Animated Marquee Banner
 *
 * A horizontally scrolling ticker that cycles through fun Tollywood facts,
 * tips, and flavor text. Implemented purely in CSS (animation: marquee) to
 * avoid any JS overhead. Duplicated content for seamless looping.
 */

const TICKS = [
  '🎬 Every movie is a new mystery — can you crack it?',
  '🍿 Hero, Heroine, Director, Music, Producer — get all 5 green to win!',
  '🏆 Your streak resets on a loss — play every day',
  '🔍 Can\'t find a movie? Search any Telugu title from TMDB',
  '⭐ The daily puzzle resets at midnight',
  '📣 Share your emoji grid and challenge your friends!',
  '🎵 S.S. Thaman, Devi Sri Prasad, M.M. Keeravani — can you name them all?',
  '🌟 Guess in 1 for the ultimate flex',
];

export default function StatsTicker() {
  return (
    <div className="w-full overflow-hidden border-y border-white/5 bg-black/20 py-2 relative">
      {/* Gradient fade edges */}
      <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-cinema to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-cinema to-transparent z-10 pointer-events-none" />

      {/* Scrolling track — duplicated for seamless CSS loop */}
      <div className="flex animate-marquee whitespace-nowrap">
        {[...TICKS, ...TICKS].map((tick, i) => (
          <span key={i} className="text-xs text-gray-500 mx-8 shrink-0">
            {tick}
          </span>
        ))}
      </div>
    </div>
  );
}
