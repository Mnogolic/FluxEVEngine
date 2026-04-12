"""
Проверка последних собранных данных в market_history.
"""
import asyncio
from sqlalchemy import select, func
from app.db.session import SessionLocal
from app.db.models import MarketHistory

REGION_NAMES = {
    10000002: "Jita",
    10000043: "Amarr",
    10000032: "Dodixie",
    10000042: "Hek",
    10000030: "Rens",
}


async def main():
    async with SessionLocal() as db:
        total = (await db.execute(select(func.count()).select_from(MarketHistory))).scalar()
        print(f"Total rows in market_history: {total}")

        date_rows = (await db.execute(
            select(func.date(MarketHistory.date), func.count())
            .group_by(func.date(MarketHistory.date))
            .order_by(func.date(MarketHistory.date).desc())
        )).all()

        print(f"\nRows per date:")
        for d, cnt in date_rows:
            print(f"  {d}: {cnt} rows")

        if date_rows:
            last_date = date_rows[0][0]
            region_rows = (await db.execute(
                select(MarketHistory.region_id, func.count())
                .where(func.date(MarketHistory.date) == last_date)
                .group_by(MarketHistory.region_id)
                .order_by(func.count().desc())
            )).all()
            print(f"\nRows per region for {last_date}:")
            for region_id, cnt in region_rows:
                print(f"  {REGION_NAMES.get(region_id, region_id)}: {cnt} rows")


if __name__ == "__main__":
    asyncio.run(main())
