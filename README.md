
# 🍿 Tollywood Wordle

A Telugu movie guessing game inspired by Wordle and Framed.

## Overview
Guess the movie based on the poster, cast, and crew!
- 5 Guesses to win
- Feedback on Hero, Heroine, Director, Music, and Producer
- Daily puzzle mode

## 🏗 Technology Stack
- **Frontend**: Next.js 13, React, TailwindCSS, Framer Motion
- **Backend**: Python FastAPI, Uvicorn
- **Data Source**: TMDB API + In-memory caching

## 🚀 Local Development

### Prerequisites
- Python 3.9+
- Node.js 18+

### 1. Backend Setup
```bash
# From root
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start Server (Auto-reload)
# Note: Run from project root for module resolution
export PYTHONPATH=$PYTHONPATH:$(pwd) && python3 -m backend.src.main
```
The API will be available at `http://localhost:8000`.

### 2. Frontend Setup
```bash
# From root
cd frontend
npm install

# Start Dev Server
npm run dev
```
Open `http://localhost:3000` to play.

## 🔑 Environment Variables

### Backend
| Variable | Description | Default |
|----------|-------------|---------|
| `TMDB_API_KEY` | Your TMDB v3 API Key | *None (Mock Data)* |
| `CORS_ORIGINS` | Allowed frontend URLs | `http://localhost:3000...` |

### Frontend
| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API Base URL | `http://localhost:8000/api` |

