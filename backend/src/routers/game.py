
from fastapi import APIRouter, HTTPException, Query
from typing import List

from ..services.game_service import fetch_movies_for_lang, get_daily_movie, process_guess, search_movies_tmdb
from ..models.schemas import Movie, GuessRequest, GuessResponse

router = APIRouter(prefix="/api")

# Allowed language codes — validated at the router boundary so service functions
# receive only clean, trusted values.
VALID_LANGS = {'te', 'hi', 'ta'}


def _validate_lang(lang: str) -> str:
    """Ensure lang is a supported ISO-639-1 code. Defaults to 'te' on invalid input."""
    return lang if lang in VALID_LANGS else 'te'


@router.get("/movies", response_model=List[Movie])
def get_movies(lang: str = Query('te', description="Language code: 'te' (Telugu), 'hi' (Hindi), 'ta' (Tamil)")):
    """
    Returns the curated list of cached movies for the requested language.
    Used by the SearchBar for instant local suggestions.
    """
    return fetch_movies_for_lang(_validate_lang(lang))


@router.get("/search")
def search_movies(
    q: str = Query(..., min_length=2, description="Movie search term"),
    lang: str = Query('te', description="Language filter: 'te', 'hi', or 'ta'")
):
    """
    Proxies the search query to TMDB, filtered by the requested language.
    Returns movies matching the query in the selected film industry.
    """
    return search_movies_tmdb(q, _validate_lang(lang))


@router.get("/daily")
def get_daily_target(
    lang: str = Query('te', description="Language for the daily target"),
    seed: int = Query(None, description="Optional seed for Unlimited Mode")
):
    """
    Returns the current daily target movie for the specified language.
    Each language has its own independent daily puzzle.
    """
    return get_daily_movie(seed, _validate_lang(lang))


@router.post("/guess", response_model=GuessResponse)
def make_guess(request: GuessRequest):
    """
    Processes a user guess submission.

    Logic Flow:
    1. Retrieve the daily/seeded target for the given language.
    2. Resolve the guessed movie from cache or via live TMDB fetch.
    3. Compare all five fields (Hero, Heroine, Director, Music, Producer).
    4. Return updated attempts + game status (in_progress / won / lost).
    """
    response = process_guess(
        request.movie_id,
        request.previous_attempts,
        request.seed,
        _validate_lang(request.lang or 'te')
    )

    if not response:
        raise HTTPException(status_code=400, detail="Movie not found or invalid ID")

    return response
