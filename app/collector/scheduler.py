import asyncio
import logging
from datetime import date
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

    today = date.today()
    tasks = []
    for item in items:
        for region_id in TOP_REGIONS:
            tasks.append(_fetch_and_store(item.type_id, region_id, today))

    await asyncio.gather(*tasks, return_exceptions=True)
    logger.info("Market history collection done.")


async def _fetch_and_store(type_id: int, region_id: int, today: date):
    try:
        history = await get_market_history(region_id, type_id)
        today_entry = next((h for h in history if h["date"] == str(today)), None)
        if not today_entry:
            return

        async with SessionLocal() as session:
            session.add(MarketHistory(
                type_id=type_id,
                region_id=region_id,
                date=today_entry["date"],
                average=today_entry["average"],
                highest=today_entry["highest"],
                lowest=today_entry["lowest"],
                volume=today_entry["volume"],
                order_count=today_entry["order_count"],
            ))
            await session.commit()
    except Exception as e:
        logger.warning(f"Failed {type_id} / {region_id}: {e}")


def start_scheduler():
    scheduler.add_job(collect_market_history, "cron", hour=1, minute=0)
    scheduler.start()
