# 🍿 TFI Wordle - The Ultimate Indian Cinema Guessing Game

**TFI Wordle** is a viral, web-based word-style guessing game tailored for fans of Indian Cinema. Whether you're a die-hard **Tollywood** (Telugu), **Bollywood** (Hindi), or **Kollywood** (Tamil) fan, this game challenges your knowledge of actors, directors, musicians, and producers.

![TFI Wordle Logo](https://img.shields.io/badge/TFI--Wordle-Cinema-gold?style=for-the-badge)

https://tfi-wordle-frontend.onrender.com

## ✨ Features

-   **📽️ Three Film Industries**: Seamlessly toggle between Telugu, Hindi, and Tamil modes. Each mode features its own industry-specific data pool, theme, and daily puzzles.
-   **📅 Daily Puzzle & Random Mode**:
    *   **Daily**: A new deterministic puzzle every 24 hours (everyone gets the same movie).
    *   **Random**: Play infinitely! Generate unlimited random puzzles to sharpen your skills.
-   **🔍 "Universal" Search**: Our search bar is connected directly to the **TMDB (The Movie Database)** global catalog. You can find and guess almost any movie ever made.
-   **🧠 Intelligent Role Matching**: Every guess reveals how 5 key roles compare to the target:
    *   **Hero** (Lead Actor)
    *   **Heroine** (Lead Actress)
    *   **Director**
    *   **Music Director**
    *   **Producer**
-   **📊 Stats Tracking**: Built-in persistence for your win streaks, guess distributions, and total games played (saved locally).
-   **📈 Visual Progress**: A dynamic bar chart in the Stats modal visualizes your "Guess Distribution," helping you track how quickly you're solving the puzzles.
-   **🎨 Premium UI**: A sleek, dark-mode "Netflix-style" interface with glassmorphism, smooth animations (Framer Motion), and celebratory confetti.

## 🚀 Tech Stack

-   **Frontend**: Next.js 14, Tailwind CSS, Lucide Icons, Framer Motion, Canvas-Confetti.
-   **Backend**: FastAPI (Python), TMDB API Integration, Pydantic.
-   **Data**: Hybrid approach using hand-curated metadata for blockbusters and TMDB heuristics for global coverage.

## 🛠️ Getting Started

### Prerequisites

-   Python 3.10+
-   Node.js 18+
-   A **TMDB Read Access Token** (Get one at [themoviedb.org](https://www.themoviedb.org/documentation/api))

### 1. Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend` directory:
```env
TMDB_READ_TOKEN=your_token_here
CORS_ORIGINS=http://localhost:3000
```

Run the server:
```bash
export PYTHONPATH=$PYTHONPATH:$(pwd)
python3 -m backend.src.main
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env.local` file in the `frontend` directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Run the development server:
```bash
npm run dev
```

Visit `http://localhost:3000` to start playing!

## 📖 Architecture & Data Logic

### Search & Guess Resolution
TFI Wordle solves the "limited database" problem by utilizing TMDB as a real-time source of truth.
1.  **Search Bar**: Scans up to 20 pages of TMDB search results on-the-fly.
2.  **Live Enrichment**: If you guess a movie that isn't in our "Popular" cache, the backend performs a live lookup, parses the TMDB credits, and uses heuristics (e.g., gender and job titles) to identify the Hero, Heroine, and Music Director instantly.

### Multi-Language Sync
At startup, the backend:
-   Synchronously populates the **Telugu** movie pool.
-   Asynchronously (background threads) populates **Hindi** and **Tamil** pools (500 entries each).
-   If the cache is still warming up, the API uses a `Cold-Start Fallback` to fetch a high-popularity movie directly from TMDB so the user experience is never interrupted.

## 🤝 Contributing

We welcome contributions! Feel free to open an issue or submit a pull request.

---
*Created with ❤️ for Indian Cinema lovers.*
