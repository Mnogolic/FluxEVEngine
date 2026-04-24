from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path

import matplotlib
import numpy as np
import pandas as pd
from sqlalchemy import func, select

from app.db.models import MarketHistory, TrackedItem
from app.db.session import SessionLocal
import scripts.generate_assignment7_track_p as a7

matplotlib.use("Agg")

import matplotlib.pyplot as plt


REPORT_DIR = Path("reports/nir_fluxevengine")

AGENT_START_CAPITAL = 10_000.0
AGENT_FEE_RATE = 0.001


@dataclass(frozen=True)
class AgentConfig:
    name: str


AGENTS = [
    AgentConfig(name="Conservative"),
    AgentConfig(name="Balanced"),
    AgentConfig(name="Aggressive"),
]

SCENARIO_LABELS = {
    "baseline": "Baseline",
    "liquidity_shock": "Liquidity Shock",
    "pump_and_dump": "Pump and Dump",
    "high_volatility": "High Volatility",
}


def ensure_report_dir() -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    a7.REPORT_DIR = REPORT_DIR


def build_technology_stack_table() -> pd.DataFrame:
    rows = [
        {
            "Layer": "Серверная логика",
            "Technologies": "Python 3.12, FastAPI, Uvicorn",
            "Purpose": "Реализация REST API и оркестрация сервисов",
        },
        {
            "Layer": "Хранение данных",
            "Technologies": "PostgreSQL 17, SQLAlchemy async, asyncpg, Alembic",
            "Purpose": "Хранение истории рынка, ORM и миграции схемы",
        },
        {
            "Layer": "Сбор данных",
            "Technologies": "aiohttp, ESI API, APScheduler",
            "Purpose": "Асинхронная загрузка и ежедневное обновление рыночной истории",
        },
        {
            "Layer": "Аналитика и прогноз",
            "Technologies": "NumPy, statsmodels",
            "Purpose": "Расчёт метрик, регрессии и временных моделей",
        },
        {
            "Layer": "Визуализация",
            "Technologies": "Next.js, React, Plotly.js",
            "Purpose": "Dashboard, графики и интерактивное сравнение моделей",
        },
        {
            "Layer": "Автоматизация",
            "Technologies": "GitHub Actions, Bun",
            "Purpose": "CI/CD, сборка frontend и выпуск архивов релиза",
        },
    ]
    return pd.DataFrame(rows)


async def collect_dataset_overview(window_rows: int) -> pd.DataFrame:
    async with SessionLocal() as db:
        tracked_items = int(
            (
                await db.execute(select(func.count()).select_from(TrackedItem))
            ).scalar_one()
        )
        market_history_rows = int(
            (
                await db.execute(select(func.count()).select_from(MarketHistory))
            ).scalar_one()
        )
        first_date = (
            await db.execute(select(func.min(MarketHistory.date)))
        ).scalar_one()
        last_date = (
            await db.execute(select(func.max(MarketHistory.date)))
        ).scalar_one()
        distinct_regions = int(
            (
                await db.execute(
                    select(func.count(func.distinct(MarketHistory.region_id)))
                )
            ).scalar_one()
        )
        distinct_types = int(
            (
                await db.execute(
                    select(func.count(func.distinct(MarketHistory.type_id)))
                )
            ).scalar_one()
        )

    rows = [
        {"Metric": "Tracked items", "Value": tracked_items},
        {"Metric": "Market history rows", "Value": market_history_rows},
        {"Metric": "Distinct item types", "Value": distinct_types},
        {"Metric": "Distinct regions", "Value": distinct_regions},
        {"Metric": "Date from", "Value": first_date.date().isoformat() if first_date else None},
        {"Metric": "Date to", "Value": last_date.date().isoformat() if last_date else None},
        {"Metric": "Stable experiment window", "Value": f"{a7.WINDOW_START.isoformat()}..{a7.WINDOW_END.isoformat()}"},
        {"Metric": "Rows in stable window", "Value": window_rows},
        {"Metric": "Forecast horizon (days)", "Value": a7.FORECAST_DAYS},
        {"Metric": "Validation window (days)", "Value": a7.VALIDATION_DAYS},
    ]
    return pd.DataFrame(rows)


def _base_returns_from_experiment(data: a7.ExperimentData) -> tuple[list[str], np.ndarray]:
    item_ids = a7.SCENARIO_ITEM_IDS
    aligned = []
    dates: list[str] | None = None
    for item_id in item_ids:
        rows = data.scenario_series[item_id]
        item_dates = [row.date.strftime("%Y-%m-%d") for row in rows]
        item_values = np.array([float(row.average) for row in rows], dtype=float)
        normalized = item_values / item_values[0]
        aligned.append(normalized)
        dates = item_dates if dates is None else dates

    index_levels = np.mean(np.vstack(aligned), axis=0)
    returns = np.diff(index_levels) / index_levels[:-1]
    return dates or [], returns


def _scenario_returns(base_returns: np.ndarray, scenario_id: str) -> np.ndarray:
    returns = base_returns.copy()
    n = len(returns)
    if n == 0:
        return returns

    if scenario_id == "baseline":
        return np.clip(returns, -0.25, 0.25)

    if scenario_id == "liquidity_shock":
        pivot = n // 2
        returns[pivot - 1] -= 0.075
        returns[pivot] -= 0.045
        if pivot + 1 < n:
            returns[pivot + 1] += 0.018
        if pivot + 2 < n:
            returns[pivot + 2] += 0.012
        returns[pivot + 3 :] -= 0.0015
        return np.clip(returns, -0.25, 0.25)

    if scenario_id == "pump_and_dump":
        start = max(4, n // 3)
        for offset in range(4):
            idx = start + offset
            if idx < n:
                returns[idx] += 0.024 - offset * 0.002
        crash_idx = min(start + 4, n - 2)
        returns[crash_idx] -= 0.24
        if crash_idx + 1 < n:
            returns[crash_idx + 1] += 0.04
        if crash_idx + 2 < n:
            returns[crash_idx + 2] -= 0.05
        return np.clip(returns, -0.25, 0.25)

    if scenario_id == "high_volatility":
        mean_return = float(np.mean(returns))
        scaled = mean_return + (returns - mean_return) * 1.8
        return np.clip(scaled, -0.25, 0.25)

    raise ValueError(f"Unknown scenario id: {scenario_id}")


def _returns_to_levels(returns: np.ndarray, *, start: float = 100.0) -> np.ndarray:
    values = [start]
    for daily_return in returns:
        values.append(values[-1] * (1.0 + float(daily_return)))
    return np.array(values, dtype=float)


def _simulate_agent(returns: np.ndarray, config: AgentConfig) -> dict[str, object]:
    capital = AGENT_START_CAPITAL
    equity_curve = [capital]
    position = 0.0
    trades = 0
    levels = _returns_to_levels(returns)

    for idx, daily_return in enumerate(returns, start=1):
        short_ma = float(np.mean(levels[max(0, idx - 3):idx]))
        long_ma = float(np.mean(levels[max(0, idx - 7):idx]))
        momentum = float(np.mean(returns[max(0, idx - 3):idx])) if idx > 0 else 0.0
        recent_window = levels[max(0, idx - 5):idx]
        recent_drop = 0.0
        if len(recent_window):
            recent_peak = float(np.max(recent_window))
            if recent_peak > 0:
                recent_drop = (recent_peak - float(levels[idx])) / recent_peak

        if config.name == "Conservative":
            if levels[idx] < long_ma * 0.997 and momentum > -0.02:
                target_position = 0.35
            elif short_ma > long_ma and momentum > -0.001:
                target_position = 0.25
            elif levels[idx] > long_ma * 1.012 or daily_return < -0.05:
                target_position = 0.0
            else:
                target_position = position * 0.82
        elif config.name == "Balanced":
            if short_ma > long_ma and momentum > -0.001:
                target_position = 0.65
            elif levels[idx] < long_ma * 0.985:
                target_position = 0.30
            elif daily_return < -0.06:
                target_position = 0.0
            else:
                target_position = position * 0.9
        elif config.name == "Aggressive":
            if short_ma > long_ma and momentum > 0.0:
                target_position = 1.0
            elif recent_drop > 0.10:
                target_position = 0.55
            elif daily_return < -0.12:
                target_position = 0.25
            else:
                target_position = max(position * 0.97, 0.15 if momentum > -0.002 else 0.0)
        else:
            raise ValueError(f"Unknown agent: {config.name}")

        if abs(target_position - position) > 0.05:
            capital *= 1.0 - AGENT_FEE_RATE
            trades += 1
        position = target_position
        capital *= 1.0 + position * float(daily_return)
        equity_curve.append(capital)

    equity = np.array(equity_curve, dtype=float)
    rolling_peak = np.maximum.accumulate(equity)
    drawdowns = (rolling_peak - equity) / rolling_peak
    max_drawdown_pct = float(np.max(drawdowns) * 100.0)
    return_pct = float((equity[-1] / AGENT_START_CAPITAL - 1.0) * 100.0)

    return {
        "final_capital": round(float(equity[-1]), 2),
        "return_pct": round(return_pct, 2),
        "max_drawdown_pct": round(max_drawdown_pct, 2),
        "trades": trades,
        "equity_curve": equity,
    }


def build_agent_tables(data: a7.ExperimentData) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, np.ndarray]]:
    _, base_returns = _base_returns_from_experiment(data)
    scenario_curves: dict[str, np.ndarray] = {}
    rows: list[dict[str, object]] = []

    for scenario_id, scenario_label in SCENARIO_LABELS.items():
        scenario_returns = _scenario_returns(base_returns, scenario_id)
        market_levels = _returns_to_levels(scenario_returns)
        scenario_curves[scenario_label] = market_levels
        for config in AGENTS:
            result = _simulate_agent(scenario_returns, config)
            rows.append(
                {
                    "Scenario": scenario_label,
                    "Agent": config.name,
                    "Final_capital": result["final_capital"],
                    "Return_pct": result["return_pct"],
                    "Max_drawdown_pct": result["max_drawdown_pct"],
                    "Trades": result["trades"],
                }
            )

    table_agents = pd.DataFrame(rows)
    winner_rows = []
    for scenario_label in SCENARIO_LABELS.values():
        current = table_agents[table_agents["Scenario"] == scenario_label].copy()
        best_row = current.sort_values(
            by=["Return_pct", "Max_drawdown_pct"],
            ascending=[False, True],
        ).iloc[0]
        winner_rows.append(
            {
                "Scenario": scenario_label,
                "Best_agent": best_row["Agent"],
                "Return_pct": best_row["Return_pct"],
                "Max_drawdown_pct": best_row["Max_drawdown_pct"],
            }
        )

    return table_agents, pd.DataFrame(winner_rows), scenario_curves


def plot_agent_returns(table_agents: pd.DataFrame) -> None:
    fig, ax = plt.subplots(figsize=(11, 6))
    scenarios = list(SCENARIO_LABELS.values())
    width = 0.22
    x = np.arange(len(scenarios))
    colors = {
        "Conservative": "#4063D8",
        "Balanced": "#389826",
        "Aggressive": "#CB3C33",
    }

    for index, agent_name in enumerate([agent.name for agent in AGENTS]):
        values = [
            float(
                table_agents[
                    (table_agents["Scenario"] == scenario) & (table_agents["Agent"] == agent_name)
                ]["Return_pct"].iloc[0]
            )
            for scenario in scenarios
        ]
        ax.bar(
            x + (index - 1) * width,
            values,
            width=width,
            label=agent_name,
            color=colors[agent_name],
        )

    ax.axhline(0, color="#444444", linewidth=1)
    ax.set_xticks(x)
    ax.set_xticklabels(scenarios)
    ax.set_ylabel("Доходность, %")
    ax.set_xlabel("Сценарий рынка")
    ax.set_title("Рисунок 6. Доходность агентных стратегий по сценариям")
    ax.legend(title="Агент")
    ax.grid(axis="y", alpha=0.25)
    fig.tight_layout()
    fig.savefig(REPORT_DIR / "figure6_agent_returns.png", dpi=200)
    plt.close(fig)

def plot_agent_equity_curves_from_results(agent_curves: dict[str, dict[str, np.ndarray]], scenario_curves: dict[str, np.ndarray]) -> None:
    scenario = "Pump and Dump"
    fig, ax = plt.subplots(figsize=(11, 6))
    x_market = np.arange(len(scenario_curves[scenario]))
    ax.plot(
        x_market,
        scenario_curves[scenario],
        linewidth=2.5,
        color="#111111",
        label="Синтетический рыночный индекс",
    )

    colors = {
        "Conservative": "#4063D8",
        "Balanced": "#389826",
        "Aggressive": "#CB3C33",
    }
    for agent_name in [agent.name for agent in AGENTS]:
        curve = agent_curves[scenario][agent_name]
        x = np.arange(len(curve))
        ax.plot(x, curve, linewidth=2, color=colors[agent_name], label=agent_name)

    ax.set_xlabel("Шаг моделирования")
    ax.set_ylabel("Капитал / индекс")
    ax.set_title("Рисунок 7. Динамика капитала агентов в сценарии Pump and Dump")
    ax.legend()
    ax.grid(alpha=0.25)
    fig.tight_layout()
    fig.savefig(REPORT_DIR / "figure7_agent_equity_curves.png", dpi=200)
    plt.close(fig)


def build_agent_curves(data: a7.ExperimentData) -> tuple[dict[str, dict[str, np.ndarray]], dict[str, np.ndarray]]:
    _, base_returns = _base_returns_from_experiment(data)
    scenario_curves: dict[str, np.ndarray] = {}
    agent_curves: dict[str, dict[str, np.ndarray]] = {}
    for scenario_id, scenario_label in SCENARIO_LABELS.items():
        scenario_returns = _scenario_returns(base_returns, scenario_id)
        scenario_curves[scenario_label] = _returns_to_levels(scenario_returns)
        agent_curves[scenario_label] = {}
        for config in AGENTS:
            result = _simulate_agent(scenario_returns, config)
            agent_curves[scenario_label][config.name] = result["equity_curve"]
    return agent_curves, scenario_curves


async def main() -> None:
    ensure_report_dir()
    data = await a7.collect_experiment_data()
    technology_stack = build_technology_stack_table()
    dataset_overview = await collect_dataset_overview(data.window_rows)
    table_agents, table_agent_winners, scenario_curves = build_agent_tables(data)
    agent_curves, _ = build_agent_curves(data)

    a7.save_table(technology_stack, "table1_technology_stack.csv")
    a7.save_table(dataset_overview, "table0_dataset_overview.csv")
    a7.save_table(data.table_plan, "table1_experiment_plan.csv")
    a7.save_table(data.table_turnover, "table2_region_turnover.csv")
    a7.save_table(data.table_metrics, "table3_model_metrics.csv")
    a7.save_table(data.table_method_wins, "table4_method_wins.csv")
    a7.save_table(data.top_items, "table5_top_items_jita.csv")
    a7.save_table(table_agents, "table6_agent_scenarios.csv")
    a7.save_table(table_agent_winners, "table7_agent_winners.csv")

    combined_sheets = [
        ("Technology stack", technology_stack),
        ("Dataset overview", dataset_overview),
        ("Experiment plan", data.table_plan),
        ("Region turnover", data.table_turnover),
        ("Model metrics", data.table_metrics),
        ("Method wins", data.table_method_wins),
        ("Top items", data.top_items),
        ("Agent scenarios", table_agents),
        ("Agent winners", table_agent_winners),
    ]
    try:
        a7.save_excel_workbook("nir_fluxevengine_tables.xlsx", combined_sheets)
    except PermissionError:
        a7.save_excel_workbook("nir_fluxevengine_tables_updated.xlsx", combined_sheets)
    a7.save_excel_workbook("table1_technology_stack.xlsx", [("Technology stack", technology_stack)])
    a7.save_excel_workbook("table0_dataset_overview.xlsx", [("Dataset overview", dataset_overview)])
    a7.save_excel_workbook("table6_agent_scenarios.xlsx", [("Agent scenarios", table_agents)])
    a7.save_excel_workbook("table7_agent_winners.xlsx", [("Agent winners", table_agent_winners)])

    a7.plot_region_turnover(data.table_turnover)
    a7.plot_top_items(data.top_items)
    a7.plot_forecast_comparison(
        data.item_names[a7.FORECAST_FIGURE_ITEM_ID],
        data.scenario_series[a7.FORECAST_FIGURE_ITEM_ID],
    )
    a7.plot_validation_holdout(
        data.item_names[a7.FORECAST_FIGURE_ITEM_ID],
        data.scenario_series[a7.FORECAST_FIGURE_ITEM_ID],
    )
    a7.plot_method_wins(data.table_method_wins)
    plot_agent_returns(table_agents)
    plot_agent_equity_curves_from_results(agent_curves, scenario_curves)

    print(f"NIR assets written to: {REPORT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
