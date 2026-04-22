import numpy as np
from datetime import date, datetime, time, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.schemas import (
    ForecastMethodInfo,
    MarketForecastComparisonResponse,
    MarketForecastResponse,
)
from app.db.session import get_db
from app.db.models import TrackedItem, MarketHistory
from app.forecasting import (
    FORECAST_METHODS,
    ForecastModelError,
    build_compare_result,
    build_forecast_result,
    list_forecast_methods,
)

router = APIRouter(prefix="/market", tags=["market"])


def normalize_date_range(
    date_from: date | None,
    date_to: date | None,
) -> tuple[date | None, date | None]:
    """Return an ordered date range even if the user swapped inputs."""
    if date_from and date_to and date_from > date_to:
        return date_to, date_from
    return date_from, date_to


def serialize_price_rows(rows) -> tuple[list[str], list[float]]:
    """Convert market history rows into chart-friendly date and value arrays."""
    return [r.date.strftime("%Y-%m-%d") for r in rows], [r.average for r in rows]


def calculate_linear_forecast(
    rows,
    forecast_days: int,
    *,
    include_anchor_point: bool,
) -> tuple[list[str], list[float], float, float]:
    """Fit a linear model and forecast the next N days from the final row."""
    if len(rows) < 3 or forecast_days <= 0:
        return [], [], 0.0, 0.0

    base = rows[0].date
    x = np.array([(r.date - base).days for r in rows], dtype=float)
    y = np.array([r.average for r in rows], dtype=float)
    coeffs = np.polyfit(x, y, 1)
    slope = float(coeffs[0])
    y_pred = np.polyval(coeffs, x)
    ss_res = float(np.sum((y - y_pred) ** 2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    r2 = round(1 - ss_res / ss_tot, 4) if ss_tot > 0 else 0.0

    forecast_dates: list[str] = []
    forecast_values: list[float] = []
    last_x = x[-1]
    last_row = rows[-1]

    if include_anchor_point:
        forecast_dates.append(last_row.date.strftime("%Y-%m-%d"))
        forecast_values.append(round(float(last_row.average), 4))

    for i in range(1, forecast_days + 1):
        forecast_dates.append((last_row.date + timedelta(days=i)).strftime("%Y-%m-%d"))
        forecast_values.append(round(float(np.polyval(coeffs, last_x + i)), 4))

    return forecast_dates, forecast_values, round(slope, 6), r2


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


@router.get("/forecast-methods", response_model=list[ForecastMethodInfo])
async def get_forecast_methods():
    """Return all forecast methods available to the comparison API."""
    return list_forecast_methods()


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

    dates, values = serialize_price_rows(rows)
    is_fixed_price = len(set(values)) == 1

    forecast_dates, forecast_values, slope, r2 = calculate_linear_forecast(
        rows,
        forecast_days=7,
        include_anchor_point=False,
    )

    return {
        "dates": dates,
        "values": values,
        "forecast_dates": forecast_dates,
        "forecast_values": forecast_values,
        "slope": round(slope, 6),
        "r2": r2,
        "is_fixed_price": is_fixed_price,
    }


def parse_method_list(methods: str | None) -> list[str]:
    if not methods:
        return []
    return [value.strip() for value in methods.split(",") if value.strip()]


def build_empty_forecast_response(
    *,
    method: str,
    actual_rows,
    forecast_days: int,
    validation_days: int,
):
    actual_dates, actual_values = serialize_price_rows(actual_rows)
    return {
        "method": method,
        "method_label": FORECAST_METHODS.get(method, FORECAST_METHODS["linear"]).label,
        "actual_dates": actual_dates,
        "actual_values": actual_values,
        "forecast_dates": [],
        "forecast_values": [],
        "training_date_from": None,
        "training_date_to": None,
        "first_actual_date": actual_dates[0] if actual_dates else None,
        "last_actual_date": actual_dates[-1] if actual_dates else None,
        "actual_data_point_count": len(actual_rows),
        "training_data_point_count": 0,
        "forecast_days": max(1, min(int(forecast_days), 90)),
        "validation_days": max(0, min(int(validation_days), 30)),
        "is_fixed_price": len(set(actual_values)) == 1 if actual_values else False,
        "slope": None,
        "r2": None,
        "metrics": {},
        "warning": None,
    }


async def load_forecast_rows(
    *,
    db: AsyncSession,
    type_id: int,
    region_id: int,
    date_from: date | None,
    date_to: date | None,
):
    date_from, date_to = normalize_date_range(date_from, date_to)
    rows = (await db.execute(
        select(MarketHistory.date, MarketHistory.average)
        .where(MarketHistory.type_id == type_id, MarketHistory.region_id == region_id)
        .order_by(MarketHistory.date.asc())
    )).all()

    filtered_rows = [
        row
        for row in rows
        if (date_from is None or row.date.date() >= date_from)
        and (date_to is None or row.date.date() <= date_to)
    ]
    return rows, filtered_rows


@router.get("/forecast/compare/{type_id}", response_model=MarketForecastComparisonResponse)
async def compare_price_forecasts(
    type_id: int,
    region_id: int = 10000002,
    date_from: date | None = None,
    date_to: date | None = None,
    forecast_days: int = 7,
    validation_days: int = 7,
    methods: str | None = Query(
        default=None,
        description="Comma-separated forecast methods. Defaults to holt_winters,arima,autoreg.",
    ),
    db: AsyncSession = Depends(get_db),
):
    """Return several forecast models side by side for the same item and time window."""
    date_from, date_to = normalize_date_range(date_from, date_to)
    rows, forecast_source_rows = await load_forecast_rows(
        db=db,
        type_id=type_id,
        region_id=region_id,
        date_from=date_from,
        date_to=date_to,
    )

    if not rows:
        return {
            "actual_dates": [],
            "actual_values": [],
            "training_date_from": None,
            "training_date_to": None,
            "first_actual_date": None,
            "last_actual_date": None,
            "actual_data_point_count": 0,
            "training_data_point_count": 0,
            "forecast_days": max(1, min(int(forecast_days), 90)),
            "validation_days": max(0, min(int(validation_days), 30)),
            "is_fixed_price": False,
            "methods": [],
            "best_method_by_validation_mae": None,
        }

    selected_methods = parse_method_list(methods)
    has_explicit_training_range = date_from is not None or date_to is not None
    compare_rows = forecast_source_rows if has_explicit_training_range else rows
    if not compare_rows:
        return {
            "actual_dates": [row.date.strftime("%Y-%m-%d") for row in rows],
            "actual_values": [row.average for row in rows],
            "training_date_from": None,
            "training_date_to": None,
            "first_actual_date": rows[0].date.strftime("%Y-%m-%d"),
            "last_actual_date": rows[-1].date.strftime("%Y-%m-%d"),
            "actual_data_point_count": len(rows),
            "training_data_point_count": 0,
            "forecast_days": max(1, min(int(forecast_days), 90)),
            "validation_days": max(0, min(int(validation_days), 30)),
            "is_fixed_price": len({row.average for row in rows}) == 1,
            "methods": [],
            "best_method_by_validation_mae": None,
        }

    payload = build_compare_result(
        compare_rows,
        methods=selected_methods if methods is not None else None,
        forecast_days=forecast_days,
        validation_days=validation_days,
        include_anchor_point=True,
    )
    actual_dates, actual_values = serialize_price_rows(rows)
    payload["actual_dates"] = actual_dates
    payload["actual_values"] = actual_values
    payload["first_actual_date"] = actual_dates[0] if actual_dates else None
    payload["last_actual_date"] = actual_dates[-1] if actual_dates else None
    payload["actual_data_point_count"] = len(rows)
    payload["is_fixed_price"] = len(set(actual_values)) == 1 if actual_values else False
    return payload


@router.get("/forecast/{type_id}", response_model=MarketForecastResponse)
async def get_price_forecast(
    type_id: int,
    region_id: int = 10000002,
    date_from: date | None = None,
    date_to: date | None = None,
    forecast_days: int = 7,
    validation_days: int = 7,
    method: str = Query(
        default="linear",
        description=f"Forecast method. Supported: {', '.join(FORECAST_METHODS.keys())}.",
    ),
    db: AsyncSession = Depends(get_db),
):
    """Return full actual history plus a forecast trained on the chosen period."""
    date_from, date_to = normalize_date_range(date_from, date_to)
    rows, forecast_source_rows = await load_forecast_rows(
        db=db,
        type_id=type_id,
        region_id=region_id,
        date_from=date_from,
        date_to=date_to,
    )

    if not rows:
        return build_empty_forecast_response(
            method=method,
            actual_rows=[],
            forecast_days=forecast_days,
            validation_days=validation_days,
        )

    has_explicit_training_range = date_from is not None or date_to is not None
    target_rows = forecast_source_rows if has_explicit_training_range else rows
    if not target_rows:
        return build_empty_forecast_response(
            method=method,
            actual_rows=rows,
            forecast_days=forecast_days,
            validation_days=validation_days,
        )

    try:
        payload = build_forecast_result(
            target_rows,
            method=method,
            forecast_days=forecast_days,
            validation_days=validation_days,
            include_anchor_point=True,
        )
        actual_dates, actual_values = serialize_price_rows(rows)
        payload["actual_dates"] = actual_dates
        payload["actual_values"] = actual_values
        payload["first_actual_date"] = actual_dates[0] if actual_dates else None
        payload["last_actual_date"] = actual_dates[-1] if actual_dates else None
        payload["actual_data_point_count"] = len(rows)
        payload["is_fixed_price"] = len(set(actual_values)) == 1 if actual_values else False
        return payload
    except ForecastModelError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
