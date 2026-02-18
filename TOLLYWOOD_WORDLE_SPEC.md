# MISSION: Telugu Movie Wordle Clone

## 1. Data Layer (Python FastAPI)
- **Source:** Use TMDb API (Language: te-IN) to fetch the top 500 Telugu movies.
- **Fields to Scrape:** Title, Hero (Cast Index 0), Heroine (Cast Index 1), Director, Music Director, Production Company, and Poster URL.
- **Daily Logic:** Use a deterministic seed based on `date.today()` to select the "Movie of the Day".

## 2. Gameplay & UI (Next.js)
- **Grid:** 5 Columns: [Hero, Heroine, Director, Music, Producer].
- **Search:** Fuzzy matching search bar using `fuse.js` for movie titles.
- **Animations:** 3D flip animation using `framer-motion` for reveal.
- **Win State:** Full-screen 🍿 and 📽️ confetti with "BLOCKBUSTER!" message.
- **Loss State:** "FLOP - Better luck tomorrow" revealing the correct movie.

## 3. Styling
- **Theme:** "Cinema Dark Mode" (Black background with gold/yellow accents).
- **Sticky Search:** Top-mounted search bar for easy access.