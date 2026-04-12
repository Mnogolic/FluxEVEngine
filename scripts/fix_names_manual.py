import asyncio
import aiohttp
from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.models import TrackedItem

ESI_BASE = "https://esi.evetech.net/latest"


async def main():
    type_ids = [16642, 16643, 16644]
    async with aiohttp.ClientSession() as session:
        for type_id in type_ids:
            async with session.get(f"{ESI_BASE}/universe/types/{type_id}/") as resp:
                data = await resp.json()
                name = data.get("name", str(type_id))
                print(f"{type_id} -> {name}")

            async with SessionLocal() as db:
                obj = (await db.execute(
                    select(TrackedItem).where(TrackedItem.type_id == type_id)
                )).scalar_one_or_none()
                if obj:
                    obj.name = name
                    await db.commit()
                    print(f"  Updated!")
                else:
                    print(f"  Not found in tracked_items")


if __name__ == "__main__":
    asyncio.run(main())
