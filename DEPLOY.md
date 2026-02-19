
# 🚀 Deployment Guide

This application is designed to be deployed as two separate services:
1.  **Backend**: Python Web Service (FastAPI)
2.  **Frontend**: Static/Node Web Service (Next.js)

We recommend **Render** for free tier hosting, but Railway or Vercel work similarly.

---

## 🏗 Backend Deployment (Render)

1.  **Create a New Web Service**
    *   Connect your GitHub repository.
    *   **Root Directory**: `.` (Project Root)
    *   **Build Command**: `pip install -r backend/requirements.txt`
    *   **Start Command**: `uvicorn backend.src.main:app --host 0.0.0.0 --port 10000`

2.  **Environment Variables**
    *   `PYTHON_VERSION`: `3.9.0` (or greater)
    *   `TMDB_API_KEY`: Your TMDB API Key (Required for real data)
        *   *If omitted, the backend will serve mock data.*
    *   `CORS_ORIGINS`: Comma-separated list of allowed frontend URLs.
        *   Example: `https://your-frontend-app.onrender.com,http://localhost:3000`

### ❄️ Cold Start & Data Warm-up
*   The backend spins up instantly.
*   Upon startup, it triggers a **background task** to fetch 500+ movies from TMDB.
*   **Behavior**: For the first ~30 seconds after a cold start, the API will serve mock data while fetching real data in the background. This prevents timeout errors during boot.
*   Once fetched, data is cached in memory for the life of the instance.

---

## 🎨 Frontend Deployment (Render)

1.  **Create a New Web Service**
    *   Connect your GitHub repository.
    *   **Root Directory**: `frontend`
    *   **Build Command**: `npm install && npm run build`
    *   **Start Command**: `npm start`

2.  **Environment Variables**
    *   `NEXT_PUBLIC_API_URL`: The full URL of your deployed backend API.
        *   Example: `https://your-backend-app.onrender.com/api`
        *   *Note: Do not include a trailing slash.*

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
*   **Missing Data**: Check backend logs. If `TMDB_API_KEY` is invalid, it will permanently serve mock data.
