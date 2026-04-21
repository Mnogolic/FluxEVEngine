from datetime import date, datetime, time, timedelta

import aiohttp
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MarketHistory, TrackedItem
from app.db.session import get_db

router = APIRouter(prefix="/api/dashboard", tags=["dashboard-data"])

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
HUB_REGION_IDS = tuple(REGION_NAMES.keys())
DEFAULT_ITEM_SCOPE_ID = "10000002"
ALL_TRADE_HUBS_SCOPE_ID = "all"


def normalize_date_range(
    date_from: date | None,
    date_to: date | None,
) -> tuple[date | None, date | None]:
    """Return an ordered date range even if the user swapped the inputs."""
    if date_from and date_to and date_from > date_to:
        return date_to, date_from
    return date_from, date_to


def build_date_filters(
    date_from: date | None,
    date_to: date | None,
):
    """Build inclusive datetime filters for MarketHistory.date."""
    filters = []
    if date_from:
        filters.append(MarketHistory.date >= datetime.combine(date_from, time.min))
    if date_to:
        filters.append(MarketHistory.date < datetime.combine(date_to + timedelta(days=1), time.min))
    return filters


async def get_plex_price_isk() -> float:
    """Fetch the current minimum Jita sell price for one PLEX unit."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://esi.evetech.net/latest/markets/10000002/orders/",
                params={"type_id": PLEX_TYPE_ID, "order_type": "sell"},
            ) as response:
                orders = await response.json()
        if not orders:
            return 6_000_000
        return min(order["price"] for order in orders)
    except Exception:
        return 6_000_000


def item_payload(
    row,
    isk_per_usd: float,
    total_isk: float,
    fixed_region_ids: list[int] | None = None,
    region_id: int | None = None,
) -> dict:
    """Convert an aggregated SQL row into a frontend-friendly payload."""
    isk = float(row.isk_total)
    fixed_region_ids = sorted(fixed_region_ids or [])
    return {
        "type_id": row.type_id,
        "name": row.name,
        "isk": isk,
        "usd": round(isk / isk_per_usd, 2),
        "share": round(isk / total_isk * 100, 4) if total_isk else 0,
        "is_fixed_price": region_id in fixed_region_ids if region_id is not None else False,
        "fixed_region_ids": fixed_region_ids,
    }


def item_scope_payload(
    scope_id: str,
    label: str,
    rows,
    isk_per_usd: float,
    fixed_regions_by_type: dict[int, list[int]],
    region_id: int | None = None,
) -> dict:
    """Convert a grouped item result set into a scope payload."""
    total_isk = sum(float(row.isk_total) for row in rows)
    items = [
        item_payload(
            row,
            isk_per_usd,
            total_isk,
            fixed_region_ids=fixed_regions_by_type.get(row.type_id),
            region_id=region_id,
        )
        for row in rows
    ]
    return {
        "id": scope_id,
        "label": label,
        "region_id": region_id,
        "item_count": len(items),
        "total_isk": total_isk,
        "items": items,
    }


@router.get("/overview")
async def get_dashboard_overview(
    hub_date_from: date | None = None,
    hub_date_to: date | None = None,
    item_date_from: date | None = None,
    item_date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Return aggregated dashboard data for the standalone frontend."""
    hub_date_from, hub_date_to = normalize_date_range(hub_date_from, hub_date_to)
    item_date_from, item_date_to = normalize_date_range(item_date_from, item_date_to)
    hub_date_filters = build_date_filters(hub_date_from, hub_date_to)
    item_date_filters = build_date_filters(item_date_from, item_date_to)
    plex_isk = await get_plex_price_isk()
    isk_per_usd = (PLEX_PER_PACK * plex_isk) / PLEX_PACK_USD
    fixed_rows = (
        await db.execute(
            select(MarketHistory.type_id, MarketHistory.region_id)
            .join(TrackedItem, TrackedItem.type_id == MarketHistory.type_id)
            .where(MarketHistory.region_id.in_(HUB_REGION_IDS))
            .group_by(MarketHistory.type_id, MarketHistory.region_id)
            .having(func.min(MarketHistory.average) == func.max(MarketHistory.average))
        )
    ).all()
    fixed_regions_by_type: dict[int, list[int]] = {}
    for row in fixed_rows:
        fixed_regions_by_type.setdefault(row.type_id, []).append(row.region_id)

    hub_rows = (
        await db.execute(
            select(
                MarketHistory.region_id,
                func.sum(MarketHistory.volume * MarketHistory.average).label("isk_total"),
            )
            .where(*hub_date_filters)
            .group_by(MarketHistory.region_id)
            .order_by(func.sum(MarketHistory.volume * MarketHistory.average).desc())
        )
    ).all()

    hub_labels = [REGION_NAMES.get(row.region_id, str(row.region_id)) for row in hub_rows]
    hub_values_isk = [float(row.isk_total) for row in hub_rows]
    hub_values_usd = [round(value / isk_per_usd, 2) for value in hub_values_isk]
    item_rows_by_region = {region_id: [] for region_id in HUB_REGION_IDS}
    region_item_rows = (
        await db.execute(
            select(
                MarketHistory.region_id,
                TrackedItem.type_id,
                TrackedItem.name,
                func.sum(MarketHistory.volume * MarketHistory.average).label("isk_total"),
            )
            .join(TrackedItem, TrackedItem.type_id == MarketHistory.type_id)
            .where(MarketHistory.region_id.in_(HUB_REGION_IDS), *item_date_filters)
            .group_by(MarketHistory.region_id, TrackedItem.type_id, TrackedItem.name)
            .order_by(
                MarketHistory.region_id,
                func.sum(MarketHistory.volume * MarketHistory.average).desc(),
            )
        )
    ).all()
    for row in region_item_rows:
        item_rows_by_region.setdefault(row.region_id, []).append(row)

    all_trade_hubs_rows = (
        await db.execute(
            select(
                TrackedItem.type_id,
                TrackedItem.name,
                func.sum(MarketHistory.volume * MarketHistory.average).label("isk_total"),
            )
            .join(TrackedItem, TrackedItem.type_id == MarketHistory.type_id)
            .where(MarketHistory.region_id.in_(HUB_REGION_IDS), *item_date_filters)
            .group_by(TrackedItem.type_id, TrackedItem.name)
            .order_by(func.sum(MarketHistory.volume * MarketHistory.average).desc())
        )
    ).all()
    item_scopes = [
        item_scope_payload(
            str(region_id),
            region_name,
            item_rows_by_region.get(region_id, []),
            isk_per_usd,
            fixed_regions_by_type,
            region_id=region_id,
        )
        for region_id, region_name in REGION_NAMES.items()
    ]
    item_scopes.append(
        item_scope_payload(
            ALL_TRADE_HUBS_SCOPE_ID,
            "Top 5 Trade Hubs",
            all_trade_hubs_rows,
            isk_per_usd,
            fixed_regions_by_type,
        )
    )

    first_date_row = (await db.execute(select(func.min(MarketHistory.date)))).scalar()
    last_date_row = (await db.execute(select(func.max(MarketHistory.date)))).scalar()
    first_date = first_date_row.strftime("%Y-%m-%d") if first_date_row else "N/A"
    last_date = last_date_row.strftime("%Y-%m-%d") if last_date_row else "N/A"

    return {
        "default_item_scope_id": DEFAULT_ITEM_SCOPE_ID,
        "first_date": first_date,
        "hub_labels": hub_labels,
        "hub_values_isk": hub_values_isk,
        "hub_values_usd": hub_values_usd,
        "hub_date_from": hub_date_from.isoformat() if hub_date_from else None,
        "hub_date_to": hub_date_to.isoformat() if hub_date_to else None,
        "item_date_from": item_date_from.isoformat() if item_date_from else None,
        "item_date_to": item_date_to.isoformat() if item_date_to else None,
        "item_scopes": item_scopes,
        "last_date": last_date,
        "plex_isk": int(plex_isk),
        "regions": [
            {"id": region_id, "name": region_name}
            for region_id, region_name in REGION_NAMES.items()
        ],
    }
