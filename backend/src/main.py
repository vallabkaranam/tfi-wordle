
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from .services.game_service import initialize_movie_data
from .routers import game

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles application lifecycle events.
    Startup: Triggers a background data fetch from TMDB.
    """
    # Startup: Initialize data cache asynchronously to avoid blocking server start
    initialize_movie_data(background=True)
    yield
    # Shutdown logic would go here

app = FastAPI(
    title="TFI Wordle API",
    description="Backend service for the Telugu Movie Wordle game.",
    lifespan=lifespan
)

# CORS configuration for frontend accessibility
# In production, CORS_ORIGINS should be set to the deployed frontend URL.
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register high-level routers
app.include_router(game.router)

@app.get("/")
def read_root():
    """Health check endpoint."""
    return {"message": "TFI Wordle API - Active"}

if __name__ == "__main__":
    import uvicorn
    # Entry point for local execution
    uvicorn.run(app, host="0.0.0.0", port=8000)
