from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any

from ..services.game_service import fetch_top_telugu_movies, get_daily_movie, check_guess
from ..models.schemas import Movie, GuessRequest, GuessResponse, GuessResult

router = APIRouter(prefix="/api")

@router.get("/movies", response_model=List[Movie])
def get_movies():
    """Returns list of movies for search bar"""
    movies = fetch_top_telugu_movies()
    # Return minimal data for search and ensure type safety
    return [{"id": m["id"], "title": m["title"]} for m in movies]

@router.get("/daily")
def get_daily_target_debug():
    """For debugging/development, returns the daily movie. In prod, maybe hide this."""
    target = get_daily_movie()
    return target

@router.post("/guess", response_model=GuessResponse)
def make_guess(request: GuessRequest):
    target = get_daily_movie()
    result = check_guess(request.title, target)
    if not result:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    # Check if win
    is_win = request.title.lower() == target["title"].lower()
    
    # Validation against Pydantic models happens automatically
    return {"guess": result, "correct": is_win}
