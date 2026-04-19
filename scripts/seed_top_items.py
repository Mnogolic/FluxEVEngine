"""
Одноразовый скрипт: находит топ 1000 товаров по volume в Jita за последний доступный день
и сохраняет их в tracked_items.
"""
import asyncio
import aiohttp
from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.models import TrackedItem

JITA_REGION_ID = 10000002
ESI_BASE = "https://esi.evetech.net/latest"
TOP_N = 1000


async def fetch_json(session: aiohttp.ClientSession, url: str, **params) -> list | dict:
    async with session.get(url, params=params) as resp:
        resp.raise_for_status()
        return await resp.json()


async def get_all_type_ids(session: aiohttp.ClientSession) -> list[int]:
    page, result = 1, []
    while True:
        try:
            data = await fetch_json(session, f"{ESI_BASE}/markets/{JITA_REGION_ID}/types/", page=page)
        except aiohttp.ClientResponseError as e:
            if e.status == 404:
                break
            raise
        if not data:
            break
        result.extend(data)
        page += 1
        print(f"  types page {page}, total so far: {len(result)}")
    return result


async def get_volume_for_type(session: aiohttp.ClientSession, type_id: int) -> tuple[int, int]:
    try:
        history = await fetch_json(session, f"{ESI_BASE}/markets/{JITA_REGION_ID}/history/", type_id=type_id)
        if not history:
            return type_id, 0
        latest = sorted(history, key=lambda x: x["date"])[-1]
        return type_id, latest["volume"]
    except Exception:
        return type_id, 0


async def get_type_name(session: aiohttp.ClientSession, type_id: int) -> str:
    try:
        data = await fetch_json(session, f"{ESI_BASE}/universe/types/{type_id}/")
        return data.get("name", str(type_id))
    except Exception:
        return str(type_id)


async def main():
    async with aiohttp.ClientSession() as session:
        print("Fetching all type_ids from Jita...")
        type_ids = await get_all_type_ids(session)
        print(f"Total types in Jita: {len(type_ids)}")

        print("Fetching volume for each type (this will take a few minutes)...")
        volumes = {}
        for i in range(0, len(type_ids), 50):
            batch = type_ids[i:i+50]
            results = await asyncio.gather(*[get_volume_for_type(session, tid) for tid in batch])
            for type_id, volume in results:
                volumes[type_id] = volume
            if i % 500 == 0:
                print(f"  processed {i}/{len(type_ids)}")

        print("Sorting by volume...")
        top1000 = sorted(volumes.items(), key=lambda x: x[1], reverse=True)[:TOP_N]

        print(f"Fetching names for top {TOP_N} items...")
        items = []
        for i, (type_id, volume) in enumerate(top1000):
            name = await get_type_name(session, type_id)
            items.append({"type_id": type_id, "name": name, "volume": volume})
            if i % 100 == 0:
                print(f"  {i}/{TOP_N} - {name}: {volume:,}")

    print("Saving to database...")
    async with SessionLocal() as db:
        for item in items:
            existing = await db.execute(select(TrackedItem).where(TrackedItem.type_id == item["type_id"]))
            if not existing.scalar_one_or_none():
                db.add(TrackedItem(type_id=item["type_id"], name=item["name"]))
        await db.commit()

    print(f"Done! Saved {len(items)} items to tracked_items.")
    for item in items[:10]:
        print(f"  #{items.index(item)+1} {item['name']} (type_id={item['type_id']}) - volume: {item['volume']:,}")


if __name__ == "__main__":
    asyncio.run(main())
