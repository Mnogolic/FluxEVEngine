"""
Анализ и прогноз цен через линейную регрессию по всем регионам.
"""
import asyncio
import logging
import numpy as np
from sqlalchemy import select, func
from app.db.session import SessionLocal
from app.db.models import MarketHistory, TrackedItem

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

REGIONS = {
    10000002: "Jita",
    10000043: "Amarr",
    10000032: "Dodixie",
    10000042: "Hek",
    10000030: "Rens",
}


def linear_regression(x, y):
    x = np.array(x, dtype=float)
    y = np.array(y, dtype=float)
    coeffs = np.polyfit(x, y, 1)
    slope, intercept = coeffs
    y_pred = np.polyval(coeffs, x)
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0
    mae = np.mean(np.abs(y - y_pred))
    return float(slope), float(intercept), float(r2), float(mae)


async def analyze_region(db, region_id: int, region_name: str):
    top_raw = (await db.execute(
        select(MarketHistory.type_id, func.count(MarketHistory.id).label("cnt"))
        .where(MarketHistory.region_id == region_id)
        .group_by(MarketHistory.type_id)
        .order_by(func.count(MarketHistory.id).desc())
        .limit(10)
    )).all()

    if not top_raw:
        logger.warning(f"No data for region {region_name}")
        return

    type_ids = [r.type_id for r in top_raw]
    names_raw = (await db.execute(
        select(TrackedItem.type_id, TrackedItem.name)
        .where(TrackedItem.type_id.in_(type_ids))
    )).all()
    names = {r.type_id: r.name for r in names_raw}

    print(f"\n{'='*72}")
    print(f"  Region: {region_name} | Top 10 items | Forecast: +7 days")
    print(f"{'='*72}")
    print(f"  {'Item':<32} {'Trend':>10} {'R2':>6} {'MAE':>12} {'Now':>10} {'7d':>10} {'Pts':>5}")
    print(f"  {'-'*70}")

    for r in top_raw:
        type_id, cnt = r.type_id, r.cnt
        name = names.get(type_id, str(type_id))

        rows = (await db.execute(
            select(MarketHistory.date, MarketHistory.average)
            .where(MarketHistory.type_id == type_id, MarketHistory.region_id == region_id)
            .order_by(MarketHistory.date.asc())
        )).all()

        if len(rows) < 2:
            continue

        base = rows[0].date
        x = [(r.date - base).days for r in rows]
        y = [r.average for r in rows]

        slope, intercept, r2, mae = linear_regression(x, y)
        forecast = slope * (x[-1] + 7) + intercept
        current = y[-1]
        trend = "up" if slope > 0 else "down"

        print(f"  {name[:31]:<32} {trend:<10} {r2:>6.3f} {mae:>12.2f} {current:>10.2f} {forecast:>10.2f} {cnt:>5}")

    print(f"{'='*72}")


async def main():
    logger.info("=" * 60)
    logger.info("FluxEV Engine - Price Trend Analysis (Linear Regression)")
    logger.info("=" * 60)

    async with SessionLocal() as db:
        total = (await db.execute(
            select(func.count()).select_from(MarketHistory)
        )).scalar()
        logger.info(f"Total rows in market_history: {total}")

        for region_id, region_name in REGIONS.items():
            cnt = (await db.execute(
                select(func.count()).select_from(MarketHistory)
                .where(MarketHistory.region_id == region_id)
            )).scalar()
            logger.info(f"  {region_name:<12}: {cnt} rows")

        logger.info("-" * 60)
        logger.info("Running regression analysis...")

        for region_id, region_name in REGIONS.items():
            await analyze_region(db, region_id, region_name)

    logger.info("\nAnalysis complete.")


if __name__ == "__main__":
    asyncio.run(main())
