"""
Тест: пробуем сохранить один товар напрямую.
"""
import asyncio
import aiohttp
from datetime import datetime
from app.db.session import SessionLocal
from app.db.models import MarketHistory
from sqlalchemy import select

ESI_BASE = "https://esi.evetech.net/latest"
JITA_REGION_ID = 10000002
TYPE_ID = 34  # Tritanium


async def main():
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{ESI_BASE}/markets/{JITA_REGION_ID}/history/", params={"type_id": TYPE_ID}) as resp:
            history = await resp.json()

    latest = sorted(history, key=lambda x: x["date"])[-1]
    print(f"Latest from ESI: {latest}")

    date_parsed = datetime.strptime(latest["date"], "%Y-%m-%d")
    print(f"Parsed date: {date_parsed}")

    async with SessionLocal() as db:
        # проверяем дубль
        existing = await db.execute(
            select(MarketHistory).where(
                MarketHistory.type_id == TYPE_ID,
                MarketHistory.region_id == JITA_REGION_ID,
                MarketHistory.date == date_parsed,
            )
        )
        row = existing.scalar_one_or_none()
        print(f"Existing row: {row}")

        # сохраняем
        db.add(MarketHistory(
            type_id=TYPE_ID,
            region_id=JITA_REGION_ID,
            date=date_parsed,
            average=latest["average"],
            highest=latest["highest"],
            lowest=latest["lowest"],
            volume=latest["volume"],
            order_count=latest["order_count"],
        ))
        await db.commit()
        print("Saved!")

    # проверяем что сохранилось
    async with SessionLocal() as db:
        result = await db.execute(select(MarketHistory).where(MarketHistory.type_id == TYPE_ID))
        rows = result.scalars().all()
        print(f"Rows in DB for type_id=34: {len(rows)}")
        for r in rows:
            print(f"  date={r.date}, volume={r.volume:,}")


if __name__ == "__main__":
    asyncio.run(main())
