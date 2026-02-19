
import os
import requests
import json
from datetime import date
import random
import threading
from typing import List, Dict, Optional, Any
from ..models.schemas import Movie

# -------------------------------------------------------------------
# CONFIG & STATE
# -------------------------------------------------------------------

TMDB_READ_TOKEN = os.getenv("TMDB_READ_TOKEN")

# Metadata file contains the deterministic gameplay data (Hero, Director, etc.)
# Schema: List of { tmdb_id, hero, heroine, director, music, producer }
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
METADATA_FILE = os.path.join(BASE_DIR, "data", "tollywood_metadata.json")

# Singleton In-Memory Cache
_MOVIES_CACHE: List[Dict[str, Any]] = []
_CACHE_LOCK = threading.RLock()


# -------------------------------------------------------------------
# METADATA LAYER
# -------------------------------------------------------------------

def _load_local_metadata() -> Dict[int, Dict[str, Any]]:
    """
    Loads the curated metadata file and returns a map keyed by tmdb_id.
    This is the source of truth for gameplay fields.
    """
    if not os.path.exists(METADATA_FILE):
        print(f"[CRITICAL] Metadata file not found at {METADATA_FILE}")
        return {}

    try:
        with open(METADATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Validate and map
            meta_map = {}
            for item in data:
                tid = item.get("tmdb_id")
                if tid:
                    meta_map[tid] = item
            print(f"[SUCCESS] Loaded {len(meta_map)} entries from metadata layer.")
            return meta_map
    except Exception as e:
        print(f"[CRITICAL] Failed to load metadata: {e}")
        return {}


# -------------------------------------------------------------------
# DATA FETCH & JOIN LOGIC
# -------------------------------------------------------------------

def _perform_data_refresh():
    """
    Fetches TMDB data and JOINS it with local metadata.
    Only movies present in BOTH sources are added to the playable pool.
    """
    global _MOVIES_CACHE
    
    # 1. Load Metadata (Gameplay fields)
    metadata_map = _load_local_metadata()
    if not metadata_map:
        print("[CRITICAL] Metadata layer is empty. Aborting data refresh.")
        return

    # 2. Fetch TMDB Data (Display fields: Title, Year, Poster)
    if not TMDB_READ_TOKEN:
        print("[CRITICAL] TMDB_READ_TOKEN missing. Cannot fetch live data.")
        return

    movies = []
    base_url = "https://api.themoviedb.org/3"
    headers = {
        "Authorization": f"Bearer {TMDB_READ_TOKEN}",
        "Content-Type": "application/json;charset=utf-8"
    }

    print("Starting TMDB fetch (Top 100)...")
    
    # 5 Pages ~ 100 movies. Should cover our curated list.
    found_ids = set()
    
    for page in range(1, 6):
        try:
            url = f"{base_url}/discover/movie"
            params = {
                "language": "en-US", # Get English (transliterated) titles
                "with_original_language": "te",
                "sort_by": "popularity.desc",
                "page": page,
                "vote_count.gte": 5
            }

            res = requests.get(url, headers=headers, params=params)
            if res.status_code != 200:
                print(f"[ERROR] TMDB Page {page} failed: {res.status_code}")
                continue
                
            results = res.json().get("results", [])
            for item in results:
                tmdb_id = item["id"]
                
                # JOIN LOGIC: Must exist in metadata map AND not already processed
                if tmdb_id in metadata_map and tmdb_id not in found_ids:
                    
                    # Filter: Released & Past Date (Safety check)
                    rel_date = item.get("release_date", "")
                    if not rel_date:
                        continue
                    try:
                        if date.fromisoformat(rel_date) > date.today():
                            continue
                    except ValueError:
                        continue

                    # ENRICHMENT
                    meta = metadata_map[tmdb_id]
                    
                    full_movie = {
                        "id": tmdb_id,
                        "title": item["title"],
                        "year": int(rel_date[:4]),
                        "language": item.get("original_language", "te"),
                        "poster_path": item.get("poster_path"),
                        
                        # Gameplay fields from Metadata Layer
                        "hero": meta["hero"],
                        "heroine": meta["heroine"],
                        "director": meta["director"],
                        "music": meta["music"],
                        "producer": meta["producer"]
                    }
                    
                    movies.append(full_movie)
                    found_ids.add(tmdb_id)
            
        except Exception as e:
            print(f"[ERROR] Exception during fetch page {page}: {e}")
            break

    # 3. Update Cache
    if not movies:
        print("[CRITICAL] Join yielded 0 movies! Check TMDB fetch or Metadata IDs.")
        return

    with _CACHE_LOCK:
        _MOVIES_CACHE = movies

    print(f"[SUCCESS] Data refresh complete. Playable movies: {len(_MOVIES_CACHE)}")
    
    # Debug: Print first movie
    print(f"[DEBUG] First entry: {_MOVIES_CACHE[0]['title']} ({_MOVIES_CACHE[0]['year']})")


def initialize_movie_data(background: bool = False):
    """
    Application startup entry point.
    """
    print("[INFO] Initializing Movie Data Layer...")
    
    if background:
        threading.Thread(target=_perform_data_refresh, daemon=True).start()
    else:
        # Blocking init (preferred for consistency)
        _perform_data_refresh()


# -------------------------------------------------------------------
# PUBLIC API
# -------------------------------------------------------------------

def fetch_top_telugu_movies() -> List[Dict[str, Any]]:
    with _CACHE_LOCK:
        return list(_MOVIES_CACHE)

def get_daily_movie() -> Dict[str, Any]:
    movies = fetch_top_telugu_movies()
    if not movies:
        return {
             "id": 0, "title": "Error: No Data", "year": 0, "language": "te",
             "hero": "", "heroine": "", "director": "", "music": "", "producer": ""
        }
        
    today = date.today()
    seed_str = f"{today.year}-{today.month}-{today.day}"
    random.seed(seed_str)
    return random.choice(movies)

def check_guess(guess_title: str, target: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    movies = fetch_top_telugu_movies()
    guess = next((m for m in movies if m["title"].lower() == guess_title.lower()), None)
    
    if not guess:
        return None
    
    # Compare fields strictly found in schema
    def val(obj, key): return obj[key] # No defaults needed, schema guarantees existence

    result = {
        "title": guess["title"],
        "poster_path": guess.get("poster_path"),
        "matches": {
            "hero": val(guess, "hero") == val(target, "hero"),
            "heroine": val(guess, "heroine") == val(target, "heroine"),
            "director": val(guess, "director") == val(target, "director"),
            "music": val(guess, "music") == val(target, "music"),
            "producer": val(guess, "producer") == val(target, "producer")
        },
        "values": {
            "hero": val(guess, "hero"),
            "heroine": val(guess, "heroine"),
            "director": val(guess, "director"),
            "music": val(guess, "music"),
            "producer": val(guess, "producer")
        }
    }
    return result
