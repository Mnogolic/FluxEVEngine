import numpy as np
from datetime import date, datetime, time, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db.models import TrackedItem, MarketHistory

router = APIRouter(prefix="/market", tags=["market"])


def normalize_date_range(
    date_from: date | None,
    date_to: date | None,
) -> tuple[date | None, date | None]:
    """Return an ordered date range even if the user swapped inputs."""
    if date_from and date_to and date_from > date_to:
        return date_to, date_from
    return date_from, date_to


@router.get("/items")
async def list_tracked_items(db: AsyncSession = Depends(get_db)):
    """Return the full tracked item list ordered by item name."""
    result = await db.execute(select(TrackedItem).order_by(TrackedItem.name))
    return result.scalars().all()


@router.get("/history/{type_id}")
async def get_history(type_id: int, region_id: int = 10000002, db: AsyncSession = Depends(get_db)):
    """Return up to 30 latest historical price rows for one item and region."""
    result = await db.execute(
        select(MarketHistory)
        .where(MarketHistory.type_id == type_id, MarketHistory.region_id == region_id)
        .order_by(MarketHistory.date.desc())
        .limit(30)
    )
    return result.scalars().all()


@router.get("/price/{type_id}")
async def get_price_chart(
    type_id: int,
    region_id: int = 10000002,
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Return chart-ready price history with a 7-day linear forecast.

    The response includes the historical series, forecasted values, trend
    slope, coefficient of determination (R2), and a flag for fixed-price items.
    """
    date_from, date_to = normalize_date_range(date_from, date_to)
    filters = [MarketHistory.type_id == type_id, MarketHistory.region_id == region_id]
    if date_from:
        filters.append(MarketHistory.date >= datetime.combine(date_from, time.min))
    if date_to:
        filters.append(MarketHistory.date < datetime.combine(date_to + timedelta(days=1), time.min))

    rows = (await db.execute(
        select(MarketHistory.date, MarketHistory.average)
        .where(*filters)
        .order_by(MarketHistory.date.asc())
    )).all()

    if not rows:
        return {
            "dates": [],
            "values": [],
            "forecast_dates": [],
            "forecast_values": [],
            "slope": 0,
            "r2": 0,
            "is_fixed_price": False,
        }

    dates = [r.date.strftime("%Y-%m-%d") for r in rows]
    values = [r.average for r in rows]
    is_fixed_price = len(set(values)) == 1

    forecast_dates, forecast_values, slope, r2 = [], [], 0.0, 0.0

    if len(rows) >= 3:
        base = rows[0].date
        x = np.array([(r.date - base).days for r in rows], dtype=float)
        y = np.array(values, dtype=float)
        coeffs = np.polyfit(x, y, 1)
        slope = float(coeffs[0])
        y_pred = np.polyval(coeffs, x)
        ss_res = float(np.sum((y - y_pred) ** 2))
        ss_tot = float(np.sum((y - np.mean(y)) ** 2))
        r2 = round(1 - ss_res / ss_tot, 4) if ss_tot > 0 else 0.0

        last_x = x[-1]
        for i in range(1, 8):
            forecast_dates.append((rows[-1].date + timedelta(days=i)).strftime("%Y-%m-%d"))
            forecast_values.append(round(float(np.polyval(coeffs, last_x + i)), 4))

    return {
        "dates": dates,
        "values": values,
        "forecast_dates": forecast_dates,
        "forecast_values": forecast_values,
        "slope": round(slope, 6),
        "r2": r2,
        "is_fixed_price": is_fixed_price,
    }
