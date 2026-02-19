
"""
Game Service Layer for TFI Wordle.
Handles movie data fetching, search, and the core gameplay loop including deterministic daily selections.
"""

import os
import requests
import json
from datetime import date
import random
import threading
from typing import List, Dict, Optional, Any
from ..models.schemas import Movie, GuessResult, GuessValues, GuessImages, GuessMatches, GuessResponse

# -------------------------------------------------------------------
# CONFIG & STATE管理
# -------------------------------------------------------------------

# TMDB Read Access Token (Bearer)
TMDB_READ_TOKEN = os.getenv("TMDB_READ_TOKEN")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Metadata file containing manually curated movie data mappings for better accuracy
METADATA_FILE = os.path.join(BASE_DIR, "data", "tollywood_metadata.json")

# In-memory cache for the "Top 100" or trending Telugu movies
_MOVIES_CACHE: List[Dict[str, Any]] = []
_CACHE_LOCK = threading.RLock()

# Game configuration
MAX_ATTEMPTS = 5

# -------------------------------------------------------------------
# METADATA LAYER
# -------------------------------------------------------------------

def _load_local_metadata() -> Dict[int, Dict[str, Any]]:
    """
    Loads curated metadata from a local JSON file.
    The metadata maps TMDB IDs to specific role names (Hero, Heroine, Director, etc.) 
    which are often more accurate than parsing raw TMDB credits.
    """
    if not os.path.exists(METADATA_FILE):
        print(f"[CRITICAL] Metadata file not found at {METADATA_FILE}")
        return {}

    try:
        with open(METADATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
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
# HELPER: IMAGE EXTRACTION
# -------------------------------------------------------------------

def _extract_person_images(credits: Dict[str, Any], meta: Dict[str, Any]) -> Dict[str, Optional[str]]:
    """
    Cross-references TMDB credits with our curated metadata names to find profile images.
    
    Args:
        credits: Raw TMDB credits object (containing 'cast' and 'crew').
        meta: Curated metadata for the movie.
        
    Returns:
        A dictionary mapping role-specific image keys (e.g., 'hero_pfp') to profile paths.
    """
    images = {
        "hero_pfp": None,
        "heroine_pfp": None,
        "director_pfp": None,
        "music_pfp": None,
        "producer_pfp": None
    }
    
    # Build a lookup map: Name (lowercase) -> Profile Path
    person_map = {}
    
    # Process cast
    for p in credits.get("cast", []):
        name = p.get("name")
        path = p.get("profile_path")
        if name and path:
            person_map[name.lower()] = path
            
    # Process crew
    for p in credits.get("crew", []):
        name = p.get("name")
        path = p.get("profile_path")
        if name and path:
            person_map[name.lower()] = path

    def find_image(role_name: str) -> Optional[str]:
        """Helper to find an image for a specific name string."""
        if not role_name: return None
        role_lower = role_name.lower()
        return person_map.get(role_lower)

    # Resolve images for all key roles
    images["hero_pfp"] = find_image(meta.get("hero"))
    images["heroine_pfp"] = find_image(meta.get("heroine"))
    images["director_pfp"] = find_image(meta.get("director"))
    images["music_pfp"] = find_image(meta.get("music"))
    images["producer_pfp"] = find_image(meta.get("producer"))
    
    return images

# -------------------------------------------------------------------
# HELPER: LIVE ENRICHMENT (FOR DYNAMIC SEARCH)
# -------------------------------------------------------------------

def _enrich_from_tmdb_live(tmdb_id: int) -> Optional[Dict[str, Any]]:
    """
    Fetches full movie details and credits from TMDB on-the-fly.
    Used for movies found via global search that aren't in our curated cache.
    
    Heuristics used when metadata is missing:
    - Hero: First Male actor (gender 2)
    - Heroine: First Female actor (gender 1)
    - Director: Crew member with job 'Director'
    - Music: Crew member with job 'Original Music Composer' or 'Music'
    - Producer: Crew member with job 'Producer'
    """
    if not TMDB_READ_TOKEN: return None
    
    base_url = "https://api.themoviedb.org/3"
    headers = {
        "Authorization": f"Bearer {TMDB_READ_TOKEN}",
        "Content-Type": "application/json;charset=utf-8"
    }

    try:
        # Fetch details and append credits in a single call
        url = f"{base_url}/movie/{tmdb_id}?append_to_response=credits"
        res = requests.get(url, headers=headers)
        if res.status_code != 200: return None
        
        data = res.json()
        credits = data.get("credits", {})
        cast = credits.get("cast", [])
        crew = credits.get("crew", [])
        
        # Heuristic Initialization
        hero_val, hero_pfp_val = "Unknown", None
        heroine_val, heroine_pfp_val = "Unknown", None
        director_val, director_pfp_val = "Unknown", None
        music_val, music_pfp_val = "Unknown", None
        producer_val, producer_pfp_val = "Unknown", None

        # 1. HEROS: First significant Male cast member
        hero_actor = next((c for c in cast if c.get("gender") == 2), None)
        if not hero_actor and cast: hero_actor = cast[0] # Fallback to top billing
        if hero_actor:
            hero_val = hero_actor["name"]
            hero_pfp_val = hero_actor.get("profile_path")

        # 2. HEROINE: First significant Female cast member
        heroine_actor = next((c for c in cast if c.get("gender") == 1), None)
        if heroine_actor:
            heroine_val = heroine_actor["name"]
            heroine_pfp_val = heroine_actor.get("profile_path")
            
        # 3. DIRECTOR: Matches 'Director' role in crew
        director_crew = next((c for c in crew if c.get("job") == "Director"), None)
        if director_crew:
            director_val = director_crew["name"]
            director_pfp_val = director_crew.get("profile_path")

        # 4. MUSIC: Matches 'Original Music Composer' or 'Music' role in crew
        music_crew = next((c for c in crew if c.get("job") in ["Original Music Composer", "Music"]), None)
        if music_crew:
            music_val = music_crew["name"]
            music_pfp_val = music_crew.get("profile_path")
            
        # 5. PRODUCER: Matches 'Producer' role in crew (first one found)
        producer_crew = next((c for c in crew if c.get("job") == "Producer"), None)
        if producer_crew:
            producer_val = producer_crew["name"]
            producer_pfp_val = producer_crew.get("profile_path")

        # Basic metadata
        release_date = data.get("release_date", "")
        year = int(release_date[:4]) if release_date else 0

        return {
            "id": tmdb_id,
            "title": data["title"],
            "year": year,
            "language": data.get("original_language", "te"),
            "poster_path": data.get("poster_path"),
            "hero": hero_val,
            "heroine": heroine_val,
            "director": director_val,
            "music": music_val,
            "producer": producer_val,
            "hero_pfp": hero_pfp_val,
            "heroine_pfp": heroine_pfp_val,
            "director_pfp": director_pfp_val,
            "music_pfp": music_pfp_val,
            "producer_pfp": producer_pfp_val
        }

    except Exception as e:
        print(f"[WARN] Live fetch failed for {tmdb_id}: {e}")
        return None

# -------------------------------------------------------------------
# DATA FETCH & JOIN LOGIC (Startup Task)
# -------------------------------------------------------------------

def _perform_data_refresh():
    """
    Main background task to populate _MOVIES_CACHE.
    Fetches trending Telugu movies from TMDB and joins them with local curated metadata.
    """
    global _MOVIES_CACHE
    metadata_map = _load_local_metadata()
    if not metadata_map:
        return

    if not TMDB_READ_TOKEN:
        print("[CRITICAL] TMDB_READ_TOKEN missing.")
        return

    movies = []
    base_url = "https://api.themoviedb.org/3"
    headers = {
        "Authorization": f"Bearer {TMDB_READ_TOKEN}",
        "Content-Type": "application/json;charset=utf-8"
    }

    print("Starting background TMDB synchronization (Top 100 with Credits)...")
    found_ids = set()
    
    # Scan through several pages of trending/popular Telugu movies
    for page in range(1, 6):
        try:
            url = f"{base_url}/discover/movie"
            params = {
                "language": "en-US",
                "with_original_language": "te",
                "sort_by": "popularity.desc",
                "page": page,
                "vote_count.gte": 5 # Ensure some level of quality/data availability
            }

            res = requests.get(url, headers=headers, params=params)
            if res.status_code != 200:
                continue
                
            results = res.json().get("results", [])
            for item in results:
                tmdb_id = item["id"]
                # Only cache movies we have curated metadata for (historical Wordle mode)
                if tmdb_id in metadata_map and tmdb_id not in found_ids:
                    
                    # Filtering and validation
                    rel_date = item.get("release_date", "")
                    if not rel_date: continue
                    try:
                        # Exclude future releases
                        if date.fromisoformat(rel_date) > date.today(): continue
                    except ValueError: continue
                    
                    # Fetch extra details (credits) for image processing
                    try:
                        detail_url = f"{base_url}/movie/{tmdb_id}?append_to_response=credits"
                        detail_res = requests.get(detail_url, headers=headers)
                        
                        if detail_res.status_code == 200:
                            details = detail_res.json()
                            credits = details.get("credits", {})
                        else:
                            credits = {}
                            
                        # Resolve images using metadata name-match
                        meta = metadata_map[tmdb_id]
                        images = _extract_person_images(credits, meta)
                        
                        # Build full object
                        full_movie = {
                            "id": tmdb_id,
                            "title": item["title"],
                            "year": int(rel_date[:4]),
                            "language": item.get("original_language", "te"),
                            "poster_path": item.get("poster_path"),
                            "hero": meta["hero"],
                            "heroine": meta["heroine"],
                            "director": meta["director"],
                            "music": meta["music"],
                            "producer": meta["producer"],
                            "hero_pfp": images["hero_pfp"],
                            "heroine_pfp": images["heroine_pfp"],
                            "director_pfp": images["director_pfp"],
                            "music_pfp": images["music_pfp"],
                            "producer_pfp": images["producer_pfp"]
                        }
                        movies.append(full_movie)
                        found_ids.add(tmdb_id)
                        
                    except Exception as e:
                        print(f"[WARN] Failed to fetch details for {tmdb_id}: {e}")
                        
        except Exception as e:
            print(f"[ERROR] Exception during fetch page {page}: {e}")
            break

    if not movies:
        print("[CRITICAL] Cache refresh yielded 0 movies!")
        return

    # Thread-safe update of the global cache
    with _CACHE_LOCK:
        _MOVIES_CACHE = movies
    print(f"[SUCCESS] Core data layer updated. Playable curated movies: {len(_MOVIES_CACHE)}")

def initialize_movie_data(background: bool = False):
    """Entry point for initializing the cache. Can run asynchronously."""
    print("[INFO] Initializing Movie Data Layer...")
    if background:
        threading.Thread(target=_perform_data_refresh, daemon=True).start()
    else:
        _perform_data_refresh()

# -------------------------------------------------------------------
# PUBLIC API & GAME LOGIC
# -------------------------------------------------------------------

def fetch_top_telugu_movies() -> List[Dict[str, Any]]:
    """Returns the current list of curated cached movies."""
    with _CACHE_LOCK:
        return list(_MOVIES_CACHE)
        
def search_movies_tmdb(query: str) -> List[Dict[str, Any]]:
    """
    Proxies a search query directly to TMDB.
    Fetches up to 3 pages to find as many Telugu matches as possible within the India region.
    """
    if not TMDB_READ_TOKEN: return []
    
    url = "https://api.themoviedb.org/3/search/movie"
    headers = {
        "Authorization": f"Bearer {TMDB_READ_TOKEN}",
        "Content-Type": "application/json;charset=utf-8"
    }
    
    all_filtered = []
    for page in range(1, 4):
        params = {
            "query": query,
            "language": "en-US",
            "page": page,
            "region": "IN",
            "include_adult": False
        }
        
        try:
            res = requests.get(url, headers=headers, params=params)
            if res.status_code == 200:
                results = res.json().get("results", [])
                for m in results:
                    # Explicit language filtering to ensure the pool remains TFI-focused
                    if m.get("original_language") == "te":
                        all_filtered.append({
                            "id": m["id"],
                            "title": m["title"],
                            "year": int(m["release_date"][:4]) if m.get("release_date") else 0
                        })
                
                # Stop if we found a healthy number of matches
                if len(all_filtered) >= 15:
                    break
            else:
                break
        except Exception as e:
            print(f"[ERROR] Search failed on page {page}: {e}")
            break
            
    # Deduplicate results by TMDB ID
    seen = set()
    unique = []
    for m in all_filtered:
        if m["id"] not in seen:
            unique.append(m)
            seen.add(m["id"])
            
    return unique[:20]

def get_daily_movie(seed: Optional[int] = None) -> Dict[str, Any]:
    """
    Selects a target movie based on a mathematical seed.
    If no seed is provided, it uses the current local date (Standard Daily Mode).
    If a custom seed is provided, it uses that (Random/Unlimited Mode).
    """
    movies = fetch_top_telugu_movies()
    if not movies:
        return {"id": 0, "title": "Error - No Data"} 
        
    if seed is not None:
        random.seed(seed)
    else:
        today = date.today()
        # Seed versioning allows us to reset/change the sequence without code changes
        seed_str = f"{today.year}-{today.month}-{today.day}-v1"
        random.seed(seed_str)
        
    # Consistency across all users depends on deterministic sorting
    sorted_movies = sorted(movies, key=lambda x: x["id"])
    return random.choice(sorted_movies)

def process_guess(guess_id: int, previous_attempts: List[GuessResult], seed: Optional[int] = None) -> GuessResponse:
    """
    Main logic to handle a single guess submission.
    Calculates matches (Hero, Heroine, etc.) and determines game state (Won/Lost/In Progress).
    """
    # 1. Determine the target for the session/day
    target = get_daily_movie(seed)
    cached_movies = fetch_top_telugu_movies()
    
    # 2. Resolve the guessed movie
    # Try Cache first for speed
    guess_movie = next((m for m in cached_movies if m["id"] == guess_id), None)
    
    # fallback to live fetch for non-curated movies
    if not guess_movie:
        guess_movie = _enrich_from_tmdb_live(guess_id)
    
    if not guess_movie:
        return GuessResponse(
            valid=False,
            attempts=previous_attempts,
            remaining_attempts=MAX_ATTEMPTS - len(previous_attempts),
            status="in_progress",
            answer=None
        )

    # 3. Calculate Matches
    # Note: Strings are compared exactly as fetched.
    result = GuessResult(
        id=guess_movie["id"],
        title=guess_movie["title"],
        poster_path=guess_movie.get("poster_path"),
        values=GuessValues(
            hero=guess_movie["hero"],
            heroine=guess_movie["heroine"],
            director=guess_movie["director"],
            music=guess_movie["music"],
            producer=guess_movie["producer"]
        ),
        images=GuessImages(
            hero=guess_movie.get("hero_pfp"),
            heroine=guess_movie.get("heroine_pfp"),
            director=guess_movie.get("director_pfp"),
            music=guess_movie.get("music_pfp"),
            producer=guess_movie.get("producer_pfp")
        ),
        matches=GuessMatches(
            hero=(guess_movie["hero"] == target["hero"]),
            heroine=(guess_movie["heroine"] == target["heroine"]),
            director=(guess_movie["director"] == target["director"]),
            music=(guess_movie["music"] == target["music"]),
            producer=(guess_movie["producer"] == target["producer"])
        )
    )

    # 4. Finalize State
    new_attempts = previous_attempts + [result]
    count = len(new_attempts)
    is_win = (guess_movie["id"] == target["id"])
    
    status = "in_progress"
    revealed_answer = None

    if is_win:
        status = "won"
        revealed_answer = Movie(**target) # Reveal the full objective data
    elif count >= MAX_ATTEMPTS:
        status = "lost"
        revealed_answer = Movie(**target) # Reveal answer on loss

    return GuessResponse(
        valid=True,
        attempts=new_attempts,
        remaining_attempts=MAX_ATTEMPTS - count,
        status=status,
        answer=revealed_answer
    )
