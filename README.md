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
*(All 38 tests covering authentication, time rules, calendar indicators, and security run in ~5 seconds)*

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
├── tests/                   # Automated pytest suite (38 tests)
├── .env.example             # Configuration template
├── vercel.json              # Vercel serverless deployment configuration
├── requirements.txt         # Project dependencies
└── README.md                # Documentation
```

---

## ☁️ Deployment (Vercel + Cloud PostgreSQL)

The application is structured to run in serverless environments like Vercel with zero persistent in-memory state:

### 1. Cloud PostgreSQL Setup
Provision a free PostgreSQL database on providers such as **Neon.tech**, **Supabase**, or **Render**.

### 2. Run Database Migrations
Before deploying, apply the Alembic migrations against your production database:
```bash
DATABASE_URL="postgresql://user:password@cloud-db-host/dbname" alembic upgrade head
```

### 3. Deploy to Vercel
1. Install Vercel CLI (`npm i -g vercel`) or push to a GitHub repository connected to Vercel.
2. In the Vercel project settings, configure the following Environment Variables:
   - `DATABASE_URL`: Your cloud PostgreSQL connection string.
   - `AUTH_SECRET`: A secure random 64-character secret.
   - `ENVIRONMENT`: `production`
   - `COOKIE_SECURE`: `true`
3. Run `vercel deploy` or trigger deployment via git push.
