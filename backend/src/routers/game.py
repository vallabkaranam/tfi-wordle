from fastapi import APIRouter, HTTPException
from typing import List

from ..services.game_service import fetch_top_telugu_movies, get_daily_movie, process_guess
from ..models.schemas import Movie, GuessRequest, GuessResponse

router = APIRouter(prefix="/api")

@router.get("/movies", response_model=List[Movie])
def get_movies():
    """Returns list of movies for search bar"""
    return fetch_top_telugu_movies()

@router.get("/daily")
def get_daily_target_debug():
    """For debugging/development, returns the daily movie. In prod, maybe hide this."""
    target = get_daily_movie()
    return target

@router.post("/guess", response_model=GuessResponse)
def make_guess(request: GuessRequest):
    """
    Process a guess:
    1. Validate movie exists
    2. Compare with daily target
    3. Return updated attempt history and game state
    """
    response = process_guess(request.movie_id, request.previous_attempts)
    
    if not response:
        # Should not happen given logic, but safety check
        raise HTTPException(status_code=400, detail="Invalid game state")

    return response
