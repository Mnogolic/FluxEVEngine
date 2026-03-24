"""
Проверяем данные в market_history.
"""
import asyncio
from sqlalchemy import select, func, text
from app.db.session import SessionLocal
from app.db.models import MarketHistory


async def main():
    async with SessionLocal() as db:
        # общая статистика
        total = (await db.execute(select(func.count()).select_from(MarketHistory))).scalar()
        null_avg = (await db.execute(select(func.count()).select_from(MarketHistory).where(MarketHistory.average == None))).scalar()
        zero_avg = (await db.execute(select(func.count()).select_from(MarketHistory).where(MarketHistory.average == 0))).scalar()

        print(f"Total rows: {total}")
        print(f"Rows with average=NULL: {null_avg}")
        print(f"Rows with average=0: {zero_avg}")

        # пример нескольких строк
        rows = (await db.execute(select(MarketHistory).limit(5))).scalars().all()
        for r in rows:
            print(f"  type_id={r.type_id} region={r.region_id} avg={r.average} vol={r.volume} isk={r.average * r.volume if r.average else 'N/A'}")


if __name__ == "__main__":
    asyncio.run(main())
