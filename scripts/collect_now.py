"""
Ручной запуск сбора market history для всех tracked_items по всем TOP_REGIONS.
"""
import asyncio
import logging
import sys
import os

logging.basicConfig(level=logging.INFO)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.esi.client import esi
from app.collector.scheduler import collect_market_history


async def main():
    await esi.start()
    print("Starting manual market history collection...")
    await collect_market_history()
    await esi.stop()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
