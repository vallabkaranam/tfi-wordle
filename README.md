
# 🍿 TFI Wordle

A Wordle-style game for the Telugu Film Industry (Tollywood). Guess the hidden movie by matching its Hero, Heroine, Director, Music Director, and Producer.

## ✨ Features

- **Daily Mode**: A fixed movie every 24 hours for everyone to solve.
- **Unlimited Mode**: Generate a random seed to play as many games as you want.
- **Global Search**: Find any and every Telugu movie using the **TMDB (The Movie Database)** integration.
- **Dynamic Data Enrichment**: Real-time credit fetching and role heuristics for movies not in the core database.
- **Premium UI**: Dark mode cinema-themed interface with 3D flip animations and custom win celebrations.
- **Mobile Optimized**: Responsive grid and high-visibility comparison cards.

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Celebrations**: Canvas Confetti

### Backend
- **Framework**: FastAPI (Python)
- **Data Source**: TMDB API (The Movie Database)
- **Search**: Fuzzy lookup via Fuse.js (frontend) and TMDB live search (backend)
- **Concurrency**: Asynchronous data synchronization and thread-safe caching.

## 🏗 Architecture

The application follows a modern decoupled architecture:

1.  **Backend Services**:
    *   **Data Layer**: Synchronizes with TMDB on startup to build a curated cache of the "Top 100" Telugu movies for performance.
    *   **Search Engine**: Proxies global search requests to TMDB with regional filtering (`region=IN`).
    *   **Match Engine**: Compares guesses against targets and uses heuristics (gender/job roles) to resolve cast/crew data for obscure movies.
2.  **Frontend Components**:
    *   **Grid System**: Displays guesses in reverse chronological order.
    *   **SearchBar**: Intelligent input with debouncing and keyboard navigation.
    *   **FlipCard**: Provides Wordle-style feedback (Green/Gray) with person portraits as visual backgrounds.

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- Node.js 18+
- TMDB API Read Access Token

### Backend Setup
1.  Navigate to the `backend` directory.
2.  Create a `.env` file based on `.env.example`:
    ```bash
    TMDB_READ_TOKEN=your_token_here
    CORS_ORIGINS=http://localhost:3000
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Run the server:
    ```bash
    export PYTHONPATH=$PYTHONPATH:$(pwd)
    python3 -m src.main
    ```

### Frontend Setup
1.  Navigate to the `frontend` directory.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```
4.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔗 Deployment

The application is configured for deployment on Render (or any Docker-supported platform).

- **Production URL**: [INSERT LINK HERE]

## 📝 License
This project is for educational and entertainment purposes. Movie data provided by the TMDB API.
