#!/usr/bin/env python
"""Test seed_database function."""
import asyncio
from app.core.init_db import seed_database

if __name__ == "__main__":
    asyncio.run(seed_database())
