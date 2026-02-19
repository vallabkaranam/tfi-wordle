export interface Movie {
  id: number;
  title: string;
  hero: string;
  heroine: string;
  director: string;
  music: string;
  producer: string;
  poster_path: string;
}

export interface GuessResult {
  title: string;
  poster_path: string;
  matches: {
    hero: boolean;
    heroine: boolean;
    director: boolean;
    music: boolean;
    producer: boolean;
  };
  values: {
    hero: string;
    heroine: string;
    director: string;
    music: string;
    producer: string;
  };
}

export interface GameState {
  guesses: GuessResult[];
  status: 'playing' | 'won' | 'lost';
  target?: Movie; // Revealed on end
}
