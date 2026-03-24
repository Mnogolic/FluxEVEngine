import asyncio
import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.models import TrackedItem, MarketHistory
from app.esi.market import get_market_history, TOP_REGIONS

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def collect_market_history():
    logger.info("Starting market history collection...")
    async with SessionLocal() as session:
        items = (await session.execute(select(TrackedItem))).scalars().all()

    tasks = []
    for item in items:
        for region_id in TOP_REGIONS:
            tasks.append(_fetch_and_store(item.type_id, region_id))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    errors = [r for r in results if isinstance(r, Exception)]
    if errors:
        for e in errors[:5]:
            logger.error(f"Collection error: {e}")
    logger.info(f"Market history collection done. Errors: {len(errors)}/{len(tasks)}")


async def _fetch_and_store(type_id: int, region_id: int):
    try:
        history = await get_market_history(region_id, type_id)
        if not history:
            logger.warning(f"Empty history for {type_id} / {region_id}")
            return

        # берём последний доступный день (ESI обновляет с задержкой ~1 день)
        latest = sorted(history, key=lambda x: x["date"])[-1]
        latest_date = datetime.strptime(latest["date"], "%Y-%m-%d")

        async with SessionLocal() as session:
            existing = await session.execute(
                select(MarketHistory).where(
                    MarketHistory.type_id == type_id,
                    MarketHistory.region_id == region_id,
                    MarketHistory.date == latest_date,
                )
            )
            if existing.scalar_one_or_none():
                return

            session.add(MarketHistory(
                type_id=type_id,
                region_id=region_id,
                date=latest_date,
                average=latest["average"],
                highest=latest["highest"],
                lowest=latest["lowest"],
                volume=latest["volume"],
                order_count=latest["order_count"],
            ))
            await session.commit()
    except Exception as e:
        logger.warning(f"Failed {type_id} / {region_id}: {e}")


def start_scheduler():
    scheduler.add_job(collect_market_history, "cron", hour=1, minute=0)
    scheduler.start()
