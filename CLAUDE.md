# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

No test or lint commands are configured.

## Stack

- **Backend:** Node.js + Express, MongoDB Atlas via Mongoose, JWT auth (httpOnly cookies, 7-day tokens), bcryptjs
- **Frontend:** Vanilla JS SPA (no framework), plain HTML/CSS

## Architecture

**Rabbit Habits** is a Vietnamese-language personal productivity and gamification platform. The app runs on port 3000.

### Backend (`server.js` + `routes/` + `models/`)

Express server with 6 route modules, all requiring JWT auth except register/login/logout:

| Route module | Prefix | Responsibility |
|---|---|---|
| `routes/auth.js` | `/api/auth` | Register, login, logout, profile |
| `routes/tasks.js` | `/api/tasks` | Task CRUD + stats/analytics |
| `routes/habits.js` | `/api/habits` | Habit CRUD + daily log entries |
| `routes/journal.js` | `/api/journal` | Daily mood + text journal entries |
| `routes/goals.js` | `/api/goals` | Multi-day goals with daily subtasks |
| `routes/shop.js` | `/api/shop` | Pets, items, inventory, points |

Auth middleware (`middleware/auth.js`) reads `token` from cookies and attaches `req.user`.

### Data Models

- **User** — bcrypt-hashed passwords, basic profile
- **Task** — priority (0–3), completion timestamps, per-user
- **Habit + HabitLog** — habit definition + per-date log entries (separate collections)
- **Goal** — multi-day challenge, daily subtasks, missed-day tracking
- **Journal** — one entry per user per date, mood + content
- **Pet** — 13 types (5 animals, 8 plants), 10 growth stages based on `totalPoints`, health degrades if neglected 3+ consecutive days (−10 pts/check), can die if neglected too long
- **UserPoints** — centralized points balance, 7-type inventory (food, water, fertilizer, etc.), streak freeze cards, badges

### Gamification Rules

- Tasks award 5–12 pts based on priority; habits award 5 pts; goals award 8 pts
- Streak freeze cards can be purchased to protect daily streaks
- Pet growth stage is derived from accumulated `totalPoints`

### Frontend (`public/`)

Two HTML entry points:
- `auth.html` — login/register page
- `index.html` — main SPA (all tabs/views)

All frontend logic lives in a single `public/js/app.js` (~146KB). All styles in `public/css/style.css` (~84KB). The server falls back to `index.html` for all non-API, non-auth routes.

### Environment

Requires a `.env` file with:
```
PORT=3000
MONGODB_URI=<MongoDB Atlas connection string>
JWT_SECRET=<secret>
```
