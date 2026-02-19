'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { GuessResult } from '../lib/types';

interface ShareButtonProps {
  guesses: GuessResult[];
  gameStatus: 'won' | 'lost';
  /** Display date label in the share text */
  dateLabel: string;
}

/**
 * ShareButton — One-Click Social Sharing
 *
 * Generates a classic Wordle-style emoji grid from the guess results.
 * 🟩 = correct match, ⬛ = wrong
 *
 * Copies the grid to the clipboard. Shows a brief "Copied!" confirmation.
 *
 * Example output:
 * ```
 * TFI Wordle — 19 Feb 2026
 * Guessed in 3/5 🍿
 *
 * ⬛🟩⬛⬛⬛
 * 🟩⬛⬛⬛🟩
 * 🟩🟩🟩🟩🟩
 * ```
 */
export default function ShareButton({ guesses, gameStatus, dateLabel }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const buildShareText = () => {
    // Build the emoji grid line by line
    const emojiRows = guesses.map((g) => {
      const fields: (keyof typeof g.matches)[] = ['hero', 'heroine', 'director', 'music', 'producer'];
      return fields.map((f) => (g.matches[f] ? '🟩' : '⬛')).join('');
    });

    const resultLabel =
      gameStatus === 'won'
        ? `Guessed in ${guesses.length}/5 🍿`
        : `No block today 😭 0/5`;

    const lines = [
      `TFI Wordle — ${dateLabel}`,
      resultLabel,
      '',
      ...emojiRows,
      '',
      'Play at: [INSERT LINK HERE]',
    ];

    return lines.join('\n');
  };

  const handleShare = async () => {
    const text = buildShareText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for browsers without clipboard API
      alert(text);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center justify-center gap-2 px-5 py-3 bg-wordle-green border border-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-900/30 active:scale-95"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          Copied!
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          Share
        </>
      )}
    </button>
  );
}
