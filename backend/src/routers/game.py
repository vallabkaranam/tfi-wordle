
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any

from ..services.game_service import fetch_top_telugu_movies, get_daily_movie, process_guess, search_movies_tmdb
from ..models.schemas import Movie, GuessRequest, GuessResponse

router = APIRouter(prefix="/api")

@router.get("/movies", response_model=List[Movie])
def get_movies():
    """
    Returns the initial list of curated movies (Top 100).
    Used for initial suggestions in the search bar.
    """
    return fetch_top_telugu_movies()

@router.get("/search")
def search_movies(q: str = Query(..., min_length=2, description="Search term for Telugu movies")):
    """
    Proxies search requests directly to TMDB.
    Enables users to find any Telugu movie, even those not in the curated cache.
    """
    return search_movies_tmdb(q)

@router.get("/daily")
def get_daily_target_debug():
    """
    Debug endpoint to check the current target movie.
    Useful for development and verification.
    """
    target = get_daily_movie()
    return target

@router.post("/guess", response_model=GuessResponse)
def make_guess(request: GuessRequest):
    """
    Processes a user guess.
    
    Logic Flow:
    1. Retrieve the session target (seeded by date or custom seed).
    2. Resolve the guessed movie (from local cache or via live TMDB fetch).
    3. Compare fields (Hero, Heroine, etc.) and return match results.
    4. Track attempts and update game status ('won', 'lost', 'in_progress').
    """
    response = process_guess(request.movie_id, request.previous_attempts, request.seed)
    
    if not response:
        # Fails if the guess_id doesn't resolve to a valid movie
        raise HTTPException(status_code=400, detail="Movie not found or invalid ID")

    return response
