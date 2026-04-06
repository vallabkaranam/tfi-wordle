import { GuessResult, Movie } from './types';
import { AttributionContext } from './attribution';
import { getLocalDateKey } from './date';

type GameStatus = 'in_progress' | 'won' | 'lost';

export interface StoredGameState {
  guesses: GuessResult[];
  status: GameStatus;
  target: Movie | null;
}

const GAME_STATE_PREFIX = 'tfi-wordle-game';
const DEFAULT_SITE_URL = 'https://tfi-wordle-frontend.onrender.com';

type ShareMethod = 'copy' | 'native';

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

export function buildPlayUrl({
  origin,
  lang,
  seed,
  isRandom,
  shareMethod,
  attribution,
}: {
  origin?: string;
  lang: string;
  seed?: number;
  isRandom: boolean;
  shareMethod: ShareMethod;
  attribution?: AttributionContext;
}) {
  const url = new URL(origin || DEFAULT_SITE_URL);
  const utmCampaign = attribution?.campaign || (isRandom ? 'random_challenge' : 'daily_puzzle');

  url.searchParams.set('lang', lang);
  if (isRandom && seed !== undefined) {
    url.searchParams.set('seed', String(seed));
  }
  if (attribution?.partner) {
    url.searchParams.set('partner', attribution.partner);
  }
  if (attribution?.campaign) {
    url.searchParams.set('campaign', attribution.campaign);
  }
  url.searchParams.set('ref', 'share');
  url.searchParams.set('utm_source', 'tfi_wordle');
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', utmCampaign);
  url.searchParams.set('utm_content', `${lang}_${shareMethod}`);

  return url.toString();
}

export function buildShareText(
  status: GameStatus,
  guesses: GuessResult[],
  languageLabel: string,
  isRandom: boolean,
  playUrl: string
) {
  const outcome = status === 'won' ? guesses.length.toString() : 'X';
  const header = `${languageLabel} Wordle ${isRandom ? 'Random' : getLocalDateKey()} ${outcome}/6`;
  const rows = guesses.map((guess) => {
    const cells = [
      guess.matches.hero,
      guess.matches.heroine,
      guess.matches.director,
      guess.matches.music,
      guess.matches.producer,
      guess.matches.year,
    ];

    return cells.map((matched) => {
      if (matched === true || matched === 'correct') {
        return '🟩';
      }
      if (matched === 'higher' || matched === 'lower') {
        return '🟨';
      }
      return '⬛';
    }).join('');
  });

  return [header, ...rows, `Play: ${playUrl}`].join('\n');
}
