from pydantic import BaseModel
from typing import List, Optional, Any, Dict, Literal

class Movie(BaseModel):
    id: int
    title: str
    year: Optional[int] = None
    language: str
    poster_path: Optional[str] = None
    hero: str
    heroine: str
    director: str
    music: str
    producer: str
    # Images for columns (profile_path)
    hero_pfp: Optional[str] = None
    heroine_pfp: Optional[str] = None
    director_pfp: Optional[str] = None
    music_pfp: Optional[str] = None
    producer_pfp: Optional[str] = None

class GuessValues(BaseModel):
    hero: str
    heroine: str
    director: str
    music: str
    producer: str
    year: Optional[int] = None
    
class GuessImages(BaseModel):
    hero: Optional[str] = None
    heroine: Optional[str] = None
    director: Optional[str] = None
    music: Optional[str] = None
    producer: Optional[str] = None

class GuessMatches(BaseModel):
    hero: bool
    heroine: bool
    director: bool
    music: bool
    producer: bool
    year: Literal['correct', 'higher', 'lower', 'unknown']

class GuessResult(BaseModel):
    id: Optional[int] = None
    title: str
    poster_path: Optional[str] = None
    values: GuessValues
    images: Optional[GuessImages] = None
    matches: GuessMatches

class GuessRequest(BaseModel):
    movie_id: int
    previous_attempts: List[GuessResult]
    seed: Optional[int] = None
    lang: Optional[str] = 'te'  # Language context: 'te' | 'hi' | 'ta'

class GuessResponse(BaseModel):
    valid: bool
    attempts: List[GuessResult]
    remaining_attempts: int
    status: str # "in_progress", "won", "lost"
    answer: Optional[Movie] = None


class TelemetryEvent(BaseModel):
    event: str
    lang: Optional[str] = None
    seed: Optional[int] = None
    status: Optional[str] = None
    query_length: Optional[int] = None
    attempts: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None
