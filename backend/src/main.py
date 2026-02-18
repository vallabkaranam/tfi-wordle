
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from .data_fetcher import fetch_top_telugu_movies, get_daily_movie, check_guess, TMDB_API_KEY
import os

app = FastAPI()

# Allow CORS for local development
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Tollywood Wordle API"}

@app.get("/api/movies")
def get_movies():
    """Returns list of movies for search bar"""
    movies = fetch_top_telugu_movies()
    # Return minimal data for search
    return [{"id": m["id"], "title": m["title"]} for m in movies]

@app.get("/api/daily")
def get_daily_target_debug():
    """For debugging/development, returns the daily movie. In prod, maybe hide this."""
    target = get_daily_movie()
    return target

class GuessRequest(BaseModel):
    title: str

@app.post("/api/guess")
def make_guess(request: GuessRequest):
    target = get_daily_movie()
    result = check_guess(request.title, target)
    if not result:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    # Check if win
    is_win = request.title.lower() == target["title"].lower()
    return {"guess": result, "correct": is_win}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
