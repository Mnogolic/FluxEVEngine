from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ForecastMethodInfo(BaseModel):
    id: str
    label: str
    description: str
    min_training_points: int
    optional_dependency: bool = False


class ForecastMetrics(BaseModel):
    mae: float | None = None
    rmse: float | None = None
    mape: float | None = None
    r2: float | None = None
    slope: float | None = None
    validation_mae: float | None = None
    validation_rmse: float | None = None
    validation_mape: float | None = None


class MarketForecastResponse(BaseModel):
    method: str
    method_label: str
    actual_dates: list[str]
    actual_values: list[float]
    forecast_dates: list[str]
    forecast_values: list[float]
    training_date_from: str | None
    training_date_to: str | None
    first_actual_date: str | None
    last_actual_date: str | None
    actual_data_point_count: int
    training_data_point_count: int
    forecast_days: int
    validation_days: int
    is_fixed_price: bool
    slope: float | None = None
    r2: float | None = None
    metrics: ForecastMetrics = Field(default_factory=ForecastMetrics)
    warning: str | None = None


class MarketForecastCompareItem(BaseModel):
    method: str
    method_label: str
    status: Literal["ok", "error"]
    forecast_dates: list[str] = Field(default_factory=list)
    forecast_values: list[float] = Field(default_factory=list)
    metrics: ForecastMetrics = Field(default_factory=ForecastMetrics)
    warning: str | None = None
    error: str | None = None


class MarketForecastComparisonResponse(BaseModel):
    actual_dates: list[str]
    actual_values: list[float]
    training_date_from: str | None
    training_date_to: str | None
    first_actual_date: str | None
    last_actual_date: str | None
    actual_data_point_count: int
    training_data_point_count: int
    forecast_days: int
    validation_days: int
    is_fixed_price: bool
    methods: list[MarketForecastCompareItem]
    best_method_by_validation_mae: str | None = None
