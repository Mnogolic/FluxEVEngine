from app.esi.client import esi

# Jita — самый популярный торговый хаб, регион The Forge
JITA_REGION_ID = 10000002
JITA_STATION_ID = 60003760

TOP_REGIONS = [
    10000002,  # The Forge (Jita)
    10000043,  # Domain (Amarr)
    10000032,  # Sinq Laison (Dodixie)
    10000042,  # Metropolis (Hek)
    10000030,  # Heimatar (Rens)
]


async def get_market_history(region_id: int, type_id: int) -> list[dict]:
    return await esi.get(f"/markets/{region_id}/history/", type_id=type_id)


async def get_market_orders(region_id: int, type_id: int) -> list[dict]:
    return await esi.get(f"/markets/{region_id}/orders/", type_id=type_id, order_type="all")


async def get_region_types(region_id: int) -> list[int]:
    """Возвращает все type_id которые торгуются в регионе (все страницы)."""
    page, result = 1, []
    while True:
        data = await esi.get(f"/markets/{region_id}/types/", page=page)
        if not data:
            break
        result.extend(data)
        page += 1
    return result


async def get_type_name(type_id: int) -> str:
    data = await esi.get(f"/universe/types/{type_id}/")
    return data.get("name", str(type_id))
