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
  // Images
  hero_pfp?: string;
  heroine_pfp?: string;
  director_pfp?: string;
  music_pfp?: string;
  producer_pfp?: string;
}

export interface GuessValues {
  hero: string;
  heroine: string;
  director: string;
  music: string;
  producer: string;
  year?: number;
}

export interface GuessImages {
  hero?: string;
  heroine?: string;
  director?: string;
  music?: string;
  producer?: string;
}

export interface GuessMatches {
  hero: boolean;
  heroine: boolean;
  director: boolean;
  music: boolean;
  producer: boolean;
  year: 'correct' | 'higher' | 'lower' | 'unknown';
}

export interface GuessResult {
  id?: number;
  title: string;
  poster_path?: string;
  values: GuessValues;
  matches: GuessMatches;
  images?: GuessImages;
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
