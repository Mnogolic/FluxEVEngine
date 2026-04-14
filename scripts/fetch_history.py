"""
Собирает полную историю цен за последние 30 дней для топ товаров по всем регионам.
"""
import asyncio
import logging
import time
import aiohttp
from datetime import datetime, timedelta
from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.models import TrackedItem, MarketHistory

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

ESI_BASE = "https://esi.evetech.net/latest"
REGIONS = {
    10000002: "Jita",
    10000043: "Amarr",
    10000032: "Dodixie",
    10000042: "Hek",
    10000030: "Rens",
}
DAYS = 30


async def fetch_history(session: aiohttp.ClientSession, type_id: int, region_id: int) -> list:
    try:
        async with session.get(
            f"{ESI_BASE}/markets/{region_id}/history/",
            params={"type_id": type_id}
        ) as resp:
            return await resp.json()
    except Exception:
        return []


async def main():
    cutoff = datetime.now() - timedelta(days=DAYS)

    async with SessionLocal() as db:
        items = (await db.execute(select(TrackedItem))).scalars().all()

    logger.info("=" * 60)
    logger.info("FluxEV Engine — Historical Data Fetcher")
    logger.info("=" * 60)
    logger.info(f"Items to process : {len(items)}")
    logger.info(f"Regions          : {', '.join(REGIONS.values())}")
    logger.info(f"Period           : last {DAYS} days (since {cutoff.strftime('%Y-%m-%d')})")
    logger.info(f"Total API calls  : ~{len(items) * len(REGIONS)}")
    logger.info("-" * 60)

    t_start = time.time()
    total_saved = 0
    total_skipped = 0

    async with aiohttp.ClientSession() as session:
        for region_id, region_name in REGIONS.items():
            t_region = time.time()
            region_saved = 0
            region_empty = 0

            logger.info(f"Processing region: {region_name} ({region_id})")

            for i, item in enumerate(items):
                history = await fetch_history(session, item.type_id, region_id)
                if not history:
                    region_empty += 1
                    continue

                async with SessionLocal() as db:
                    for entry in history:
                        entry_date = datetime.strptime(entry["date"], "%Y-%m-%d")
                        if entry_date < cutoff:
                            continue

                        existing = (await db.execute(
                            select(MarketHistory).where(
                                MarketHistory.type_id == item.type_id,
                                MarketHistory.region_id == region_id,
                                MarketHistory.date == entry_date,
                            )
                        )).scalar_one_or_none()

                        if existing:
                            total_skipped += 1
                            continue

                        db.add(MarketHistory(
                            type_id=item.type_id,
                            region_id=region_id,
                            date=entry_date,
                            average=entry["average"],
                            highest=entry["highest"],
                            lowest=entry["lowest"],
                            volume=entry["volume"],
                            order_count=entry["order_count"],
                        ))
                        region_saved += 1
                        total_saved += 1

                    await db.commit()

            elapsed = time.time() - t_region
            logger.info(f"  {region_name:<10} saved: {region_saved:>5} rows | "
                        f"empty: {region_empty:>3} | time: {elapsed:.1f}s")

    elapsed_total = time.time() - t_start
    logger.info("-" * 60)
    logger.info(f"Total new rows saved : {total_saved}")
    logger.info(f"Total rows skipped   : {total_skipped} (already in DB)")
    logger.info(f"Total time           : {elapsed_total:.1f}s")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
