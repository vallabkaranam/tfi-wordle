
import os
import requests
import json
from datetime import date
import random
import threading
from typing import List, Dict, Optional, Any
from ..models.schemas import Movie

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
# Provide a fallback path relative to this file
# Assuming src/services/game_service.py -> ../data/telugu_movies.json
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, "data", "telugu_movies.json")
CACHE_FILE = "movies_cache.json"

# Singleton In-Memory Cache
_MOVIES_CACHE: List[Dict[str, Any]] = []
_CACHE_LOCK = threading.RLock()
_FETCH_IN_PROGRESS = False

def load_fallback_data() -> List[Dict[str, Any]]:
    """Loads the committed JSON dataset as a deterministic fallback."""
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                print(f"Loaded {len(data)} movies from fallback dataset.")
                return data
        else:
            print(f"Fallback dataset not found at {DATA_FILE}")
            return []
    except Exception as e:
        print(f"Error loading fallback dataset: {e}")
        return []

def _normalize_tmdb_movie(tmdb_item: Dict[str, Any], credits: Dict[str, Any], details: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes a raw TMDB result into our canonical Movie schema.
    """
    crew = credits.get("crew", [])
    cast = credits.get("cast", [])
    
    director = next((m["name"] for m in crew if m["job"] == "Director"), "Unknown")
    music = next((m["name"] for m in crew if m["job"] in ["Music", "Original Music Composer"]), "Unknown")
    
    prod_companies = details.get("production_companies", [])
    producer = prod_companies[0]["name"] if prod_companies else "Unknown"
    
    hero = "Unknown"
    heroine = "Unknown"
    
    if cast:
        hero = cast[0]["name"]
        if len(cast) > 1:
            heroine = cast[1]["name"]

    release_date = tmdb_item.get("release_date", "")
    year = int(release_date[:4]) if release_date and len(release_date) >= 4 else None

    # Matches schemas.Movie field names
    return {
        "id": tmdb_item["id"],
        "title": tmdb_item["title"],
        "hero": hero,
        "heroine": heroine,
        "director": director,
        "music": music,
        "producer": producer,
        "poster_path": tmdb_item.get("poster_path"),
        "language": tmdb_item.get("original_language", "te"),
        "year": year
    }

def _perform_tmdb_fetch():
    """
    Internal function to fetch fresh data from TMDB and update the cache.
    """
    global _MOVIES_CACHE
    
    if not TMDB_API_KEY:
        print("TMDB_API_KEY not found. Skipping fetch.")
        return

    movies = []
    base_url = "https://api.themoviedb.org/3"
    
    print("Starting background TMDB fetch...")
    # Fetching top ~500 popular Telugu movies (25 pages * 20 results)
    for page in range(1, 26):
        try:
            url = f"{base_url}/discover/movie"
            params = {
                "api_key": TMDB_API_KEY,
                "language": "en-US",
                "with_original_language": "te",
                "sort_by": "popularity.desc",
                "page": page,
                "vote_count.gte": 10
            }
            res = requests.get(url, params=params)
            if res.status_code != 200:
                print(f"TMDB Error {res.status_code}: {res.text}")
                continue
                
            data = res.json()
            
            for item in data.get("results", []):
                movie_id = item["id"]
                details_url = f"{base_url}/movie/{movie_id}"
                details_params = {
                    "api_key": TMDB_API_KEY,
                    "append_to_response": "credits"
                }
                details_res = requests.get(details_url, params=details_params)
                if details_res.status_code == 200:
                    details = details_res.json()
                    credits = details.get("credits", {})
                    
                    normalized_movie = _normalize_tmdb_movie(item, credits, details)
                    movies.append(normalized_movie)
                
        except Exception as e:
            print(f"Error fetching page {page}: {e}")
            break

    if not movies:
        print("TMDB fetch yielded no movies. Keeping existing cache.")
        return

    # Update memory cache
    with _CACHE_LOCK:
        _MOVIES_CACHE = movies

    # Best-effort disk write (cache, distinct from committed fallback)
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(movies, f)
    except IOError:
        print("Warning: Could not write to runtime cache file (read-only filesystem?)")

    print(f"TMDB fetch complete. Loaded {len(movies)} movies.")


def initialize_movie_data(background: bool = True):
    """
    Called on startup.
    Strategy:
    1. Load strictly from committed fallback (guarantees data availability).
    2. Try to load recent runtime cache (movies_cache.json) if exists (fresher data).
    3. If TMDB key exists, trigger background fetch to refresh cache.
    """
    global _MOVIES_CACHE

    # 1. Load committed fallback first (Baseline)
    fallback_data = load_fallback_data()
    with _CACHE_LOCK:
        if fallback_data:
            _MOVIES_CACHE = fallback_data
    
    # 2. Try loading runtime cache (might be fresher)
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                cached_data = json.load(f)
                if cached_data:
                    with _CACHE_LOCK:
                        _MOVIES_CACHE = cached_data
                    print(f"Loaded {len(_MOVIES_CACHE)} movies from runtime cache.")
        except Exception as e:
            print(f"Failed to load runtime cache: {e}")

    # 3. Trigger background refresh if key exists
    if TMDB_API_KEY:
        if background:
            print("Triggering background TMDB refresh...")
            threading.Thread(target=_perform_tmdb_fetch, daemon=True).start()
        else:
            _perform_tmdb_fetch()
    else:
        print("No TMDB_API_KEY. Running in offline/fallback mode.")


def fetch_top_telugu_movies() -> List[Dict[str, Any]]:
    """
    Returns the current in-memory cache.
    """
    with _CACHE_LOCK:
        return list(_MOVIES_CACHE)

def get_daily_movie() -> Dict[str, Any]:
    movies = fetch_top_telugu_movies()
    if not movies:
        # Should realistically never happen if fallback works
        return {
             "id": 0, "title": "Error: No Data", 
             "hero": "", "heroine": "", "director": "", "music": "", "producer": ""
        }
        
    today = date.today()
    # Deterministic seed based on date
    seed_str = f"{today.year}-{today.month}-{today.day}"
    random.seed(seed_str)
    
    return random.choice(movies)

def check_guess(guess_title: str, target: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    movies = fetch_top_telugu_movies()
    # Case-insensitive match
    guess = next((m for m in movies if m["title"].lower() == guess_title.lower()), None)
    
    if not guess:
        return None
    
    # Ensure all fields exist with defaults if missing
    def val(key): return guess.get(key, "Unknown")
    def target_val(key): return target.get(key, "Unknown")

    result = {
        "title": guess["title"],
        "poster_path": guess.get("poster_path"),
        "matches": {
            "hero": val("hero") == target_val("hero"),
            "heroine": val("heroine") == target_val("heroine"),
            "director": val("director") == target_val("director"),
            "music": val("music") == target_val("music"),
            "producer": val("producer") == target_val("producer")
        },
        "values": {
            "hero": val("hero"),
            "heroine": val("heroine"),
            "director": val("director"),
            "music": val("music"),
            "producer": val("producer")
        }
    }
    return result
