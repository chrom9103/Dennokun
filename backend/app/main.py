import os
from fastapi import FastAPI, HTTPException

app = FastAPI(title="Dennokun Backend")


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
