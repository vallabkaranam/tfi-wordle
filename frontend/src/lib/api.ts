
import { Movie, GuessResponse, GuessResult } from './types';

/**
 * API client for TFI Wordle.
 * All functions accept a `lang` parameter ('te' | 'hi' | 'ta') and pass it
 * to the backend so every response is scoped to the correct film industry.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

/** Fetches the curated movie list for instant SearchBar suggestions. */
export async function fetchMovies(lang: string = 'te'): Promise<Partial<Movie>[]> {
  const res = await fetch(`${API_BASE}/movies?lang=${encodeURIComponent(lang)}`);
  if (!res.ok) throw new Error('Failed to fetch movies');
  return res.json();
}

/** Proxies a search query to TMDB, filtered by the selected language. */
export async function searchMovies(
  query: string,
  lang: string = 'te',
  signal?: AbortSignal
): Promise<Partial<Movie>[]> {
  const res = await fetch(
    `${API_BASE}/search?q=${encodeURIComponent(query)}&lang=${encodeURIComponent(lang)}`,
    { signal }
  );
  if (!res.ok) {
    console.warn('Search request failed');
    return [];
  }
  return res.json();
}

/**
 * Submits a guess to the backend.
 * Includes the language context so the target is always from the same language pool.
 */
export async function submitGuess(
  movieId: number,
  previousAttempts: GuessResult[],
  seed?: number,
  lang: string = 'te'
): Promise<GuessResponse> {
  const res = await fetch(`${API_BASE}/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      movie_id: movieId,
      previous_attempts: previousAttempts,
      seed: seed,
      lang: lang,
    }),
  });
  if (!res.ok) throw new Error('Failed to submit guess');
  return res.json();
}

/** Fetches the current daily target movie for a given language. */
export async function fetchDailyMovie(lang: string = 'te'): Promise<Movie> {
  const res = await fetch(`${API_BASE}/daily?lang=${encodeURIComponent(lang)}`);
  if (!res.ok) throw new Error('Failed to fetch daily movie');
  return res.json();
}
