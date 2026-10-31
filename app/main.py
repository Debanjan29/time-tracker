import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import settings
from app.api.auth import router as auth_router
from app.api.account import router as account_router
from app.api.time_entries import router as time_router
from app.api.calendar import router as calendar_router
from app.api.calendar_notes import router as calendar_notes_router
from app.api.todos import router as todos_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan events: runs when the FastAPI application starts up and shuts down.
    Ensures that database tables are initialized cleanly upon application launch.
    """
    from app.db.base import Base
    from app.db.session import engine
    import app.models.user  # noqa: F401
    import app.models.time_entry  # noqa: F401
    import app.models.calendar_note  # noqa: F401
    import app.models.todo  # noqa: F401

    Base.metadata.create_all(bind=engine)
    yield


# Initialize FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="A clean, personal time tracking web application with calendar history and future planning notes.",
    version="1.0.0",
    docs_url="/docs",      # Interactive Swagger UI documentation
    redoc_url="/redoc",    # Alternative ReDoc documentation
    lifespan=lifespan
)

# CORS (Cross-Origin Resource Sharing) middleware configuration
allowed_origins = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:3000",
]
if settings.ALLOWED_ORIGINS:
    for origin in settings.ALLOWED_ORIGINS.split(","):
        origin = origin.strip()
        if origin and origin not in allowed_origins:
            allowed_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth_router)
app.include_router(account_router)
app.include_router(time_router)
app.include_router(calendar_router)
app.include_router(calendar_notes_router)
app.include_router(todos_router)

# Mount frontend static assets robustly across local dev, containers, and Vercel serverless
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
candidates = [
    os.path.join(base_dir, "frontend"),
    os.path.join(os.getcwd(), "frontend"),
    os.path.join(os.path.dirname(base_dir), "frontend"),
]
frontend_dir = next((c for c in candidates if os.path.exists(c)), os.path.join(base_dir, "frontend"))

if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")


@app.get("/health", tags=["Health"], summary="API Health Check")
def health_check():
    """
    Health check endpoint to verify server is running.
    Useful for uptime checks and container/deployment monitoring.
    """
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT
    }


@app.get("/", tags=["Frontend"], summary="Serve Web Application")
def serve_ui():
    """
    Serves the Personal Time Tracker web application interface.
    """
    index_file = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {
        "message": f"Welcome to {settings.APP_NAME} API!",
        "documentation": "/docs"
    }
