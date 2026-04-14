import aiohttp
from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db.models import MarketHistory, TrackedItem

router = APIRouter(tags=["dashboard"])
templates = Jinja2Templates(directory="templates")

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


async def get_plex_price_isk() -> float:
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://esi.evetech.net/latest/markets/10000002/orders/",
                params={"type_id": PLEX_TYPE_ID, "order_type": "sell"},
            ) as resp:
                orders = await resp.json()
        if not orders:
            return 6_000_000
        return min(o["price"] for o in orders)
    except Exception:
        return 6_000_000


@router.get("/", response_class=HTMLResponse)
async def dashboard(request: Request, db: AsyncSession = Depends(get_db)):
    plex_isk = await get_plex_price_isk()
    isk_per_usd = (PLEX_PER_PACK * plex_isk) / PLEX_PACK_USD

    hub_rows = (await db.execute(
        select(
            MarketHistory.region_id,
            func.sum(MarketHistory.volume * MarketHistory.average).label("isk_total")
        )
        .group_by(MarketHistory.region_id)
        .order_by(func.sum(MarketHistory.volume * MarketHistory.average).desc())
    )).all()

    hub_labels = [REGION_NAMES.get(r.region_id, str(r.region_id)) for r in hub_rows]
    hub_values_isk = [float(r.isk_total) for r in hub_rows]
    hub_values_usd = [round(v / isk_per_usd, 2) for v in hub_values_isk]

    item_rows = (await db.execute(
        select(
            TrackedItem.type_id,
            TrackedItem.name,
            func.sum(MarketHistory.volume * MarketHistory.average).label("isk_total")
        )
        .join(TrackedItem, TrackedItem.type_id == MarketHistory.type_id)
        .where(
            MarketHistory.region_id == 10000002,
            TrackedItem.type_id.notin_([92149, 60459])  # Drone Iteration Data, Rogue Drone Infestation Data
        )
        .group_by(TrackedItem.type_id, TrackedItem.name)
        .order_by(func.sum(MarketHistory.volume * MarketHistory.average).desc())
        .limit(20)
    )).all()

    item_labels = [r.name for r in item_rows]
    item_values_isk = [float(r.isk_total) for r in item_rows]
    item_values_usd = [round(v / isk_per_usd, 2) for v in item_values_isk]

    last_date_row = (await db.execute(select(func.max(MarketHistory.date)))).scalar()
    last_date = last_date_row.strftime("%Y-%m-%d") if last_date_row else "N/A"

    # список товаров для селектора — те же топ 20 что на графике
    selector_items = [{
        "type_id": r.type_id,
        "name": r.name
    } for r in item_rows]

    return templates.TemplateResponse(request, "dashboard.html", {
        "hub_labels": hub_labels,
        "hub_values_isk": hub_values_isk,
        "hub_values_usd": hub_values_usd,
        "item_labels": item_labels,
        "item_values_isk": item_values_isk,
        "item_values_usd": item_values_usd,
        "last_date": last_date,
        "plex_isk": int(plex_isk),
        "selector_items": selector_items,
    })
