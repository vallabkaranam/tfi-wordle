import { GuessResult, Movie } from './types';
import { getLocalDateKey } from './date';

type GameStatus = 'in_progress' | 'won' | 'lost';

export interface StoredGameState {
  guesses: GuessResult[];
  status: GameStatus;
  target: Movie | null;
}

const GAME_STATE_PREFIX = 'tfi-wordle-game';

export function getGameStorageKey(lang: string, seed?: number) {
  if (seed !== undefined) {
    return `${GAME_STATE_PREFIX}:random:${lang}:${seed}`;
  }

  return `${GAME_STATE_PREFIX}:daily:${lang}:${getLocalDateKey()}`;
}

export function loadStoredGame(lang: string, seed?: number): StoredGameState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(getGameStorageKey(lang, seed));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredGameState>;
    return {
      guesses: Array.isArray(parsed.guesses) ? parsed.guesses : [],
      status: parsed.status === 'won' || parsed.status === 'lost' ? parsed.status : 'in_progress',
      target: parsed.target ?? null,
    };
  } catch {
    return null;
  }
}

export function saveStoredGame(lang: string, state: StoredGameState, seed?: number) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(getGameStorageKey(lang, seed), JSON.stringify(state));
}

export function clearStoredGame(lang: string, seed?: number) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(getGameStorageKey(lang, seed));
}

export function buildShareText(
  status: GameStatus,
  guesses: GuessResult[],
  languageLabel: string,
  isRandom: boolean,
  origin?: string
) {
  const outcome = status === 'won' ? guesses.length.toString() : 'X';
  const header = `${languageLabel} Wordle ${isRandom ? 'Random' : getLocalDateKey()} ${outcome}/5`;
  const rows = guesses.map((guess) => {
    const roles = [
      guess.matches.hero,
      guess.matches.heroine,
      guess.matches.director,
      guess.matches.music,
      guess.matches.producer,
    ];

    return roles.map((matched) => (matched ? '🟩' : '⬛')).join('');
  });

  return [header, ...rows, `Play: ${origin || 'https://tfi-wordle.vercel.app'}`].join('\n');
}
