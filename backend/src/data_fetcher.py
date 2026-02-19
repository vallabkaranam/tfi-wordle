
import os
import requests
import json
from datetime import date
import random
import threading
import concurrent.futures

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
CACHE_FILE = "movies_cache.json"

# Singleton In-Memory Cache
_MOVIES_CACHE = []
_CACHE_LOCK = threading.RLock()
_FETCH_IN_PROGRESS = False

# Mock data for fallback
MOCK_MOVIES = [
    {
        "id": 1,
        "title": "Baahubali 2: The Conclusion",
        "hero": "Prabhas",
        "heroine": "Anushka Shetty",
        "director": "S. S. Rajamouli",
        "music": "M. M. Keeravani",
        "producer": "Arka Media Works",
        "poster_path": "/2CAL2433ZeIihfX1Hb2139CX0pW.jpg"
    },
    {
        "id": 2,
        "title": "RRR",
        "hero": "N. T. Rama Rao Jr.",
        "heroine": "Alia Bhatt", # Simplified to one
        "director": "S. S. Rajamouli",
        "music": "M. M. Keeravani",
        "producer": "DVV Entertainment",
        "poster_path": "/nEufeZlyAOLqO2brrs0yeF1lgXO.jpg"
    },
    {
        "id": 3,
        "title": "Pushpa: The Rise",
        "hero": "Allu Arjun",
        "heroine": "Rashmika Mandanna",
        "director": "Sukumar",
        "music": "Devi Sri Prasad",
        "producer": "Mythri Movie Makers",
        "poster_path": "/7D430eqZj8y3oVkLFfsWXGRcpEG.jpg"
    },
    {
        "id": 4,
        "title": "Ala Vaikunthapurramuloo",
        "hero": "Allu Arjun",
        "heroine": "Pooja Hegde",
        "director": "Trivikram Srinivas",
        "music": "Thaman S",
        "producer": "Geetha Arts",
        "poster_path": "/2RqiI59vO27sJj2oY69C11oO7l.jpg"
    },
    {
        "id": 5,
        "title": "Arjun Reddy",
        "hero": "Vijay Deverakonda",
        "heroine": "Shalini Pandey",
        "director": "Sandeep Reddy Vanga",
        "music": "Radhan",
        "producer": "Bhadrakali Pictures",
        "poster_path": "/ji5eUa7g4h6aJ2GFVjGshD7C1i.jpg"
    }
]

def _perform_tmdb_fetch():
    """
    Internal function to perform the actual blocking fetch.
    Updates the global cache safely.
    """
    global _MOVIES_CACHE
    
    if not TMDB_API_KEY:
        print("TMDB_API_KEY not found. Using mock data.")
        with _CACHE_LOCK:
            if not _MOVIES_CACHE:
                _MOVIES_CACHE = MOCK_MOVIES
        return

    movies = []
    base_url = "https://api.themoviedb.org/3"
    
    print("Starting background TMDB fetch...")
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
            data = res.json()
            
            for item in data.get("results", []):
                movie_id = item["id"]
                details_url = f"{base_url}/movie/{movie_id}"
                details_params = {
                    "api_key": TMDB_API_KEY,
                    "append_to_response": "credits"
                }
                details_res = requests.get(details_url, params=details_params)
                details = details_res.json()
                
                crew = details.get("credits", {}).get("crew", [])
                cast = details.get("credits", {}).get("cast", [])
                
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
                
                movies.append({
                    "id": movie_id,
                    "title": item["title"],
                    "hero": hero,
                    "heroine": heroine,
                    "director": director,
                    "music": music,
                    "producer": producer,
                    "poster_path": item["poster_path"]
                })
        except Exception as e:
            print(f"Error fetching page {page}: {e}")
            break

    # Update memory cache
    with _CACHE_LOCK:
        _MOVIES_CACHE = movies

    # Best-effort disk write
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(movies, f)
    except IOError:
        print("Warning: Could not write to cache file (read-only filesystem?)")

    print(f"TMDB fetch complete. Loaded {len(movies)} movies.")


def initialize_movie_data(background=True):
    """
    Called on startup.
    1. Tries to load from disk immediately (fast).
    2. If disk missing, triggers background fetch (slow but non-blocking).
    3. If no key, loads mocks.
    """
    global _MOVIES_CACHE, _FETCH_IN_PROGRESS

    # 1. Try disk load first
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                data = json.load(f)
                with _CACHE_LOCK:
                    _MOVIES_CACHE = data
            print(f"Loaded {len(_MOVIES_CACHE)} movies from disk cache.")
            return
        except Exception as e:
            print(f"Failed to load cache file: {e}")

    # 2. If no data, triggering fetch
    if not TMDB_API_KEY:
        print("No TMDB_API_KEY. Using mock data.")
        with _CACHE_LOCK:
            _MOVIES_CACHE = MOCK_MOVIES
        return

    # Trigger background fetch if requested
    if background:
        print("Triggering background data fetch...")
        threading.Thread(target=_perform_tmdb_fetch, daemon=True).start()
    else:
        # Blocking mode (legacy behavior support if needed)
        _perform_tmdb_fetch()


def fetch_top_telugu_movies():
    """
    Returns the current in-memory cache.
    If cache is empty (fetch in progress), returns MOCK_MOVIES as fallback to ensure app works.
    """
    with _CACHE_LOCK:
        if _MOVIES_CACHE:
            return _MOVIES_CACHE
        
        # If we are here, fetch is likely in progress or failed.
        # Return mocks so the app is usable.
        return MOCK_MOVIES

def get_daily_movie():
    movies = fetch_top_telugu_movies()
    today = date.today()
    seed_str = f"{today.year}-{today.month}-{today.day}"
    random.seed(seed_str)
    
    if not movies:
        return MOCK_MOVIES[0]
        
    return random.choice(movies)

def check_guess(guess_title, target):
    movies = fetch_top_telugu_movies()
    guess = next((m for m in movies if m["title"].lower() == guess_title.lower()), None)
    
    if not guess:
        return None
        
    result = {
        "title": guess["title"],
        "poster_path": guess["poster_path"],
        "matches": {
            "hero": guess["hero"] == target["hero"],
            "heroine": guess["heroine"] == target["heroine"],
            "director": guess["director"] == target["director"],
            "music": guess["music"] == target["music"],
            "producer": guess["producer"] == target["producer"]
        },
        "values": {
            "hero": guess["hero"],
            "heroine": guess["heroine"],
            "director": guess["director"],
            "music": guess["music"],
            "producer": guess["producer"]
        }
    }
    return result
