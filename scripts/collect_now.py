"""
Сбор market history с подробными метриками — для отчёта и тестирования.
"""
import asyncio
import logging
import time
from datetime import datetime
from sqlalchemy import select, func
from app.db.session import SessionLocal
from app.db.models import MarketHistory, TrackedItem
from app.esi.client import esi
from app.collector.scheduler import collect_market_history

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

REGION_NAMES = {
    10000002: "Jita",
    10000043: "Amarr",
    10000032: "Dodixie",
    10000042: "Hek",
    10000030: "Rens",
}


async def print_metrics():
    async with SessionLocal() as db:
        total = (await db.execute(select(func.count()).select_from(MarketHistory))).scalar()
        items = (await db.execute(select(func.count()).select_from(TrackedItem))).scalar()
        last_date = (await db.execute(select(func.max(MarketHistory.date)))).scalar()

        region_rows = (await db.execute(
            select(MarketHistory.region_id, func.count())
            .where(func.date(MarketHistory.date) == func.date(last_date))
            .group_by(MarketHistory.region_id)
            .order_by(func.count().desc())
        )).all()

        isk_rows = (await db.execute(
            select(
                MarketHistory.region_id,
                func.sum(MarketHistory.volume * MarketHistory.average).label("isk")
            )
            .where(func.date(MarketHistory.date) == func.date(last_date))
            .group_by(MarketHistory.region_id)
            .order_by(func.sum(MarketHistory.volume * MarketHistory.average).desc())
        )).all()

    logger.info("=" * 60)
    logger.info("COLLECTION METRICS REPORT")
    logger.info("=" * 60)
    logger.info(f"Tracked items:        {items}")
    logger.info(f"Total rows in DB:     {total}")
    logger.info(f"Latest data date:     {last_date.strftime('%Y-%m-%d') if last_date else 'N/A'}")
    logger.info("-" * 60)
    logger.info("Rows collected per region (latest date):")
    for region_id, cnt in region_rows:
        logger.info(f"  {REGION_NAMES.get(region_id, region_id):<12} {cnt:>5} rows")
    logger.info("-" * 60)
    logger.info("ISK turnover per region (latest date):")
    total_isk = sum(r.isk for r in isk_rows)
    for r in isk_rows:
        pct = r.isk / total_isk * 100 if total_isk else 0
        logger.info(f"  {REGION_NAMES.get(r.region_id, r.region_id):<12} {r.isk:>20,.0f} ISK  ({pct:.1f}%)")
    logger.info(f"  {'TOTAL':<12} {total_isk:>20,.0f} ISK")
    logger.info("=" * 60)


async def main():
    logger.info("FluxEV Engine — Market Data Collector")
    logger.info(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("-" * 60)

    await esi.start()

    logger.info("Fetching tracked items from DB...")
    async with SessionLocal() as db:
        items = (await db.execute(select(TrackedItem))).scalars().all()
    logger.info(f"Tracked items loaded: {len(items)}")
    logger.info(f"Target regions: Jita, Amarr, Dodixie, Hek, Rens (5 regions)")
    logger.info(f"Total API requests to make: {len(items) * 5}")
    logger.info("-" * 60)

    logger.info("Starting data collection...")
    t_start = time.time()
    await collect_market_history()
    elapsed = time.time() - t_start

    logger.info(f"Collection completed in {elapsed:.1f} seconds")
    logger.info("-" * 60)

    await print_metrics()
    await esi.stop()


if __name__ == "__main__":
    asyncio.run(main())
