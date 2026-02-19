from pydantic import BaseModel
from typing import List, Optional, Any

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

class GuessValues(BaseModel):
    hero: str
    heroine: str
    director: str
    music: str
    producer: str
    year: int

class GuessMatches(BaseModel):
    hero: bool
    heroine: bool
    director: bool
    music: bool
    producer: bool
    year: bool

class GuessResult(BaseModel):
    id: Optional[int] = None
    title: str
    poster_path: Optional[str] = None
    values: GuessValues
    matches: GuessMatches

class GuessRequest(BaseModel):
    movie_id: int
    previous_attempts: List[GuessResult]

class GuessResponse(BaseModel):
    valid: bool
    attempts: List[GuessResult]
    remaining_attempts: int
    status: str # "in_progress", "won", "lost"
    answer: Optional[Movie] = None
