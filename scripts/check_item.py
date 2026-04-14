"""
Проверка данных по конкретным товарам.
"""
import asyncio
import aiohttp
from sqlalchemy import select, func
from app.db.session import SessionLocal
from app.db.models import MarketHistory, TrackedItem

ESI_BASE = "https://esi.evetech.net/latest"
JITA = 10000002


async def main():
    async with SessionLocal() as db:
        # находим type_id по названию
        for name_part in ["Drone Iteration", "Rogue Drone Infestation"]:
            item = (await db.execute(
                select(TrackedItem).where(TrackedItem.name.ilike(f"%{name_part}%"))
            )).scalar_one_or_none()

            if not item:
                print(f"NOT FOUND: {name_part}")
                continue

            print(f"\n{item.name} (type_id={item.type_id})")

            rows = (await db.execute(
                select(MarketHistory.date, MarketHistory.average, MarketHistory.volume)
                .where(MarketHistory.type_id == item.type_id, MarketHistory.region_id == JITA)
                .order_by(MarketHistory.date.asc())
            )).all()

            print(f"  Points in DB: {len(rows)}")
            for r in rows:
                print(f"  {r.date.strftime('%Y-%m-%d')}  avg={r.average:>12.2f} ISK  vol={r.volume:>12,}")

            # проверяем что реально в ESI
            print(f"  --- ESI last 5 days ---")
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{ESI_BASE}/markets/{JITA}/history/",
                    params={"type_id": item.type_id}
                ) as resp:
                    history = await resp.json()
            for entry in sorted(history, key=lambda x: x["date"])[-5:]:
                print(f"  {entry['date']}  avg={entry['average']:>12.2f} ISK  vol={entry['volume']:>12,}")


if __name__ == "__main__":
    asyncio.run(main())
