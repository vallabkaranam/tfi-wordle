
# 🚀 Deployment Guide

This application is designed to be deployed as two separate services:
1.  **Backend**: Python Web Service (FastAPI)
2.  **Frontend**: Static/Node Web Service (Next.js)

We recommend **Render** with a persistent disk on the backend for production stability.

---

## ⚡ Deployment Option 1: Render Blueprint (Recommended)

The repository includes a `render.yaml` file for automated Infrastructure-as-Code deployment.

1.  **Create a New Blueprint Instance** on Render.
    *   Connect your GitHub repository.
    *   Render will detect `render.yaml` and prompt you to create two services.
2.  **Configure Environment Variables**:
    *   `TMDB_READ_TOKEN`: Preferred. Your TMDB v4 read token.
    *   `TMDB_API_KEY`: Legacy fallback supported for backwards compatibility.
    *   `CORS_ORIGINS`: Your frontend URL (e.g., `https://tfi-wordle-frontend.onrender.com`).
    *   `NEXT_PUBLIC_API_URL`: Your backend URL + `/api` (e.g., `https://tfi-wordle-backend.onrender.com/api`).
    *   `MOVIE_CACHE_DIR`: Set automatically by the Blueprint to the mounted disk path.
3.  **Deploy**: Render will build and deploy both services automatically.

---

## 🛠️ Deployment Option 2: Manual Setup

If you prefer to configure services manually:

### 1. Backend Service (Python 3.9+)
*   **Root Directory**: `.` (Project Root)
*   **Build Command**: `pip install -r backend/requirements.txt`
*   **Start Command**: `uvicorn backend.src.main:app --host 0.0.0.0 --port $PORT`
*   **Plan**: `starter` or higher
*   **Persistent Disk**:
    *   Mount Path: `/var/data/tfi-wordle`
    *   Size: `5 GB`
*   **Env Vars**:
    *   `CORS_ORIGINS`: Comma-separated list (e.g. `https://your-frontend.onrender.com,http://localhost:3000`)
    *   `TMDB_READ_TOKEN`: Preferred.
    *   `TMDB_API_KEY`: Legacy fallback supported.
    *   `MOVIE_CACHE_DIR`: `/var/data/tfi-wordle`

### 2. Frontend Service (Node)
*   **Root Directory**: `frontend`
*   **Build Command**: `npm install && npm run build`
*   **Start Command**: `npm start`
*   **Env Vars**:
    *   `NEXT_PUBLIC_API_URL`: Full backend API URL (e.g., `https://your-backend.onrender.com/api`)

---

## ❄️ Durable Cache Behavior
*   The backend stores the refreshed movie snapshot on the mounted Render Disk.
*   On startup, it loads the latest successful snapshot from disk immediately.
*   The daily refresh job updates that snapshot so gameplay stays stable across restarts and deploys.
*   If the disk snapshot is missing, the backend falls back to rebuilding the pool from TMDB.

---

## ✅ verification

1.  **Check Backend Health**:
    *   Visit `https://your-backend-app.onrender.com/api/health`
    *   Confirm `ok: true` and non-zero movie counts for all languages.
2.  **Check Game Connectivity**:
    *   Open your frontend URL.
    *   Open Developer Tools (F12) -> Network Tab.
    *   Verify request to `/api/movies` returns 200 OK.
    *   Verify `/api/search` and `/api/guess` return 200 OK.

## ⚠️ Troubleshooting

*   **CORS Error**: Ensure your frontend URL (exactly as it appears in the browser) is added to `CORS_ORIGINS` in the backend settings.
*   **Backend Timeout**: The app is designed *not* to timeout. If it does, ensure `uvicorn` is binding to `0.0.0.0`.
*   **Missing Data**: Check backend logs. If `TMDB_READ_TOKEN` and `TMDB_API_KEY` are both missing or invalid, cached movie data will stay empty.
