from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from math import sqrt
import warnings

import numpy as np
from statsmodels.tools.sm_exceptions import ConvergenceWarning


class ForecastModelError(RuntimeError):
    """Raised when a forecasting model cannot produce a result."""


@dataclass(frozen=True)
class ForecastMethodDefinition:
    id: str
    label: str
    description: str
    min_training_points: int
    optional_dependency: bool = False


FORECAST_METHODS: dict[str, ForecastMethodDefinition] = {
    "linear": ForecastMethodDefinition(
        id="linear",
        label="Linear Regression",
        description="Baseline linear approximation used by the current dashboard.",
        min_training_points=3,
    ),
    "holt_winters": ForecastMethodDefinition(
        id="holt_winters",
        label="Holt-Winters ETS",
        description="Exponential smoothing with additive trend for level and momentum.",
        min_training_points=4,
        optional_dependency=True,
    ),
    "arima": ForecastMethodDefinition(
        id="arima",
        label="ARIMA",
        description="Auto-tuned autoregressive integrated moving average for short-horizon price dynamics.",
        min_training_points=8,
        optional_dependency=True,
    ),
    "autoreg": ForecastMethodDefinition(
        id="autoreg",
        label="AutoReg",
        description="Autoregressive model that predicts prices from recent lagged values.",
        min_training_points=8,
        optional_dependency=True,
    ),
}


def list_forecast_methods() -> list[dict[str, object]]:
    return [
        {
            "id": definition.id,
            "label": definition.label,
            "description": definition.description,
            "min_training_points": definition.min_training_points,
            "optional_dependency": definition.optional_dependency,
        }
        for definition in FORECAST_METHODS.values()
    ]


def build_forecast_result(
    rows,
    *,
    method: str,
    forecast_days: int,
    validation_days: int,
    include_anchor_point: bool,
) -> dict[str, object]:
    if method not in FORECAST_METHODS:
        supported = ", ".join(FORECAST_METHODS.keys())
        raise ForecastModelError(f"Unknown forecast method '{method}'. Supported methods: {supported}.")

    definition = FORECAST_METHODS[method]
    bounded_forecast_days = max(1, min(int(forecast_days), 90))
    bounded_validation_days = max(0, min(int(validation_days), 30))

    if len(rows) < definition.min_training_points:
        raise ForecastModelError(
            f"Method '{method}' needs at least {definition.min_training_points} training points."
        )

    actual_dates = [_format_date(row.date) for row in rows]
    actual_values = [round(float(row.average), 4) for row in rows]
    is_fixed_price = len(set(actual_values)) == 1

    model_result = _fit_and_forecast_model(
        method,
        rows,
        forecast_days=bounded_forecast_days,
        include_anchor_point=include_anchor_point,
    )
    metrics = dict(model_result["metrics"])

    if bounded_validation_days > 0:
        validation_metrics = _calculate_validation_metrics(
            method,
            rows,
            validation_days=bounded_validation_days,
        )
        metrics.update(validation_metrics)

    return {
        "method": method,
        "method_label": definition.label,
        "actual_dates": actual_dates,
        "actual_values": actual_values,
        "forecast_dates": model_result["forecast_dates"],
        "forecast_values": model_result["forecast_values"],
        "training_date_from": actual_dates[0] if actual_dates else None,
        "training_date_to": actual_dates[-1] if actual_dates else None,
        "first_actual_date": actual_dates[0] if actual_dates else None,
        "last_actual_date": actual_dates[-1] if actual_dates else None,
        "actual_data_point_count": len(rows),
        "training_data_point_count": len(rows),
        "forecast_days": bounded_forecast_days,
        "validation_days": bounded_validation_days,
        "is_fixed_price": is_fixed_price,
        "slope": metrics.get("slope"),
        "r2": metrics.get("r2"),
        "metrics": metrics,
        "warning": model_result.get("warning"),
    }


def build_compare_result(
    rows,
    *,
    methods: list[str] | None,
    forecast_days: int,
    validation_days: int,
    include_anchor_point: bool,
) -> dict[str, object]:
    chosen_methods = methods or ["holt_winters", "arima", "autoreg"]
    actual_dates = [_format_date(row.date) for row in rows]
    actual_values = [round(float(row.average), 4) for row in rows]
    bounded_forecast_days = max(1, min(int(forecast_days), 90))
    bounded_validation_days = max(0, min(int(validation_days), 30))

    results: list[dict[str, object]] = []
    best_method: str | None = None
    best_mae: float | None = None

    for method in chosen_methods:
        definition = FORECAST_METHODS.get(method)
        if definition is None:
            results.append(
                {
                    "method": method,
                    "method_label": method,
                    "status": "error",
                    "forecast_dates": [],
                    "forecast_values": [],
                    "metrics": {},
                    "warning": None,
                    "error": f"Unknown forecast method '{method}'.",
                }
            )
            continue

        try:
            payload = build_forecast_result(
                rows,
                method=method,
                forecast_days=bounded_forecast_days,
                validation_days=bounded_validation_days,
                include_anchor_point=include_anchor_point,
            )
            validation_mae = payload["metrics"].get("validation_mae")
            if isinstance(validation_mae, (int, float)) and validation_mae >= 0:
                if best_mae is None or validation_mae < best_mae:
                    best_mae = float(validation_mae)
                    best_method = method

            results.append(
                {
                    "method": method,
                    "method_label": definition.label,
                    "status": "ok",
                    "forecast_dates": payload["forecast_dates"],
                    "forecast_values": payload["forecast_values"],
                    "metrics": payload["metrics"],
                    "warning": payload.get("warning"),
                    "error": None,
                }
            )
        except ForecastModelError as error:
            results.append(
                {
                    "method": method,
                    "method_label": definition.label,
                    "status": "error",
                    "forecast_dates": [],
                    "forecast_values": [],
                    "metrics": {},
                    "warning": None,
                    "error": str(error),
                }
            )

    return {
        "actual_dates": actual_dates,
        "actual_values": actual_values,
        "training_date_from": actual_dates[0] if actual_dates else None,
        "training_date_to": actual_dates[-1] if actual_dates else None,
        "first_actual_date": actual_dates[0] if actual_dates else None,
        "last_actual_date": actual_dates[-1] if actual_dates else None,
        "actual_data_point_count": len(rows),
        "training_data_point_count": len(rows),
        "forecast_days": bounded_forecast_days,
        "validation_days": bounded_validation_days,
        "is_fixed_price": len(set(actual_values)) == 1 if actual_values else False,
        "methods": results,
        "best_method_by_validation_mae": best_method,
    }


def _calculate_validation_metrics(
    method: str,
    rows,
    *,
    validation_days: int,
) -> dict[str, float | None]:
    definition = FORECAST_METHODS[method]
    if validation_days <= 0:
        return {}

    if len(rows) <= validation_days:
        return {}

    train_rows = rows[:-validation_days]
    validation_rows = rows[-validation_days:]

    if len(train_rows) < definition.min_training_points:
        return {}

    forecast_result = _fit_and_forecast_model(
        method,
        train_rows,
        forecast_days=len(validation_rows),
        include_anchor_point=False,
    )
    predicted = forecast_result["forecast_values"][: len(validation_rows)]
    actual = [float(row.average) for row in validation_rows]
    metrics = _error_metrics(actual, predicted)

    return {
        "validation_mae": metrics["mae"],
        "validation_rmse": metrics["rmse"],
        "validation_mape": metrics["mape"],
    }


def _fit_and_forecast_model(
    method: str,
    rows,
    *,
    forecast_days: int,
    include_anchor_point: bool,
) -> dict[str, object]:
    if method == "linear":
        return _fit_linear_model(rows, forecast_days=forecast_days, include_anchor_point=include_anchor_point)
    if method == "holt_winters":
        return _fit_holt_winters_model(
            rows,
            forecast_days=forecast_days,
            include_anchor_point=include_anchor_point,
        )
    if method == "arima":
        return _fit_arima_model(rows, forecast_days=forecast_days, include_anchor_point=include_anchor_point)
    if method == "autoreg":
        return _fit_autoreg_model(rows, forecast_days=forecast_days, include_anchor_point=include_anchor_point)
    raise ForecastModelError(f"Unsupported forecast method '{method}'.")


def _fit_linear_model(rows, *, forecast_days: int, include_anchor_point: bool) -> dict[str, object]:
    x, y = _extract_xy(rows)
    coeffs = np.polyfit(x, y, 1)
    y_pred = np.polyval(coeffs, x)
    slope = round(float(coeffs[0]), 6)
    metrics = _error_metrics(y, y_pred)
    metrics["slope"] = slope
    last_x = x[-1]

    future_values = [float(np.polyval(coeffs, last_x + i)) for i in range(1, forecast_days + 1)]
    return {
        "forecast_dates": _future_dates(rows, forecast_days, include_anchor_point=include_anchor_point),
        "forecast_values": _future_values(rows, future_values, include_anchor_point=include_anchor_point),
        "metrics": metrics,
        "warning": None,
    }


def _fit_holt_winters_model(rows, *, forecast_days: int, include_anchor_point: bool) -> dict[str, object]:
    _, y = _extract_xy(rows)
    if _is_constant_series(y):
        return _constant_series_result(rows, forecast_days=forecast_days, include_anchor_point=include_anchor_point)

    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
    except ImportError as error:
        raise ForecastModelError(
            "Holt-Winters requires the optional dependency 'statsmodels'."
        ) from error

    candidates = _build_holt_winters_candidates(len(y))
    selected_candidate = _select_best_candidate(
        y,
        candidates=candidates,
        min_training_points=FORECAST_METHODS["holt_winters"].min_training_points,
        fit_predict=_fit_holt_winters_candidate,
    )

    try:
        fitted_values, future_values = _fit_holt_winters_candidate(
            y,
            selected_candidate,
            forecast_days=forecast_days,
        )
    except Exception as error:  # pragma: no cover - library-specific edge cases
        raise ForecastModelError(f"Holt-Winters failed to fit: {error}") from error

    metrics = _error_metrics(y, fitted_values)
    return {
        "forecast_dates": _future_dates(rows, forecast_days, include_anchor_point=include_anchor_point),
        "forecast_values": _future_values(rows, future_values, include_anchor_point=include_anchor_point),
        "metrics": metrics,
        "warning": (
            "Auto-selected ETS config: "
            f"trend={selected_candidate['trend'] or 'none'}, "
            f"damped={selected_candidate['damped_trend']}, "
            f"seasonal={selected_candidate['seasonal'] or 'none'}, "
            f"periods={selected_candidate['seasonal_periods'] or '-'}."
        ),
    }


def _fit_arima_model(rows, *, forecast_days: int, include_anchor_point: bool) -> dict[str, object]:
    _, y = _extract_xy(rows)
    if _is_constant_series(y):
        return _constant_series_result(rows, forecast_days=forecast_days, include_anchor_point=include_anchor_point)

    try:
        from statsmodels.tsa.arima.model import ARIMA
    except ImportError as error:
        raise ForecastModelError("ARIMA requires the optional dependency 'statsmodels'.") from error

    selected_candidate = _select_best_candidate(
        y,
        candidates=_build_arima_candidates(),
        min_training_points=FORECAST_METHODS["arima"].min_training_points,
        fit_predict=_fit_arima_candidate,
    )

    try:
        fitted_values, future_values = _fit_arima_candidate(
            y,
            selected_candidate,
            forecast_days=forecast_days,
        )
    except Exception as error:  # pragma: no cover - library-specific edge cases
        raise ForecastModelError(f"ARIMA failed to fit: {error}") from error

    metrics = _error_metrics(y, fitted_values)
    return {
        "forecast_dates": _future_dates(rows, forecast_days, include_anchor_point=include_anchor_point),
        "forecast_values": _future_values(rows, future_values, include_anchor_point=include_anchor_point),
        "metrics": metrics,
        "warning": (
            f"Auto-selected ARIMA order: {selected_candidate['order']}"
            + (
                f" with seasonal_order={selected_candidate['seasonal_order']}."
                if selected_candidate.get("seasonal_order") is not None
                else "."
            )
        ),
    }


def _fit_autoreg_model(rows, *, forecast_days: int, include_anchor_point: bool) -> dict[str, object]:
    _, y = _extract_xy(rows)
    if _is_constant_series(y):
        return _constant_series_result(rows, forecast_days=forecast_days, include_anchor_point=include_anchor_point)

    try:
        from statsmodels.tsa.ar_model import AutoReg
    except ImportError as error:
        raise ForecastModelError("AutoReg requires the optional dependency 'statsmodels'.") from error

    try:
        lag_count = max(1, min(7, len(y) // 3))
        fitted = AutoReg(y, lags=lag_count, old_names=False).fit()
        fitted_values = np.asarray(fitted.fittedvalues, dtype=float)
        future_values = np.asarray(
            fitted.predict(start=len(y), end=len(y) + forecast_days - 1, dynamic=False),
            dtype=float,
        )
    except Exception as error:  # pragma: no cover - library-specific edge cases
        raise ForecastModelError(f"AutoReg failed to fit: {error}") from error

    metrics = _error_metrics(y[-len(fitted_values) :], fitted_values)
    return {
        "forecast_dates": _future_dates(rows, forecast_days, include_anchor_point=include_anchor_point),
        "forecast_values": _future_values(rows, future_values, include_anchor_point=include_anchor_point),
        "metrics": metrics,
        "warning": None,
    }


def _constant_series_result(rows, *, forecast_days: int, include_anchor_point: bool) -> dict[str, object]:
    constant_value = float(rows[-1].average)
    future_values = [constant_value] * forecast_days
    return {
        "forecast_dates": _future_dates(rows, forecast_days, include_anchor_point=include_anchor_point),
        "forecast_values": _future_values(rows, future_values, include_anchor_point=include_anchor_point),
        "metrics": {
            "mae": 0.0,
            "rmse": 0.0,
            "mape": 0.0,
            "r2": 1.0,
            "slope": 0.0,
        },
        "warning": "Series is constant; forecast repeats the latest price.",
    }


def _extract_xy(rows) -> tuple[np.ndarray, np.ndarray]:
    base = rows[0].date
    x = np.array([(row.date - base).days for row in rows], dtype=float)
    y = np.array([float(row.average) for row in rows], dtype=float)
    return x, y


def _future_dates(rows, forecast_days: int, *, include_anchor_point: bool) -> list[str]:
    last_row = rows[-1]
    forecast_dates: list[str] = []
    if include_anchor_point:
        forecast_dates.append(_format_date(last_row.date))

    for offset in range(1, forecast_days + 1):
        forecast_dates.append(_format_date(last_row.date + timedelta(days=offset)))
    return forecast_dates


def _future_values(rows, future_values, *, include_anchor_point: bool) -> list[float]:
    values = [round(float(value), 4) for value in future_values]
    if include_anchor_point:
        return [round(float(rows[-1].average), 4), *values]
    return values


def _build_holt_winters_candidates(series_length: int) -> list[dict[str, object]]:
    candidates = [
        {
            "trend": "add",
            "damped_trend": False,
            "seasonal": None,
            "seasonal_periods": None,
        },
        {
            "trend": "add",
            "damped_trend": True,
            "seasonal": None,
            "seasonal_periods": None,
        },
    ]

    if series_length >= 14:
        candidates.extend(
            [
                {
                    "trend": "add",
                    "damped_trend": False,
                    "seasonal": "add",
                    "seasonal_periods": 7,
                },
                {
                    "trend": "add",
                    "damped_trend": True,
                    "seasonal": "add",
                    "seasonal_periods": 7,
                },
                {
                    "trend": None,
                    "damped_trend": False,
                    "seasonal": "add",
                    "seasonal_periods": 7,
                },
            ]
        )

    return candidates


def _build_arima_candidates() -> list[dict[str, object]]:
    return [
        {"order": (1, 0, 0)},
        {"order": (2, 0, 0)},
        {"order": (1, 0, 1)},
        {"order": (2, 0, 1)},
        {"order": (2, 0, 2)},
        {"order": (0, 1, 1)},
        {"order": (1, 1, 0)},
        {"order": (1, 1, 1)},
        {"order": (2, 1, 0)},
        {"order": (2, 1, 1)},
        {"order": (2, 1, 2)},
        {"order": (1, 1, 1), "seasonal_order": (1, 0, 0, 7)},
        {"order": (1, 1, 1), "seasonal_order": (0, 1, 1, 7)},
        {"order": (2, 1, 1), "seasonal_order": (1, 0, 0, 7)},
        {"order": (1, 0, 1), "seasonal_order": (1, 0, 1, 7), "trend": "c"},
    ]


def _select_best_candidate(
    values: np.ndarray,
    *,
    candidates: list[dict[str, object]],
    min_training_points: int,
    fit_predict,
) -> dict[str, object]:
    validation_horizon = _get_tuning_validation_horizon(
        len(values),
        min_training_points=min_training_points,
    )

    scored_candidates: list[tuple[float, float, dict[str, object]]] = []

    for candidate in candidates:
        try:
            if validation_horizon > 0:
                train_values = values[:-validation_horizon]
                validation_values = values[-validation_horizon:]
                _, predicted_values = fit_predict(
                    train_values,
                    candidate,
                    forecast_days=validation_horizon,
                )
                score = _error_metrics(validation_values, predicted_values)["mae"]
                if score is None:
                    continue
                flatness = _forecast_flatness_ratio(train_values, predicted_values)
            else:
                fitted_values, _ = fit_predict(
                    values,
                    candidate,
                    forecast_days=1,
                )
                score = _error_metrics(values, fitted_values)["mae"]
                if score is None:
                    continue
                flatness = _forecast_flatness_ratio(values, fitted_values)
        except Exception:
            continue

        scored_candidates.append((float(score), float(flatness), candidate))

    if not scored_candidates:
        return candidates[0]

    scored_candidates.sort(key=lambda item: item[0])
    best_score = scored_candidates[0][0]
    threshold = best_score * 1.18 + 1e-9
    near_best = [item for item in scored_candidates if item[0] <= threshold]
    near_best.sort(key=lambda item: (-item[1], item[0]))

    return near_best[0][2]


def _get_tuning_validation_horizon(
    total_points: int,
    *,
    min_training_points: int,
) -> int:
    max_allowed = total_points - min_training_points
    if max_allowed < 2:
        return 0
    return min(7, max(2, total_points // 5), max_allowed)


def _fit_holt_winters_candidate(
    values: np.ndarray,
    candidate: dict[str, object],
    *,
    forecast_days: int,
) -> tuple[np.ndarray, np.ndarray]:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=RuntimeWarning)
        warnings.simplefilter("ignore", category=ConvergenceWarning)
        model = ExponentialSmoothing(
            values,
            trend=candidate["trend"],
            damped_trend=bool(candidate["damped_trend"]) if candidate["trend"] else False,
            seasonal=candidate["seasonal"],
            seasonal_periods=candidate["seasonal_periods"],
            initialization_method="estimated",
        )
        fitted = model.fit(optimized=True, use_brute=False)

    return (
        np.asarray(fitted.fittedvalues, dtype=float),
        np.asarray(fitted.forecast(forecast_days), dtype=float),
    )


def _fit_arima_candidate(
    values: np.ndarray,
    candidate: dict[str, object],
    *,
    forecast_days: int,
) -> tuple[np.ndarray, np.ndarray]:
    from statsmodels.tsa.arima.model import ARIMA
    from statsmodels.tsa.statespace.sarimax import SARIMAX

    order = candidate["order"]
    trend = candidate.get("trend", "c" if order[1] == 0 else "n")

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=UserWarning)
        warnings.simplefilter("ignore", category=RuntimeWarning)
        warnings.simplefilter("ignore", category=ConvergenceWarning)
        if candidate.get("seasonal_order") is not None:
            fitted = SARIMAX(
                values,
                order=order,
                seasonal_order=candidate["seasonal_order"],
                trend=trend,
                enforce_stationarity=False,
                enforce_invertibility=False,
            ).fit(disp=False)
        else:
            fitted = ARIMA(values, order=order, trend=trend).fit()

    return (
        np.asarray(fitted.predict(start=0, end=len(values) - 1), dtype=float),
        np.asarray(fitted.forecast(steps=forecast_days), dtype=float),
    )


def _forecast_flatness_ratio(history_values, forecast_values) -> float:
    history_arr = np.asarray(history_values, dtype=float)
    forecast_arr = np.asarray(forecast_values, dtype=float)
    if len(history_arr) == 0 or len(forecast_arr) == 0:
        return 0.0

    recent_window = history_arr[-min(14, len(history_arr)) :]
    history_std = float(np.std(recent_window))
    if history_std <= 1e-9:
        return 0.0

    return float(np.std(forecast_arr) / history_std)


def _error_metrics(actual, predicted) -> dict[str, float | None]:
    actual_arr = np.asarray(actual, dtype=float)
    predicted_arr = np.asarray(predicted, dtype=float)
    length = min(len(actual_arr), len(predicted_arr))
    if length == 0:
        return {"mae": None, "rmse": None, "mape": None, "r2": None}

    actual_arr = actual_arr[:length]
    predicted_arr = predicted_arr[:length]
    mask = np.isfinite(actual_arr) & np.isfinite(predicted_arr)
    if not np.any(mask):
        return {"mae": None, "rmse": None, "mape": None, "r2": None}

    actual_arr = actual_arr[mask]
    predicted_arr = predicted_arr[mask]
    errors = actual_arr - predicted_arr
    mae = float(np.mean(np.abs(errors)))
    rmse = float(sqrt(np.mean(errors ** 2)))
    non_zero_mask = actual_arr != 0
    if np.any(non_zero_mask):
        mape = float(np.mean(np.abs(errors[non_zero_mask] / actual_arr[non_zero_mask])) * 100)
    else:
        mape = None

    ss_res = float(np.sum(errors ** 2))
    ss_tot = float(np.sum((actual_arr - np.mean(actual_arr)) ** 2))
    r2 = float(1 - ss_res / ss_tot) if ss_tot > 0 else 1.0

    return {
        "mae": round(mae, 6),
        "rmse": round(rmse, 6),
        "mape": round(mape, 6) if mape is not None else None,
        "r2": round(r2, 6),
    }


def _format_date(value) -> str:
    return value.strftime("%Y-%m-%d")


def _is_constant_series(values: np.ndarray) -> bool:
    return bool(len(values) and np.allclose(values, values[0]))
