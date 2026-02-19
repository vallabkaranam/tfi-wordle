/**
 * Stats Module for TFI Wordle
 *
 * Persists game statistics to localStorage so players can track progress
 * across sessions. Stats include: games played, wins, current streak, and max streak.
 *
 * Key: 'tfi-wordle-stats'
 */

export interface GameStats {
  gamesPlayed: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  /** Distribution of wins per guess count (1-indexed, key = guess number) */
  guessDistribution: Record<number, number>;
  /** ISO date string of last game played */
  lastPlayedDate: string | null;
}

const STATS_KEY = 'tfi-wordle-stats';

/** Default blank stats for a new player */
const DEFAULT_STATS: GameStats = {
  gamesPlayed: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  lastPlayedDate: null,
};

/** Load stats from localStorage, or return defaults if not found */
export function loadStats(): GameStats {
  if (typeof window === 'undefined') return DEFAULT_STATS;
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    return { ...DEFAULT_STATS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

/** Persist stats to localStorage */
export function saveStats(stats: GameStats): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

/**
 * Called after each completed game (win or loss).
 * Updates all counters and breaks streak on loss.
 */
export function recordGame(won: boolean, guessCount: number): GameStats {
  const stats = loadStats();
  const today = new Date().toISOString().slice(0, 10);

  stats.gamesPlayed += 1;
  stats.lastPlayedDate = today;

  if (won) {
    stats.wins += 1;
    stats.currentStreak += 1;
    if (stats.currentStreak > stats.maxStreak) {
      stats.maxStreak = stats.currentStreak;
    }
    // Record guess distribution (clamp to 1–5)
    const key = Math.min(Math.max(guessCount, 1), 5) as 1 | 2 | 3 | 4 | 5;
    stats.guessDistribution[key] = (stats.guessDistribution[key] ?? 0) + 1;
  } else {
    // Losing resets the streak
    stats.currentStreak = 0;
  }

  saveStats(stats);
  return stats;
}

/** Win percentage (0–100) */
export function winRate(stats: GameStats): number {
  if (stats.gamesPlayed === 0) return 0;
  return Math.round((stats.wins / stats.gamesPlayed) * 100);
}
