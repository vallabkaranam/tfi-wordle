
"""
TFI Wordle - Game Service Layer
===============================
This module serves as the core logic engine for the application. 
It manages:
1. Multi-language movie caching (Telugu, Hindi, Tamil).
2. Hybrid role resolution (Curated JSON metadata + Live TMDB Heuristics).
3. Deterministic "Daily" puzzle selection based on date and language.
4. "Unlimited" mode state management via random seeds.
5. High-fidelity search proxying to the TMDB global catalog.
"""

import os
import requests
import json
import logging
import re
import unicodedata
from datetime import date, datetime, timedelta
import random
import threading
from concurrent.futures import ThreadPoolExecutor
from difflib import SequenceMatcher
from typing import List, Dict, Optional, Any
from zoneinfo import ZoneInfo
from ..models.schemas import Movie, GuessResult, GuessValues, GuessImages, GuessMatches, GuessResponse

logger = logging.getLogger(__name__)

# -------------------------------------------------------------------
# CONFIGURATION & GLOBAL STATE
# -------------------------------------------------------------------

TMDB_READ_TOKEN = os.getenv("TMDB_READ_TOKEN") or os.getenv("TMDB_API_KEY")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Metadata file containing manually curated movie data mappings for Telugu Cinema.
# This file is used to ensure high accuracy for "Blockbuster" titles.
METADATA_FILE = os.path.join(BASE_DIR, "data", "tollywood_metadata.json")
CACHE_SNAPSHOT_FILE = os.path.join(BASE_DIR, "data", "movie_cache_snapshot.json")

# In-memory per-language caches to ensure fast game-play once initialized.
_MOVIES_CACHE: Dict[str, List[Dict[str, Any]]] = {'te': [], 'hi': [], 'ta': []}
_ENRICHMENT_CACHE: Dict[int, Dict[str, Any]] = {} # Global cache for non-pool movie details
_CACHE_LOCK = threading.RLock()

# Game rules
MAX_ATTEMPTS = 6
SUPPORTED_LANGS = {'te': 'Telugu', 'hi': 'Hindi', 'ta': 'Tamil'}
_INIT_LOCK = threading.RLock()
_INIT_STARTED: Dict[str, bool] = {lang: False for lang in SUPPORTED_LANGS}
_INIT_COMPLETED: Dict[str, bool] = {lang: False for lang in SUPPORTED_LANGS}
_TMDB_TIMEOUT = (3.05, 8)
_SEARCH_MAX_PAGES = 2
_SEARCH_TARGET_RESULTS = 20
_DISCOVER_PAGE_LIMIT = 25
_DISCOVER_TARGET_POOL_SIZE = 350
_DISCOVER_VOTE_FLOORS = (100, 50, 25, 10, 5)
_DISCOVER_MIN_WORKERS = 4
_DISCOVER_MAX_WORKERS = 12
_LIVE_PICK_CANDIDATE_LIMIT = 12
_CACHE_TIMEZONE = ZoneInfo(os.getenv("CACHE_REFRESH_TIMEZONE", "America/New_York"))
_CACHE_REFRESH_HOUR = int(os.getenv("CACHE_REFRESH_HOUR_ET", "6"))
_CACHE_REFRESH_MINUTE = int(os.getenv("CACHE_REFRESH_MINUTE_ET", "0"))
_CACHE_SNAPSHOT_MAX_AGE_HOURS = int(os.getenv("CACHE_SNAPSHOT_MAX_AGE_HOURS", "36"))
_MIN_LOCAL_SEARCH_RESULTS = 5
_SCHEDULER_STARTED = False
_SNAPSHOT_LOADED = False
_LAST_REFRESHED_AT: Dict[str, Optional[str]] = {lang: None for lang in SUPPORTED_LANGS}


def _normalize_search_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = value.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _loose_search_text(value: str) -> str:
    normalized = _normalize_search_text(value)
    normalized = re.sub(r"([aeiou])\1+", r"\1", normalized)
    normalized = normalized.replace("aa", "a").replace("ee", "e").replace("ii", "i").replace("oo", "o").replace("uu", "u")
    normalized = normalized.replace("bh", "b").replace("dh", "d").replace("gh", "g").replace("kh", "k").replace("ph", "f").replace("sh", "s").replace("th", "t")
    return re.sub(r"\s+", " ", normalized).strip()


def _search_forms(value: str) -> List[str]:
    forms = []
    for candidate in (
        value.strip(),
        _normalize_search_text(value),
        _loose_search_text(value),
    ):
        if candidate and candidate not in forms:
            forms.append(candidate)
    return forms


def _compact_search_text(value: str) -> str:
    return _normalize_search_text(value).replace(" ", "")


def _score_title_match(query: str, title: str) -> float:
    normalized_query = _normalize_search_text(query)
    normalized_title = _normalize_search_text(title)
    loose_query = _loose_search_text(query)
    loose_title = _loose_search_text(title)
    compact_query = normalized_query.replace(" ", "")
    compact_title = normalized_title.replace(" ", "")

    if not normalized_query or not normalized_title:
        return 0.0

    ratios = [
        SequenceMatcher(None, normalized_query, normalized_title).ratio(),
        SequenceMatcher(None, loose_query, loose_title).ratio(),
        SequenceMatcher(None, compact_query, compact_title).ratio() if compact_query and compact_title else 0.0,
    ]
    score = max(ratios)

    if normalized_title.startswith(normalized_query) or loose_title.startswith(loose_query):
        score += 0.35
    if normalized_query in normalized_title or loose_query in loose_title:
        score += 0.2

    query_tokens = set(normalized_query.split())
    title_tokens = set(normalized_title.split())
    if query_tokens and title_tokens:
        overlap = len(query_tokens & title_tokens) / len(query_tokens)
        score += overlap * 0.25

    return score


def _search_cached_movies(query: str, lang: str, limit: int = _SEARCH_TARGET_RESULTS) -> List[Dict[str, Any]]:
    pool = fetch_movies_for_lang(lang)
    if not pool:
        return []

    scored_movies = []
    for movie in pool:
        score = _score_title_match(query, movie.get("title", ""))
        if score < 0.72:
            continue
        scored_movies.append((score, movie))

    scored_movies.sort(key=lambda item: (-item[0], item[1].get("year") or 0, item[1].get("title", "").lower()))
    return [
        {
            "id": movie["id"],
            "title": movie["title"],
            "year": movie.get("year"),
            "lang": movie.get("language", lang),
        }
        for _, movie in scored_movies[:limit]
    ]


def _pool_target_size(metadata_map: Dict[int, Dict[str, Any]]) -> int:
    """Keep each language pool roughly the same size while preserving curated coverage."""
    return max(_DISCOVER_TARGET_POOL_SIZE, len(metadata_map))


def _refresh_worker_count(batch_size: int) -> int:
    return max(_DISCOVER_MIN_WORKERS, min(_DISCOVER_MAX_WORKERS, batch_size))


def _tmdb_get(path: str, headers: Dict[str, str], params: Optional[Dict[str, Any]] = None) -> Optional[requests.Response]:
    """Small wrapper so every TMDB call gets a timeout and consistent error handling."""
    try:
        response = requests.get(
            f"https://api.themoviedb.org/3/{path}",
            headers=headers,
            params=params,
            timeout=_TMDB_TIMEOUT,
        )
        if response.status_code != 200:
            logger.warning("tmdb request failed path=%s status=%s params=%s", path, response.status_code, params)
            return None
        return response
    except requests.RequestException as exc:
        logger.warning("tmdb request exception path=%s params=%s error=%s", path, params, exc)
        return None


def _snapshot_is_fresh(updated_at: Optional[str]) -> bool:
    if not updated_at:
        return False

    try:
        snapshot_time = datetime.fromisoformat(updated_at)
    except ValueError:
        return False

    if snapshot_time.tzinfo is None:
        snapshot_time = snapshot_time.replace(tzinfo=_CACHE_TIMEZONE)

    age = datetime.now(_CACHE_TIMEZONE) - snapshot_time.astimezone(_CACHE_TIMEZONE)
    return age <= timedelta(hours=_CACHE_SNAPSHOT_MAX_AGE_HOURS)


def _load_snapshot_from_disk():
    global _SNAPSHOT_LOADED

    with _CACHE_LOCK:
        if _SNAPSHOT_LOADED:
            return

    if not os.path.exists(CACHE_SNAPSHOT_FILE):
        with _CACHE_LOCK:
            _SNAPSHOT_LOADED = True
        return

    try:
        with open(CACHE_SNAPSHOT_FILE, "r", encoding="utf-8") as snapshot_file:
            payload = json.load(snapshot_file)
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("cache snapshot load failed file=%s error=%s", CACHE_SNAPSHOT_FILE, exc)
        with _CACHE_LOCK:
            _SNAPSHOT_LOADED = True
        return

    cache_payload = payload.get("languages", {})
    timestamp_payload = payload.get("updated_at", {})

    with _CACHE_LOCK:
        for lang in SUPPORTED_LANGS:
            snapshot_movies = cache_payload.get(lang)
            snapshot_updated_at = timestamp_payload.get(lang)
            if isinstance(snapshot_movies, list) and snapshot_movies and _snapshot_is_fresh(snapshot_updated_at):
                _MOVIES_CACHE[lang] = snapshot_movies
                _INIT_COMPLETED[lang] = True
                _INIT_STARTED[lang] = False
                _LAST_REFRESHED_AT[lang] = snapshot_updated_at
        _SNAPSHOT_LOADED = True


def _save_snapshot_to_disk():
    payload = {
        "updated_at": _LAST_REFRESHED_AT,
        "languages": _MOVIES_CACHE,
    }

    try:
        with open(CACHE_SNAPSHOT_FILE, "w", encoding="utf-8") as snapshot_file:
            json.dump(payload, snapshot_file, ensure_ascii=False)
    except OSError as exc:
        logger.warning("cache snapshot save failed file=%s error=%s", CACHE_SNAPSHOT_FILE, exc)


def _next_refresh_delay_seconds(now: Optional[datetime] = None) -> float:
    current = now or datetime.now(_CACHE_TIMEZONE)
    next_run = current.replace(
        hour=_CACHE_REFRESH_HOUR,
        minute=_CACHE_REFRESH_MINUTE,
        second=0,
        microsecond=0,
    )
    if next_run <= current:
        next_run += timedelta(days=1)
    return max(60.0, (next_run - current).total_seconds())


def _refresh_all_languages():
    for lang in SUPPORTED_LANGS:
        try:
            _perform_data_refresh(lang)
        except Exception:
            logger.exception("scheduled cache refresh failed lang=%s", lang)


def refresh_movie_data(lang: Optional[str] = None):
    if lang:
        _perform_data_refresh(lang)
        return {lang: len(fetch_movies_for_lang(lang))}

    _refresh_all_languages()
    return {code: len(fetch_movies_for_lang(code)) for code in SUPPORTED_LANGS}


def get_cache_status() -> Dict[str, Any]:
    _load_snapshot_from_disk()
    with _CACHE_LOCK:
        languages = {
            lang: {
                "movie_count": len(_MOVIES_CACHE.get(lang, [])),
                "updated_at": _LAST_REFRESHED_AT.get(lang),
                "fresh": _snapshot_is_fresh(_LAST_REFRESHED_AT.get(lang)),
            }
            for lang in SUPPORTED_LANGS
        }

    return {
        "languages": languages,
        "refresh_schedule": {
            "timezone": _CACHE_TIMEZONE.key,
            "hour": _CACHE_REFRESH_HOUR,
            "minute": _CACHE_REFRESH_MINUTE,
        },
    }


def _start_refresh_scheduler():
    global _SCHEDULER_STARTED

    with _INIT_LOCK:
        if _SCHEDULER_STARTED:
            return
        _SCHEDULER_STARTED = True

    def runner():
        while True:
            delay_seconds = _next_refresh_delay_seconds()
            logger.info(
                "next movie cache refresh scheduled in %.0fs at %02d:%02d %s",
                delay_seconds,
                _CACHE_REFRESH_HOUR,
                _CACHE_REFRESH_MINUTE,
                _CACHE_TIMEZONE.key,
            )
            threading.Event().wait(delay_seconds)
            _refresh_all_languages()

    threading.Thread(target=runner, daemon=True).start()

# -------------------------------------------------------------------
# METADATA & DATA LOADING
# -------------------------------------------------------------------

def _load_local_metadata() -> Dict[int, Dict[str, Any]]:
    """
    Retrieves the hand-curated metadata for Telugu films.
    Maps TMDB ID -> {hero, heroine, director, music, producer}.
    """
    if not os.path.exists(METADATA_FILE):
        return {}
    try:
        with open(METADATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {item["tmdb_id"]: item for item in data if "tmdb_id" in item}
    except:
        return {}

def _extract_person_images(credits: Dict[str, Any], meta: Dict[str, Any]) -> Dict[str, Optional[str]]:
    """
    Resolves profile image paths (pfp) for cast/crew by matching names from credits.
    """
    images = {k: None for k in ["hero_pfp", "heroine_pfp", "director_pfp", "music_pfp", "producer_pfp"]}
    person_map = {}
    
    for p in (credits.get("cast", []) + credits.get("crew", [])):
        name, path = p.get("name"), p.get("profile_path")
        if name and path:
            person_map[name.lower()] = path

    def find(role_key: str):
        name = meta.get(role_key)
        return person_map.get(name.lower()) if name else None

    images["hero_pfp"] = find("hero")
    images["heroine_pfp"] = find("heroine")
    images["director_pfp"] = find("director")
    images["music_pfp"] = find("music")
    images["producer_pfp"] = find("producer")
    
    return images

# -------------------------------------------------------------------
# TMDB LIVE INTEGRATION
# -------------------------------------------------------------------

def _enrich_from_tmdb_live(tmdb_id: int) -> Optional[Dict[str, Any]]:
    """
    The 'Universal Resolver': Fetches role data from TMDB for ANY movie.
    Uses gender-based and job-title-based heuristics to identify key roles.
    """
    if tmdb_id in _ENRICHMENT_CACHE: return _ENRICHMENT_CACHE[tmdb_id]
    if not TMDB_READ_TOKEN: return None
    headers = {"Authorization": f"Bearer {TMDB_READ_TOKEN}", "Content-Type": "application/json;charset=utf-8"}

    response = _tmdb_get(f"movie/{tmdb_id}?append_to_response=credits", headers)
    if not response:
        return None

    data = response.json()
    credits = data.get("credits", {})
    cast, crew = credits.get("cast", []), credits.get("crew", [])
    
    # Heuristics:
    hero = next((c for c in cast if c.get("gender") == 2), cast[0] if cast else {"name": "Unknown"})
    heroine = next((c for c in cast if c.get("gender") == 1), {"name": "Unknown"})
    director = next((c for c in crew if c.get("job") == "Director"), {"name": "Unknown"})
    music = next((c for c in crew if c.get("job") in ["Original Music Composer", "Music"]), {"name": "Unknown"})
    producer = next((c for c in crew if c.get("job") == "Producer"), {"name": "Unknown"})

    movie = {
        "id": tmdb_id, "title": data["title"], "language": data.get("original_language", "te"),
        "year": int(data.get("release_date", "0000")[:4]) if data.get("release_date") else 0,
        "poster_path": data.get("poster_path"),
        "hero": hero.get("name"), "heroine": heroine.get("name"), "director": director.get("name"),
        "music": music.get("name"), "producer": producer.get("name"),
        "hero_pfp": hero.get("profile_path"), "heroine_pfp": heroine.get("profile_path"),
        "director_pfp": director.get("profile_path"), "music_pfp": music.get("profile_path"),
        "producer_pfp": producer.get("profile_path")
    }
    _ENRICHMENT_CACHE[tmdb_id] = movie # Memoize
    return movie

# -------------------------------------------------------------------
# CACHE SYNCHRONIZATION
# -------------------------------------------------------------------

def _perform_data_refresh(lang: str = 'te'):
    """Populates cache for a language using parallel workers."""
    if not TMDB_READ_TOKEN:
        with _INIT_LOCK:
            _INIT_STARTED[lang] = False
        return
    headers = {"Authorization": f"Bearer {TMDB_READ_TOKEN}", "Content-Type": "application/json;charset=utf-8"}

    is_curated_lang = (lang == 'te')
    metadata_map = _load_local_metadata() if is_curated_lang else {}
    target_pool_size = _pool_target_size(metadata_map)

    print(f"[INFO] Syncing {SUPPORTED_LANGS.get(lang)} pool...")
    movies, found_ids = [], set()

    def process_item(item):
        tid = item["id"]
        if tid in found_ids:
            return None

        if is_curated_lang and tid in metadata_map:
            detail = _tmdb_get(f"movie/{tid}?append_to_response=credits", headers)
            if not detail:
                return None
            images = _extract_person_images(detail.json().get("credits", {}), metadata_map[tid])
            return {
                "id": tid,
                "title": item["title"],
                "language": lang,
                "year": int(item.get("release_date", "0000")[:4]),
                "poster_path": item.get("poster_path"),
                **metadata_map[tid],
                **images,
            }

        return _enrich_from_tmdb_live(tid)

    # Use the same widening vote thresholds for every language so the pool sizes
    # settle in the same range instead of depending on one-off language branches.
    for min_votes in _DISCOVER_VOTE_FLOORS:
        if len(found_ids) >= target_pool_size:
            break

        for page in range(1, _DISCOVER_PAGE_LIMIT + 1):
            if len(found_ids) >= target_pool_size:
                break

            params = {
                "with_original_language": lang,
                "sort_by": "popularity.desc",
                "page": page,
                "vote_count.gte": min_votes,
            }
            response = _tmdb_get("discover/movie", headers, params=params)
            if not response:
                continue

            payload = response.json()
            items = payload.get("results", [])
            if not items:
                break

            with ThreadPoolExecutor(max_workers=_refresh_worker_count(len(items))) as executor:
                for movie_data in executor.map(process_item, items):
                    if movie_data and movie_data["id"] not in found_ids:
                        movies.append(movie_data)
                        found_ids.add(movie_data["id"])
                        if len(found_ids) >= target_pool_size:
                            break

            if page >= payload.get("total_pages", page):
                break

    with _CACHE_LOCK:
        _MOVIES_CACHE[lang] = movies
        _LAST_REFRESHED_AT[lang] = datetime.now(_CACHE_TIMEZONE).isoformat()
        _save_snapshot_to_disk()
    with _INIT_LOCK:
        _INIT_COMPLETED[lang] = True
        _INIT_STARTED[lang] = False
    print(f"[SUCCESS] {lang} ready: {len(movies)} movies.")

def initialize_movie_data(background: bool = False):
    _load_snapshot_from_disk()
    _start_refresh_scheduler()
    for lang in SUPPORTED_LANGS:
        _ensure_movie_data(lang, background=background)


def _start_refresh_thread(lang: str):
    def runner():
        try:
            _perform_data_refresh(lang)
        finally:
            with _INIT_LOCK:
                if not _INIT_COMPLETED[lang]:
                    _INIT_STARTED[lang] = False

    thread = threading.Thread(target=runner, args=(), daemon=True)
    thread.start()


def _trigger_background_refresh_if_idle(lang: str):
    with _INIT_LOCK:
        if _INIT_STARTED[lang]:
            return
        _INIT_STARTED[lang] = True

    _start_refresh_thread(lang)


def _ensure_movie_data(lang: str = 'te', background: bool = True):
    _load_snapshot_from_disk()

    with _CACHE_LOCK:
        if _MOVIES_CACHE.get(lang):
            return

    with _INIT_LOCK:
        if _INIT_STARTED[lang] or _INIT_COMPLETED[lang]:
            return
        _INIT_STARTED[lang] = True

    if background:
        _start_refresh_thread(lang)
        return

    try:
        _perform_data_refresh(lang)
    except Exception:
        with _INIT_LOCK:
            _INIT_STARTED[lang] = False
        raise

# -------------------------------------------------------------------
# PUBLIC INTERFACE & GAME LOGIC
# -------------------------------------------------------------------

def fetch_movies_for_lang(lang: str = 'te'):
    _ensure_movie_data(lang, background=True)
    with _CACHE_LOCK:
        needs_refresh = not _snapshot_is_fresh(_LAST_REFRESHED_AT.get(lang))
    if needs_refresh:
        _trigger_background_refresh_if_idle(lang)
    with _CACHE_LOCK:
        return list(_MOVIES_CACHE.get(lang, []))

def _pick_live_movie(lang: str):
    headers = {"Authorization": f"Bearer {TMDB_READ_TOKEN}"}

    for min_votes in _DISCOVER_VOTE_FLOORS:
        response = _tmdb_get(
            "discover/movie",
            headers,
            params={"with_original_language": lang, "sort_by": "popularity.desc", "vote_count.gte": min_votes},
        )
        if not response:
            continue

        ids = [m["id"] for m in response.json().get("results", []) if m.get("original_language") == lang]
        if ids:
            random.seed(f"{date.today()}-{lang}-live")
            return _enrich_from_tmdb_live(random.choice(ids[:_LIVE_PICK_CANDIDATE_LIMIT]))
    return None

def search_movies_tmdb(query: str, lang: str = 'te'):
    normalized_query = query.strip()
    if len(normalized_query) < 2:
        return []

    local_results = _search_cached_movies(normalized_query, lang)
    if not TMDB_READ_TOKEN or len(local_results) >= _MIN_LOCAL_SEARCH_RESULTS:
        return local_results

    headers = {"Authorization": f"Bearer {TMDB_READ_TOKEN}"}
    unique_results: List[Dict[str, Any]] = list(local_results)
    seen = {movie["id"] for movie in local_results if movie.get("id")}

    for search_query in _search_forms(normalized_query):
        for page in range(1, _SEARCH_MAX_PAGES + 1):
            response = _tmdb_get(
                "search/movie",
                headers,
                params={"query": search_query, "page": page, "region": "IN", "include_adult": "false"},
            )
            if not response:
                break

            payload = response.json()
            for movie in payload.get("results", []):
                if movie.get("original_language") != lang:
                    continue
                movie_id = movie["id"]
                if movie_id in seen:
                    continue
                seen.add(movie_id)
                unique_results.append({
                    "id": movie_id,
                    "title": movie["title"],
                    "year": int(movie.get("release_date", "0000")[:4]) if movie.get("release_date") else None,
                    "lang": movie.get("original_language"),
                    "popularity": movie.get("popularity", 0),
                })

            if len(unique_results) >= _SEARCH_TARGET_RESULTS:
                break
            if page >= min(payload.get("total_pages", page), _SEARCH_MAX_PAGES):
                break
        if len(unique_results) >= _SEARCH_TARGET_RESULTS:
            break

    unique_results.sort(key=lambda movie: (
        -_score_title_match(normalized_query, movie["title"]),
        -(movie.get("popularity", 0) if movie.get("popularity") is not None else -1),
        movie["title"].lower(),
    ))
    return [{k: v for k, v in movie.items() if k != "popularity"} for movie in unique_results[:_SEARCH_TARGET_RESULTS]]

def get_daily_movie(seed: Optional[int] = None, lang: str = 'te'):
    pool = fetch_movies_for_lang(lang)
    if not pool: return _pick_live_movie(lang) or {"id": 0, "title": "Empty"}
    random.seed(seed if seed is not None else f"{date.today()}-{lang}-v1")
    return random.choice(sorted(pool, key=lambda x: x["id"]))

def process_guess(guess_id: int, prev: List[GuessResult], seed: Optional[int] = None, lang: str = 'te'):
    target = get_daily_movie(seed, lang)
    if not target.get("hero"): return GuessResponse(valid=False, status="in_progress", remaining_attempts=MAX_ATTEMPTS-len(prev), attempts=prev)
    movie = next((m for m in fetch_movies_for_lang(lang) if m["id"] == guess_id), _enrich_from_tmdb_live(guess_id))
    if not movie: return GuessResponse(valid=False, status="in_progress", remaining_attempts=MAX_ATTEMPTS-len(prev), attempts=prev)

    roles = ["hero", "heroine", "director", "music", "producer"]
    target_year = target.get("year")
    guess_year = movie.get("year")
    if target_year is None or guess_year is None:
        year_match = "unknown"
    elif guess_year == target_year:
        year_match = "correct"
    elif guess_year < target_year:
        year_match = "higher"
    else:
        year_match = "lower"
    res = GuessResult(
        id=movie["id"], title=movie["title"], poster_path=movie.get("poster_path"),
        values=GuessValues(**{**{r: movie[r] for r in roles}, "year": guess_year}),
        images=GuessImages(**{r: movie.get(f"{r}_pfp") for r in roles}),
        matches=GuessMatches(**{**{r: (movie[r] == target[r]) for r in roles}, "year": year_match})
    )
    history = prev + [res]
    is_win = (movie["id"] == target["id"])
    status = "won" if is_win else ("lost" if len(history) >= MAX_ATTEMPTS else "in_progress")
    return GuessResponse(valid=True, status=status, attempts=history, remaining_attempts=MAX_ATTEMPTS - len(history), answer=Movie(**target) if status in ["won", "lost"] else None)
