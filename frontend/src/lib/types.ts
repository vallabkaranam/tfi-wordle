export interface Movie {
  id: number;
  title: string;
  year: number;
  language: string;
  poster_path?: string;
  hero: string;
  heroine: string;
  director: string;
  music: string;
  producer: string;
}

export interface GuessValues {
  hero: string;
  heroine: string;
  director: string;
  music: string;
  producer: string;
  year: number;
}

export interface GuessMatches {
  hero: boolean;
  heroine: boolean;
  director: boolean;
  music: boolean;
  producer: boolean;
  year: boolean;
}

export interface GuessResult {
  id?: number;
  title: string;
  poster_path?: string;
  values: GuessValues;
  matches: GuessMatches;
}

export interface GuessResponse {
  valid: boolean;
  attempts: GuessResult[];
  remaining_attempts: number;
  status: 'in_progress' | 'won' | 'lost';
  answer?: Movie;
}

export interface GameState {
  guesses: GuessResult[];
  status: 'in_progress' | 'won' | 'lost';
  target?: Movie;
}
