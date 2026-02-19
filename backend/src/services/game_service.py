
import os
import requests
import json
from datetime import date
import random
import threading
from typing import List, Dict, Optional, Any
from ..models.schemas import Movie, GuessResult, GuessValues, GuessImages, GuessMatches, GuessResponse

# -------------------------------------------------------------------
# CONFIG & STATE
# -------------------------------------------------------------------

TMDB_READ_TOKEN = os.getenv("TMDB_READ_TOKEN")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
METADATA_FILE = os.path.join(BASE_DIR, "data", "tollywood_metadata.json")

_MOVIES_CACHE: List[Dict[str, Any]] = []
_CACHE_LOCK = threading.RLock()
MAX_ATTEMPTS = 5

# -------------------------------------------------------------------
# METADATA LAYER
# -------------------------------------------------------------------

def _load_local_metadata() -> Dict[int, Dict[str, Any]]:
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
    Tries to find profile_paths for hero, heroine, director, music, producer
    by name matching in the credits object.
    """
    images = {
        "hero_pfp": None,
        "heroine_pfp": None,
        "director_pfp": None,
        "music_pfp": None,
        "producer_pfp": None
    }
    
    # 1. Build lookup maps (Name -> Profile Path)
    # Prioritize people with profile_paths
    person_map = {}
    
    # Cast
    for p in credits.get("cast", []):
        name = p.get("name")
        path = p.get("profile_path")
        if name and path:
            person_map[name.lower()] = path
            
    # Crew
    for p in credits.get("crew", []):
        name = p.get("name")
        path = p.get("profile_path")
        if name and path:
            person_map[name.lower()] = path

    # 2. Lookup metadata names
    # Helper to check partial match or exact match
    def find_image(role_name: str) -> Optional[str]:
        if not role_name: return None
        role_lower = role_name.lower()
        
        # Exact match
        if role_lower in person_map:
            return person_map[role_lower]
            
        # Fallback: fuzzy or first name match could be dangerous, so stick to exact or very close
        # For now, strict name matching to ensure quality.
        return None

    images["hero_pfp"] = find_image(meta.get("hero"))
    images["heroine_pfp"] = find_image(meta.get("heroine"))
    images["director_pfp"] = find_image(meta.get("director"))
    images["music_pfp"] = find_image(meta.get("music"))
    images["producer_pfp"] = find_image(meta.get("producer"))
    
    return images

# -------------------------------------------------------------------
# DATA FETCH & JOIN LOGIC
# -------------------------------------------------------------------

def _perform_data_refresh():
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

    print("Starting TMDB fetch (Top 100 with Credits)...")
    found_ids = set()
    
    # Batch strategy: We might need to fetch individual details if discover doesn't give credits
    # /discover/movie DOES NOT return credits.
    # We must fetch the list first, then fetch details for each relevant one.
    # This is expensive. 30 movies = 30 API calls. But fine for startup.
    
    # Optimization: Only fetch sorted popular list, filter by metadata map, THEN fetch details.
    
    for page in range(1, 6):
        try:
            url = f"{base_url}/discover/movie"
            params = {
                "language": "en-US",
                "with_original_language": "te",
                "sort_by": "popularity.desc",
                "page": page,
                "vote_count.gte": 5
            }

            res = requests.get(url, headers=headers, params=params)
            if res.status_code != 200:
                continue
                
            results = res.json().get("results", [])
            for item in results:
                tmdb_id = item["id"]
                if tmdb_id in metadata_map and tmdb_id not in found_ids:
                    
                    # 1. Basic Filter
                    rel_date = item.get("release_date", "")
                    if not rel_date: continue
                    try:
                        if date.fromisoformat(rel_date) > date.today(): continue
                    except ValueError: continue
                    
                    # 2. Fetch Full Details + Credits for Images
                    # API Rate limiting might be an issue? sequential is slow but safe.
                    # 30-40 calls is fine.
                    try:
                        detail_url = f"{base_url}/movie/{tmdb_id}"
                        detail_params = {"append_to_response": "credits"}
                        detail_res = requests.get(detail_url, headers=headers, params=detail_params)
                        
                        if detail_res.status_code == 200:
                            details = detail_res.json()
                            credits = details.get("credits", {})
                        else:
                            # Fallback to item
                            credits = {}
                            
                        meta = metadata_map[tmdb_id]
                        images = _extract_person_images(credits, meta)
                        
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
                            
                            # Images
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
        print("[CRITICAL] Join yielded 0 movies!")
        return

    with _CACHE_LOCK:
        _MOVIES_CACHE = movies
    print(f"[SUCCESS] Data refresh complete. Playable movies: {len(_MOVIES_CACHE)}")

def initialize_movie_data(background: bool = False):
    print("[INFO] Initializing Movie Data Layer...")
    if background:
        threading.Thread(target=_perform_data_refresh, daemon=True).start()
    else:
        _perform_data_refresh()

# -------------------------------------------------------------------
# PUBLIC API & GAME LOGIC
# -------------------------------------------------------------------

def fetch_top_telugu_movies() -> List[Dict[str, Any]]:
    with _CACHE_LOCK:
        return list(_MOVIES_CACHE)

def get_daily_movie() -> Dict[str, Any]:
    movies = fetch_top_telugu_movies()
    if not movies:
        return {"id": 0, "title": "Error"} 
        
    today = date.today()
    seed_str = f"{today.year}-{today.month}-{today.day}-v1"
    random.seed(seed_str)
    sorted_movies = sorted(movies, key=lambda x: x["id"])
    return random.choice(sorted_movies)

def process_guess(guess_id: int, previous_attempts: List[GuessResult]) -> GuessResponse:
    target = get_daily_movie()
    movies = fetch_top_telugu_movies()
    
    guess_movie = next((m for m in movies if m["id"] == guess_id), None)
    
    if not guess_movie:
        return GuessResponse(
            valid=False,
            attempts=previous_attempts,
            remaining_attempts=MAX_ATTEMPTS - len(previous_attempts),
            status="in_progress",
            answer=None
        )

    # Build Result
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

    new_attempts = previous_attempts + [result]
    count = len(new_attempts)
    is_win = (guess_movie["id"] == target["id"])
    
    status = "in_progress"
    revealed_answer = None

    if is_win:
        status = "won"
        revealed_answer = Movie(**target)
    elif count >= MAX_ATTEMPTS:
        status = "lost"
        revealed_answer = Movie(**target)

    return GuessResponse(
        valid=True,
        attempts=new_attempts,
        remaining_attempts=MAX_ATTEMPTS - count,
        status=status,
        answer=revealed_answer
    )
