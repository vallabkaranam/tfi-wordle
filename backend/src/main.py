from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from .services.game_service import initialize_movie_data
from .routers import game

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize data
    initialize_movie_data(background=True)
    yield
    # Shutdown: Clean up if needed (nothing for now)

app = FastAPI(lifespan=lifespan)

# Allow CORS for local development
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(game.router)

@app.get("/")
def read_root():
    return {"message": "Tollywood Wordle API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
