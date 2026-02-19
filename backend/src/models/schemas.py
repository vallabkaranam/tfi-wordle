from pydantic import BaseModel
from typing import List, Optional, Any

class Movie(BaseModel):
    id: int
    title: str
    hero: Optional[str] = "Unknown"
    heroine: Optional[str] = "Unknown" 
    director: Optional[str] = "Unknown"
    music: Optional[str] = "Unknown"
    producer: Optional[str] = "Unknown"
    poster_path: Optional[str] = None
    language: Optional[str] = "te" # Telugu default
    year: Optional[int] = None

class GuessRequest(BaseModel):
    title: str

class GuessValues(BaseModel):
    hero: str
    heroine: str
    director: str
    music: str
    producer: str

class GuessMatches(BaseModel):
    hero: bool
    heroine: bool
    director: bool
    music: bool
    producer: bool

class GuessResult(BaseModel):
    title: str
    poster_path: Optional[str] = None
    values: GuessValues
    matches: GuessMatches

class GuessResponse(BaseModel):
    guess: GuessResult
    correct: bool
