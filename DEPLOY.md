
# 🚀 Deployment Guide

This application is designed to be deployed as two separate services:
1.  **Backend**: Python Web Service (FastAPI)
2.  **Frontend**: Static/Node Web Service (Next.js)

We recommend **Render** for free tier hosting.

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
3.  **Deploy**: Render will build and deploy both services automatically.

---

## 🛠️ Deployment Option 2: Manual Setup

If you prefer to configure services manually:

### 1. Backend Service (Python 3.9+)
*   **Root Directory**: `.` (Project Root)
*   **Build Command**: `pip install -r backend/requirements.txt`
*   **Start Command**: `uvicorn backend.src.main:app --host 0.0.0.0 --port $PORT`
*   **Env Vars**:
    *   `CORS_ORIGINS`: Comma-separated list (e.g. `https://your-frontend.onrender.com,http://localhost:3000`)
    *   `TMDB_READ_TOKEN`: Preferred.
    *   `TMDB_API_KEY`: Legacy fallback supported.

### 2. Frontend Service (Node)
*   **Root Directory**: `frontend`
*   **Build Command**: `npm install && npm run build`
*   **Start Command**: `npm start`
*   **Env Vars**:
    *   `NEXT_PUBLIC_API_URL`: Full backend API URL (e.g., `https://your-backend.onrender.com/api`)

---

## ❄️ Cold Start & Data Warm-up
*   The backend spins up instantly.
*   Upon startup, it triggers a **background task** to fetch 500+ movies from TMDB.
*   **Behavior**: For the first ~30 seconds after a cold start, the API will serve mock data while fetching real data in the background. This prevents timeout errors during boot.
*   Once fetched, data is cached in memory for the life of the instance.

---

## ✅ verification

1.  **Check Backend Health**:
    *   Visit `https://your-backend-app.onrender.com/` -> Should return `{"message": "Tollywood Wordle API"}`
2.  **Check Game Connectivity**:
    *   Open your frontend URL.
    *   Open Developer Tools (F12) -> Network Tab.
    *   Verify request to `/api/movies` returns 200 OK.
    *   If you see mock data (Baahubali 2, RRR only), wait 30 seconds and refresh. Real data should appear.

## ⚠️ Troubleshooting

*   **CORS Error**: Ensure your frontend URL (exactly as it appears in the browser) is added to `CORS_ORIGINS` in the backend settings.
*   **Backend Timeout**: The app is designed *not* to timeout. If it does, ensure `uvicorn` is binding to `0.0.0.0`.
*   **Missing Data**: Check backend logs. If `TMDB_READ_TOKEN` and `TMDB_API_KEY` are both missing or invalid, cached movie data will stay empty.
