"""Database initialization and seeding utilities."""
import asyncio
import json
import logging
import os
import sys

import asyncpg

from app.core.config import DATABASE_URL
from app.core.security import get_password_hash

# Configure logging to output to stdout
logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger(__name__)


async def seed_database():
    """Seed initial users from environment variables."""
    logger.info("Starting database seeding...")
    logger.info(f"DATABASE_URL: {DATABASE_URL}")
    
    max_retries = 5
    retry_delay = 2  # seconds
    
    for attempt in range(max_retries):
        try:
            logger.info(f"Connecting to database (attempt {attempt + 1}/{max_retries})...")
            conn = await asyncpg.connect(DATABASE_URL)
            logger.info("Connected to database successfully")
            
            # Get seed credentials from environment
            username = os.getenv("SEED_USERNAME")
            email = os.getenv("SEED_EMAIL")
            password = os.getenv("SEED_PASSWORD")

            if not username or not email or not password:
                logger.info("Seed credentials are not fully configured; skipping seed user creation")
                await conn.close()
                return

            logger.info(f"Using seed credentials: username={username}, email={email}")
            
            # Hash password
            logger.info("Hashing password...")
            password_hash = get_password_hash(password)
            logger.info(f"Password hashed successfully")
            
            # Convert permissions dict to JSON string for JSONB column
            permissions_json = json.dumps({"role": "admin"})
            
            # Insert seed user if not exists
            logger.info("Inserting seed user...")
            await conn.execute("""
                INSERT INTO users (name, email, password_hash, permissions, created_at, updated_at)
                VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW())
                ON CONFLICT (email) DO NOTHING
            """, username, email, password_hash, permissions_json)
            logger.info(f"Seed user inserted or already exists: {username}")
            
            await conn.close()
            logger.info(f"Database seeded successfully with user: {username}")
            return
        except (ConnectionRefusedError, asyncpg.PostgresError) as e:
            if attempt < max_retries - 1:
                logger.warning(f"Connection failed (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
            else:
                logger.error(f"Failed to connect after {max_retries} attempts: {e}")
        except Exception as e:
            logger.error(f"Error during database seeding: {type(e).__name__}: {e}", exc_info=True)
            return
