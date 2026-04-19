"""
Суммарный торговый оборот за последний день по всем регионам.
"""
import asyncio
import aiohttp
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
PLEX_TYPE_ID = 44992
PLEX_PER_PACK = 500
PLEX_PACK_USD = 19.99


async def get_plex_isk() -> float:
    async with aiohttp.ClientSession() as s:
        async with s.get(
            "https://esi.evetech.net/latest/markets/10000002/orders/",
            params={"type_id": PLEX_TYPE_ID, "order_type": "sell"},
        ) as r:
            orders = await r.json()
    return min(o["price"] for o in orders) if orders else 6_000_000


async def main():
    plex_isk = await get_plex_isk()
    isk_per_usd = (PLEX_PER_PACK * plex_isk) / PLEX_PACK_USD
    print(f"PLEX price: {plex_isk:,.0f} ISK  ->  1 USD = {isk_per_usd:,.0f} ISK\n")

    async with SessionLocal() as db:
        rows = (await db.execute(
            select(
                MarketHistory.region_id,
                func.sum(MarketHistory.volume * MarketHistory.average).label("isk")
            )
            .group_by(MarketHistory.region_id)
            .order_by(func.sum(MarketHistory.volume * MarketHistory.average).desc())
        )).all()

    total_isk = sum(r.isk for r in rows)
    print(f"{'Hub':<12} {'ISK':>22} {'USD':>14}")
    print("-" * 52)
    for r in rows:
        name = REGION_NAMES.get(r.region_id, str(r.region_id))
        usd = r.isk / isk_per_usd
        print(f"{name:<12} {r.isk:>22,.0f} ISK  ${usd:>10,.2f}")

    print("-" * 52)
    print(f"{'TOTAL':<12} {total_isk:>22,.0f} ISK  ${total_isk / isk_per_usd:>10,.2f}")


if __name__ == "__main__":
    asyncio.run(main())
