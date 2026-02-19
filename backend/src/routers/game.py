from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any

from ..services.game_service import fetch_top_telugu_movies, get_daily_movie, process_guess, search_movies_tmdb
from ..models.schemas import Movie, GuessRequest, GuessResponse

router = APIRouter(prefix="/api")

@router.get("/movies", response_model=List[Movie])
def get_movies():
    """Returns list of curated movies (fallback/initial)"""
    return fetch_top_telugu_movies()

@router.get("/search")
def search_movies(q: str = Query(..., min_length=2)):
    """Proxies search to TMDB for any Telugu movie"""
    return search_movies_tmdb(q)

@router.get("/daily")
def get_daily_target_debug():
    """For debugging/development, returns the daily movie. In prod, maybe hide this."""
    target = get_daily_movie()
    return target

@router.post("/guess", response_model=GuessResponse)
def make_guess(request: GuessRequest):
    """
    Process a guess:
    1. Validate movie exists (in cache or fetch live)
    2. Compare with daily target
    3. Return updated attempt history and game state
    """
    response = process_guess(request.movie_id, request.previous_attempts, request.seed)
    
    if not response:
        raise HTTPException(status_code=400, detail="Invalid game state or movie not found")

    return response
