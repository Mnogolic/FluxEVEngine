"""
Обновляет имена товаров в tracked_items где name = числовая строка (type_id).
"""
import asyncio
import aiohttp
from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.models import TrackedItem

ESI_BASE = "https://esi.evetech.net/latest"


async def get_name(session: aiohttp.ClientSession, type_id: int) -> str:
    try:
        async with session.get(f"{ESI_BASE}/universe/types/{type_id}/") as resp:
            data = await resp.json()
            return data.get("name", str(type_id))
    except Exception:
        return str(type_id)


async def main():
    async with SessionLocal() as db:
        items = (await db.execute(select(TrackedItem))).scalars().all()
        to_fix = [i for i in items if i.name == str(i.type_id)]

    print(f"Items with numeric names: {len(to_fix)}")

    async with aiohttp.ClientSession() as session:
        for i, item in enumerate(to_fix):
            name = await get_name(session, item.type_id)
            async with SessionLocal() as db:
                obj = (await db.execute(
                    select(TrackedItem).where(TrackedItem.type_id == item.type_id)
                )).scalar_one()
                obj.name = name
                await db.commit()
            if (i + 1) % 50 == 0:
                print(f"  {i+1}/{len(to_fix)} fixed")

    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
