
import os
import requests
import json
from datetime import date
import random

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
CACHE_FILE = "movies_cache.json"

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

def fetch_top_telugu_movies():
    """
    Fetches top 500 Telugu movies from TMDb.
    Returns a list of standardized movie objects.
    """
    if not TMDB_API_KEY:
        print("TMDB_API_KEY not found. Using mock data.")
        return MOCK_MOVIES
    
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r") as f:
            return json.load(f)

    movies = []
    base_url = "https://api.themoviedb.org/3"
    
    # We need 500 movies, 20 per page => 25 pages.
    # We'll fetch top rated or popular. Let's do popular & revenue to get well known ones.
    # Discovery API is best.
    
    for page in range(1, 26):
        try:
            url = f"{base_url}/discover/movie"
            params = {
                "api_key": TMDB_API_KEY,
                "language": "en-US", # Metadata in English
                "with_original_language": "te",
                "sort_by": "popularity.desc",
                "page": page,
                "vote_count.gte": 10 # Filter out very obscure ones
            }
            res = requests.get(url, params=params)
            data = res.json()
            
            for item in data.get("results", []):
                movie_id = item["id"]
                # Fetch details for credits
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
                
                # Production company
                prod_companies = details.get("production_companies", [])
                producer = prod_companies[0]["name"] if prod_companies else "Unknown"
                
                # Heuristics for Hero/Heroine
                # Usually first male is hero, first female is heroine, but order matters.
                # Let's take first 2 cast members.
                hero = "Unknown"
                heroine = "Unknown"
                
                if cast:
                    hero = cast[0]["name"] # Assume first bill is hero
                    if len(cast) > 1:
                        heroine = cast[1]["name"] # Assume second bill is heroine
                
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
            
    # Cache it
    with open(CACHE_FILE, "w") as f:
        json.dump(movies, f)
        
    return movies

def get_daily_movie():
    movies = fetch_top_telugu_movies()
    # Deterministic seed based on date
    today = date.today()
    # Use a hash of the date to pick an index
    seed_str = f"{today.year}-{today.month}-{today.day}"
    random.seed(seed_str)
    return random.choice(movies)

def check_guess(guess_title, target):
    movies = fetch_top_telugu_movies()
    guess = next((m for m in movies if m["title"].lower() == guess_title.lower()), None)
    
    if not guess:
        return None
        
    # Compare
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
