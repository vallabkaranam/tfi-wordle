
import os
import requests
import json
from datetime import date
import random
import threading
from typing import List, Dict, Optional, Any
from ..models.schemas import Movie


TMDB_READ_TOKEN = os.getenv("TMDB_READ_TOKEN")

# Provide a fallback path relative to this file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, "data", "telugu_movies.json")

# Singleton In-Memory Cache
_MOVIES_CACHE: List[Dict[str, Any]] = []
_CACHE_LOCK = threading.RLock()

def load_fallback_data() -> List[Dict[str, Any]]:
    """
    Loads the committed JSON dataset as a fallback for DEVELOPMENT ONLY.
    Should NEVER be used in production if TMDB_READ_TOKEN is set.
    """
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                print(f"[WARNING] Loaded {len(data)} movies from LOCAL FALLBACK dataset.")
                return data
        else:
            print(f"[WARNING] Fallback dataset not found at {DATA_FILE}")
            return []
    except Exception as e:
        print(f"[ERROR] Error loading fallback dataset: {e}")
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
    Canonical Auth: TMDB_READ_TOKEN (Bearer Token)
    """
    global _MOVIES_CACHE
    
    if not TMDB_READ_TOKEN:
        print("TMDB_READ_TOKEN not found. Skipping fetch.")
        return

    movies = []
    base_url = "https://api.themoviedb.org/3"
    
    headers = {
        "Authorization": f"Bearer {TMDB_READ_TOKEN}",
        "Content-Type": "application/json;charset=utf-8"
    }

    print("Starting background TMDB fetch...")
    # Fetching top ~100 popular Telugu movies (5 pages * 20 results) to avoid startup timeout
    for page in range(1, 6):
        try:
            url = f"{base_url}/discover/movie"
            params = {
                "language": "en-US",
                "with_original_language": "te",
                "sort_by": "popularity.desc",
                "page": page,
                "page": page,
                "vote_count.gte": 5
            }

            res = requests.get(url, headers=headers, params=params)
            if res.status_code != 200:
                print(f"TMDB Error {res.status_code}: {res.text}")
                continue
                
            data = res.json()
            
            for item in data.get("results", []):
                movie_id = item["id"]
                details_url = f"{base_url}/movie/{movie_id}"
                details_params = {
                    "append_to_response": "credits"
                }

                details_res = requests.get(details_url, headers=headers, params=details_params)
                if details_res.status_code == 200:
                    details = details_res.json()
                    
                    # 1. Filter by Status (Must be released)
                    status = details.get("status", "")
                    if status != "Released":
                        continue

                    # 2. Filter out unreleased movies by date
                    release_date_str = item.get("release_date", "")
                    if not release_date_str:
                        continue 
                        
                    try:
                        release_date = date.fromisoformat(release_date_str)
                        if release_date > date.today():
                            continue
                    except ValueError:
                        continue

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

    print(f"TMDB fetch complete. Loaded {len(movies)} movies.")


def initialize_movie_data(background: bool = False):
    """
    Called on startup.
    Strategy:
    1. If TMDB_READ_TOKEN is present:
       - BLOCK and fetch data immediately.
       - If fetch fails, we DO NOT fall back. We want to fail fast or run with empty/partial data rather than stale mock data.
    2. If TMDB_READ_TOKEN is missing:
       - Load from local JSON (Dev/Offline mode).
    """
    global _MOVIES_CACHE

    if TMDB_READ_TOKEN:
        print(f"[INFO] TMDB_READ_TOKEN found. Initializing LIVE data fetch (Blocking)...")
        _perform_tmdb_fetch()
        
        # Validation: Ensure we actually got data
        with _CACHE_LOCK:
            count = len(_MOVIES_CACHE)
        
        if count == 0:
            print("[CRITICAL] TMDB fetch yielded 0 movies! Please check your token and API availability.")
        else:
            print(f"[SUCCESS] Successfully initialized with {count} movies from TMDB.")
            # Verify data quality on first item
            with _CACHE_LOCK:
                first = _MOVIES_CACHE[0]
                print(f"[DEBUG] Sample Data: ID={first.get('id')} Title='{first.get('title')}' Poster='{first.get('poster_path')}'")

    else:
        print("[WARN] No TMDB_READ_TOKEN. Using OFFLINE fallback data.")
        fallback_data = load_fallback_data()
        with _CACHE_LOCK:
            if fallback_data:
                _MOVIES_CACHE = fallback_data


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
