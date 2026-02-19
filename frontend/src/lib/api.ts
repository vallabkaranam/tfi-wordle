
import { Movie, GuessResult } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export async function fetchMovies(): Promise<Partial<Movie>[]> {
  const res = await fetch(`${API_BASE}/movies`);
  if (!res.ok) throw new Error('Failed to fetch movies');
  return res.json();
}

export async function submitGuess(title: string): Promise<{ guess: GuessResult, correct: boolean }> {
  const res = await fetch(`${API_BASE}/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error('Failed to submit guess');
  return res.json();
}
