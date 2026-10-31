# Personal Time Tracker ⏱️

A clean, responsive, and privacy-focused web application for personal time tracking, calendar-based history navigation, and future planning notes. Built with Python, FastAPI, SQLAlchemy 2.0, Alembic, and lightweight vanilla HTML/CSS/JavaScript.

---

## 🌟 Key Features

1. **Account & Authentication**:
   - Secure registration & login with **Argon2id** password hashing.
   - HTTP-only cookie-based session management.
   - Per-user data isolation: each user only sees and modifies their own data.
   - Configurable IANA timezone per account (e.g. `Asia/Kolkata`, `America/New_York`).

2. **Live Client-Side Timer**:
   - Start and stop live work sessions with optional notes.
   - Authoritative start timestamp stored in the database; elapsed timer ticks smoothly locally in JavaScript every second without server polling.
   - Resumes seamlessly if the browser is closed or refreshed.
   - Enforces **at most one active timer per user** both in application logic and with a database partial unique index.

3. **Interactive Monthly Calendar (History Interface)**:
   - Primary interface for navigating historical entries.
   - Month-by-month navigation (`Previous`, `Next`, and `Today`).
   - Subtle dot indicators for dates with tracked time (🟢) and planning notes (🟣).
   - Click any date to view detailed entries, durations, and daily totals.

4. **Future Planning Notes (`CalendarNote`)**:
   - Add, edit, and delete planning reminders for future dates.
   - **Important rule**: Future dates strictly forbid time tracking entries. Planning notes never contaminate actual tracked hours.

5. **Manual Historical Entry & Editing**:
   - Add completed past entries with start time, end time, and notes.
   - Edit or delete existing entries with ownership validation.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.11+
- Virtual environment (`.venv`)

### 2. Activate the Virtual Environment
On Windows PowerShell:
```powershell
.\.venv\Scripts\Activate.ps1
```

### 3. Run the Development Server
```powershell
uvicorn app.main:app --reload
```

### 4. Open in Your Browser
- **Web Application Interface**: Visit [http://localhost:8000/](http://localhost:8000/)
- **Interactive Swagger API Documentation**: Visit [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🧪 Running Automated Tests

Run the full automated test suite with pytest:
```powershell
pytest
```
*(All 51 tests covering authentication, time rules, calendar indicators, daily to-dos, and security run in ~6 seconds)*

---

## 📂 Project Structure

```text
time-log-tracker/
│
├── app/
│   ├── main.py              # Application entry point, static file mounting & lifespan
│   ├── core/
│   │   ├── config.py        # Pydantic Settings & environment variables
│   │   └── security.py      # Argon2id password hashing & JWT session tokens
│   ├── db/
│   │   ├── base.py          # SQLAlchemy 2.0 Base declarative class
│   │   └── session.py       # Engine, SessionLocal, & get_db dependency
│   ├── models/
│   │   ├── user.py          # User ORM model
│   │   ├── time_entry.py    # TimeEntry model with partial unique index
│   │   └── calendar_note.py # CalendarNote model
│   ├── schemas/
│   │   ├── auth.py          # Pydantic auth request/response schemas
│   │   ├── time_entry.py    # Pydantic time tracking schemas & duration derivation
│   │   ├── calendar.py      # Calendar month response & day summary schemas
│   │   └── calendar_note.py # Planning note schemas
│   ├── services/
│   │   ├── auth.py          # Auth & user business logic
│   │   ├── time_tracking.py # Timezone ranges, start/stop timer, manual entries
│   │   ├── calendar.py      # Monthly calendar indicators & aggregation
│   │   └── calendar_note.py # Planning notes CRUD
│   └── api/
│       ├── deps.py          # get_current_user dependency injection
│       ├── auth.py          # /auth routes (register, login, logout, me)
│       ├── account.py       # /account routes (profile, change-password, delete)
│       ├── time_entries.py  # /time routes (start, stop, manual, today, date, edit, delete)
│       ├── calendar.py      # /calendar routes (month view)
│       └── calendar_notes.py# /calendar-notes routes (CRUD)
│
├── frontend/                # Lightweight Vanilla Frontend
│   ├── index.html           # Main application UI layout
│   ├── css/style.css        # Clean responsive styles
│   └── js/app.js            # Client-side live timer, calendar, and modal controllers
│
├── migrations/              # Alembic database migrations
├── tests/                   # Automated pytest suite (51 tests)
├── .env.example             # Configuration template
├── vercel.json              # Vercel serverless deployment configuration
├── requirements.txt         # Project dependencies
└── README.md                # Documentation
```

---

## ☁️ Production Deployment on Vercel

The application is structured to run seamlessly in serverless environments like Vercel with zero persistent in-memory state:

### 1. Provision a Cloud PostgreSQL Database
Provision a PostgreSQL database on a cloud provider such as:
- **[Neon.tech](https://neon.tech/)** (Recommended for serverless — fast autoscaling & connection pooling)
- **[Supabase](https://supabase.com/)**
- **Vercel Postgres**

Copy the connection string (format: `postgresql://user:password@ep-host.region.neon.tech/neondb?sslmode=require`).
*(Note: Both `postgres://` and `postgresql://` URIs are automatically normalized by the application to `postgresql+psycopg2://`)*.

### 2. Configure Environment Variables in Vercel
In your Vercel Project Dashboard under **Settings → Environment Variables**, add:
- `DATABASE_URL`: Your cloud PostgreSQL connection string.
- `AUTH_SECRET`: A secure random 64-character secret (generate with `python -c "import secrets; print(secrets.token_hex(32))"`).
- `ENVIRONMENT`: `production`
- `COOKIE_SECURE`: `true`
- `ALLOWED_ORIGINS`: Optional, your Vercel deployment URL (e.g. `https://your-app.vercel.app`).

### 3. Deploy
You can deploy directly via Git or using the Vercel CLI:
```bash
# Deploy via Vercel CLI
vercel --prod
```
Or connect your GitHub repository to Vercel for automatic continuous deployments on every push.

Tables are automatically verified and initialized upon startup via FastAPI's `lifespan` handler. You can also run migrations manually if preferred:
```bash
DATABASE_URL="postgresql://user:password@cloud-db-host/dbname" alembic upgrade head
```

