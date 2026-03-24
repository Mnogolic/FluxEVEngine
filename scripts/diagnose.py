"""
Диагностика: смотрим что реально приходит от ESI и что есть в БД.
"""
import asyncio
import aiohttp
from sqlalchemy import select, func
from app.db.session import SessionLocal
from app.db.models import TrackedItem, MarketHistory

ESI_BASE = "https://esi.evetech.net/latest"
JITA_REGION_ID = 10000002


async def main():
    # 1. Проверяем что в БД
    async with SessionLocal() as db:
        count = await db.execute(select(func.count()).select_from(MarketHistory))
        print(f"Rows in market_history: {count.scalar()}")

        items = (await db.execute(select(TrackedItem).limit(3))).scalars().all()

    # 2. Смотрим что реально отдаёт ESI для первых 3 товаров
    async with aiohttp.ClientSession() as session:
        for item in items:
            async with session.get(f"{ESI_BASE}/markets/{JITA_REGION_ID}/history/", params={"type_id": item.type_id}) as resp:
                history = await resp.json()
                if history:
                    latest = sorted(history, key=lambda x: x["date"])[-1]
                    print(f"{item.name} (type_id={item.type_id}): latest date = {latest['date']}, volume = {latest['volume']:,}")
                else:
                    print(f"{item.name}: no history")


if __name__ == "__main__":
    asyncio.run(main())
