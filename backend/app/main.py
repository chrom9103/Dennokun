import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, events, master, matches, generate
from app.core.init_db import seed_database

app = FastAPI(title="Dennokun Backend")

# Add CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(events.router)
app.include_router(master.router)
app.include_router(matches.router)
app.include_router(generate.router)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    await seed_database()


@app.get("/")
async def root():
    return {"message": "Dennokun backend"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/db")
async def db_info():
    """簡易的に Postgres 接続を確認してバージョンを返します。
    `DATABASE_URL` 環境変数が必要です（例: postgres://user:pass@postgres:5432/dbname）。
    """
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        raise HTTPException(status_code=400, detail="DATABASE_URL not set")

    try:
        import asyncpg
    except Exception:
        raise HTTPException(status_code=500, detail="asyncpg not available")

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        version = await conn.fetchval("SELECT version()")
        return {"db_version": version}
    finally:
        await conn.close()
