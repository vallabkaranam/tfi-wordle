
from fastapi import APIRouter, Header, HTTPException, Query, Request
from typing import List
import logging
import hmac
import os

from ..services.game_service import (
    fetch_movies_for_lang,
    get_cache_status,
    get_daily_movie,
    process_guess,
    refresh_movie_data,
    search_movies_tmdb,
    trigger_refresh_movie_data,
)
from ..models.schemas import Movie, GuessRequest, GuessResponse, TelemetryEvent

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

# Allowed language codes — validated at the router boundary so service functions
# receive only clean, trusted values.
VALID_LANGS = {'te', 'hi', 'ta'}
REFRESH_JOB_TOKEN = os.getenv("REFRESH_JOB_TOKEN")


def _validate_lang(lang: str) -> str:
    """Ensure lang is a supported ISO-639-1 code. Defaults to 'te' on invalid input."""
    return lang if lang in VALID_LANGS else 'te'


def _authorize_refresh_token(token: str | None):
    if not REFRESH_JOB_TOKEN:
        logger.warning("refresh endpoint called without REFRESH_JOB_TOKEN configured")
        return

    if not token or not hmac.compare_digest(token, REFRESH_JOB_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid refresh token")


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
    3. Compare all six fields (Hero, Heroine, Director, Music, Producer, Year).
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


@router.post("/telemetry")
def ingest_telemetry(payload: TelemetryEvent, request: Request):
    logger.info(
        "telemetry event=%s lang=%s seed=%s status=%s query_length=%s attempts=%s metadata=%s client=%s",
        payload.event,
        payload.lang,
        payload.seed,
        payload.status,
        payload.query_length,
        payload.attempts,
        payload.metadata or {},
        request.client.host if request.client else "unknown",
    )
    return {"ok": True}


@router.get("/health")
def health_check():
    status = get_cache_status()
    degraded_languages = [lang for lang, details in status["languages"].items() if details["movie_count"] == 0]
    return {
        "ok": len(degraded_languages) == 0,
        "service": "tfi-wordle-backend",
        "degraded_languages": degraded_languages,
        **status,
    }


@router.post("/admin/refresh-cache")
def refresh_cache(
    lang: str | None = Query(None, description="Optional language code to refresh"),
    x_refresh_token: str | None = Header(None),
):
    _authorize_refresh_token(x_refresh_token)
    selected_lang = _validate_lang(lang) if lang else None
    trigger_refresh_movie_data(selected_lang)
    logger.info("manual cache refresh triggered lang=%s", selected_lang or "all")
    return {"ok": True, "triggered": selected_lang or "all", "cache_status": get_cache_status()}
