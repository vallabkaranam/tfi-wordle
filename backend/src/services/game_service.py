
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
from datetime import date
import random
import threading
from typing import List, Dict, Optional, Any
from ..models.schemas import Movie, GuessResult, GuessValues, GuessImages, GuessMatches, GuessResponse

# -------------------------------------------------------------------
# CONFIGURATION & GLOBAL STATE
# -------------------------------------------------------------------

TMDB_READ_TOKEN = os.getenv("TMDB_READ_TOKEN")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Metadata file containing manually curated movie data mappings for Telugu Cinema.
# This file is used to ensure high accuracy for "Blockbuster" titles.
METADATA_FILE = os.path.join(BASE_DIR, "data", "tollywood_metadata.json")

# In-memory per-language caches to ensure fast game-play once initialized.
_MOVIES_CACHE: Dict[str, List[Dict[str, Any]]] = {'te': [], 'hi': [], 'ta': []}
_CACHE_LOCK = threading.RLock()

# Game rules
MAX_ATTEMPTS = 5
SUPPORTED_LANGS = {'te': 'Telugu', 'hi': 'Hindi', 'ta': 'Tamil'}

# -------------------------------------------------------------------
# METADATA & DATA LOADING
# -------------------------------------------------------------------

def _load_local_metadata() -> Dict[int, Dict[str, Any]]:
    """
    Retrieves the hand-curated metadata for Telugu films.
    Maps TMDB ID -> {hero, heroine, director, music, producer}.
    """
    if not os.path.exists(METADATA_FILE):
        print(f"[CRITICAL] Metadata file missing: {METADATA_FILE}")
        return {}
    try:
        with open(METADATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {item["tmdb_id"]: item for item in data if "tmdb_id" in item}
    except Exception as e:
        print(f"[CRITICAL] Metadata parse error: {e}")
        return {}

def _extract_person_images(credits: Dict[str, Any], meta: Dict[str, Any]) -> Dict[str, Optional[str]]:
    """
    Resolves profile image paths (pfp) for cast/crew by matching names from credits.
    """
    images = {k: None for k in ["hero_pfp", "heroine_pfp", "director_pfp", "music_pfp", "producer_pfp"]}
    person_map = {}
    
    # Map all cast and crew names to their profile paths for quick O(1) lookup
    for p in (credits.get("cast", []) + credits.get("crew", [])):
        name, path = p.get("name"), p.get("profile_path")
        if name and path:
            person_map[name.lower()] = path

    def find(role_key: str):
        name = meta.get(role_key)
        return person_map.get(name.lower()) if name else None

    # Link curated roles to their TMDB profile paths
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
    if not TMDB_READ_TOKEN: return None
    headers = {"Authorization": f"Bearer {TMDB_READ_TOKEN}", "Content-Type": "application/json;charset=utf-8"}

    try:
        url = f"https://api.themoviedb.org/3/movie/{tmdb_id}?append_to_response=credits"
        res = requests.get(url, headers=headers)
        if res.status_code != 200: return None
        
        data = res.json()
        credits = data.get("credits", {})
        cast, crew = credits.get("cast", []), credits.get("crew", [])
        
        # Heuristics:
        # Hero: First male actor (gender 2); Heroine: First female actor (gender 1)
        hero = next((c for c in cast if c.get("gender") == 2), cast[0] if cast else {"name": "Unknown"})
        heroine = next((c for c in cast if c.get("gender") == 1), {"name": "Unknown"})
        
        director = next((c for c in crew if c.get("job") == "Director"), {"name": "Unknown"})
        music = next((c for c in crew if c.get("job") in ["Original Music Composer", "Music"]), {"name": "Unknown"})
        producer = next((c for c in crew if c.get("job") == "Producer"), {"name": "Unknown"})

        return {
            "id": tmdb_id, "title": data["title"], "language": data.get("original_language", "te"),
            "year": int(data.get("release_date", "0000")[:4]) if data.get("release_date") else 0,
            "poster_path": data.get("poster_path"),
            "hero": hero.get("name"), "heroine": heroine.get("name"), "director": director.get("name"),
            "music": music.get("name"), "producer": producer.get("name"),
            "hero_pfp": hero.get("profile_path"), "heroine_pfp": heroine.get("profile_path"),
            "director_pfp": director.get("profile_path"), "music_pfp": music.get("profile_path"),
            "producer_pfp": producer.get("profile_path")
        }
    except Exception as e:
        print(f"[WARN] Live enrichment error for {tmdb_id}: {e}")
        return None

# -------------------------------------------------------------------
# CACHE SYNCHRONIZATION
# -------------------------------------------------------------------

def _perform_data_refresh(lang: str = 'te'):
    """
    Populates the in-memory cache for a given language.
    For Telugu, it ensures we only include the curated 'Blockbuster' set.
    For others, it pulls the top 500 popular films.
    """
    if not TMDB_READ_TOKEN: return
    headers = {"Authorization": f"Bearer {TMDB_READ_TOKEN}", "Content-Type": "application/json;charset=utf-8"}

    is_curated_lang = (lang == 'te')
    metadata_map = _load_local_metadata() if is_curated_lang else {}

    print(f"[INFO] Refreshing {SUPPORTED_LANGS.get(lang)} pool...")
    movies, found_ids = [], set()

    # Scan 25 pages (500 entries) to capture the industry's significant output
    for page in range(1, 26):
        try:
            params = {
                "with_original_language": lang, "sort_by": "popularity.desc", "page": page,
                "vote_count.gte": 5 if is_curated_lang else 50 # Lower bar for curated list
            }
            res = requests.get("https://api.themoviedb.org/3/discover/movie", headers=headers, params=params)
            if res.status_code != 200: continue

            for item in res.json().get("results", []):
                tid = item["id"]
                if tid in found_ids or (is_curated_lang and tid not in metadata_map): continue

                full_movie = None
                if is_curated_lang:
                    # Curated Path: Join metadata with TMDB images
                    detail = requests.get(f"https://api.themoviedb.org/3/movie/{tid}?append_to_response=credits", headers=headers).json()
                    images = _extract_person_images(detail.get("credits", {}), metadata_map[tid])
                    full_movie = {
                        "id": tid, "title": item["title"], "language": lang, "year": int(item.get("release_date", "0000")[:4]),
                        "poster_path": item.get("poster_path"), **metadata_map[tid], **images
                    }
                else:
                    # Generic Path: Heuristic-based resolution
                    full_movie = _enrich_from_tmdb_live(tid)
                
                if full_movie:
                    movies.append(full_movie)
                    found_ids.add(tid)
        except: continue

    with _CACHE_LOCK: _MOVIES_CACHE[lang] = movies
    print(f"[SUCCESS] {lang} pool ready: {len(movies)} movies.")

def initialize_movie_data(background: bool = False):
    """
    System Startup Hook.
    Loads Telugu in the foreground (blocks server start until ready).
    Loads Hindi/Tamil in background threads (progressive availability).
    """
    _perform_data_refresh('te') # Always foreground for immediate playability
    for l in ('hi', 'ta'):
        threading.Thread(target=_perform_data_refresh, args=(l,), daemon=True).start()

# -------------------------------------------------------------------
# PUBLIC INTERFACE & GAME LOGIC
# -------------------------------------------------------------------

def fetch_movies_for_lang(lang: str = 'te'):
    with _CACHE_LOCK: return list(_MOVIES_CACHE.get(lang, []))

def _pick_live_movie(lang: str):
    """Fallback: picks a high-popularity movie directly from TMDB for cold starts."""
    try:
        headers = {"Authorization": f"Bearer {TMDB_READ_TOKEN}"}
        res = requests.get("https://api.themoviedb.org/3/discover/movie", headers=headers, 
                           params={"with_original_language": lang, "sort_by": "popularity.desc", "vote_count.gte": 50}).json()
        ids = [m["id"] for m in res.get("results", []) if m.get("original_language") == lang]
        if ids:
            random.seed(f"{date.today()}-{lang}-live")
            return _enrich_from_tmdb_live(random.choice(ids[:10]))
    except: return None

def search_movies_tmdb(query: str, lang: str = 'te'):
    """Full-catalog search scanned across 20 pages of TMDB results."""
    if not TMDB_READ_TOKEN: return []
    headers = {"Authorization": f"Bearer {TMDB_READ_TOKEN}"}
    all_f = []
    for p in range(1, 21):
        try:
            res = requests.get("https://api.themoviedb.org/3/search/movie", headers=headers, 
                               params={"query": query, "page": p, "region": "IN"}).json()
            for m in res.get("results", []):
                if m.get("original_language") == lang:
                    all_f.append({"id": m["id"], "title": m["title"], "year": int(m.get("release_date", "0000")[:4])})
            if len(all_f) >= 40: break
        except: break
    
    unique, seen = [], set()
    for x in all_f:
        if x["id"] not in seen: unique.append(x); seen.add(x["id"])
    return unique[:20]

def get_daily_movie(seed: Optional[int] = None, lang: str = 'te'):
    """Deterministic selection for the target movie."""
    pool = fetch_movies_for_lang(lang)
    if not pool: return _pick_live_movie(lang) or {"id": 0, "title": "Empty Pool"}
    
    random.seed(seed if seed is not None else f"{date.today()}-{lang}-v1")
    return random.choice(sorted(pool, key=lambda x: x["id"]))

def process_guess(guess_id: int, prev: List[GuessResult], seed: Optional[int] = None, lang: str = 'te'):
    "Handles turn resolution logic."
    target = get_daily_movie(seed, lang)
    if not target.get("hero"): return GuessResponse(valid=False, status="in_progress", remaining_attempts=5-len(prev), attempts=prev)
    
    # Resolve guess (cache first, then live)
    pool = fetch_movies_for_lang(lang)
    movie = next((m for m in pool if m["id"] == guess_id), _enrich_from_tmdb_live(guess_id))
    
    if not movie: return GuessResponse(valid=False, status="in_progress", remaining_attempts=5-len(prev), attempts=prev)

    # Comparison Logic
    roles = ["hero", "heroine", "director", "music", "producer"]
    res = GuessResult(
        id=movie["id"], title=movie["title"], poster_path=movie.get("poster_path"),
        values=GuessValues(**{r: movie[r] for r in roles}),
        images=GuessImages(**{r: movie.get(f"{r}_pfp") for r in roles}),
        matches=GuessMatches(**{r: (movie[r] == target[r]) for r in roles})
    )

    history = prev + [res]
    is_win = (movie["id"] == target["id"])
    status = "won" if is_win else ("lost" if len(history) >= MAX_ATTEMPTS else "in_progress")
    
    return GuessResponse(
        valid=True, status=status, attempts=history, 
        remaining_attempts=MAX_ATTEMPTS - len(history),
        answer=Movie(**target) if status in ["won", "lost"] else None
    )
