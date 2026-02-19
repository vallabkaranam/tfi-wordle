
import { Movie, GuessResponse, GuessResult } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export async function fetchMovies(): Promise<Partial<Movie>[]> {
  const res = await fetch(`${API_BASE}/movies`);
  if (!res.ok) throw new Error('Failed to fetch movies');
  return res.json();
}

export async function searchMovies(query: string): Promise<Partial<Movie>[]> {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
      console.warn("Search failed");
      return [];
  }
  return res.json();
}

export async function submitGuess(movieId: number, previousAttempts: GuessResult[], seed?: number): Promise<GuessResponse> {
  const res = await fetch(`${API_BASE}/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      movie_id: movieId, 
      previous_attempts: previousAttempts,
      seed: seed 
    }),
  });
  if (!res.ok) throw new Error('Failed to submit guess');
  return res.json();
}

export async function fetchDailyMovie(): Promise<Movie> {
  const res = await fetch(`${API_BASE}/daily`);
  if (!res.ok) throw new Error('Failed to fetch daily movie');
  return res.json();
}
