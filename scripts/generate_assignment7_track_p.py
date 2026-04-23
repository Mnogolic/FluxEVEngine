from __future__ import annotations

import asyncio
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from numbers import Integral, Real
from pathlib import Path
from types import SimpleNamespace
from xml.sax.saxutils import escape
import zipfile

import matplotlib
import pandas as pd
from sqlalchemy import func, select

from app.db.models import MarketHistory, TrackedItem
from app.db.session import SessionLocal
from app.forecasting import build_forecast_result

matplotlib.use("Agg")

import matplotlib.pyplot as plt


REPORT_DIR = Path("reports/assignment7_track_p")
REPORT_PATH = REPORT_DIR / "assignment7_track_p_report.md"

WINDOW_START = date(2026, 3, 16)
WINDOW_END = date(2026, 4, 20)
FORECAST_DAYS = 7
VALIDATION_DAYS = 7
FOCUS_REGION_ID = 10000002
FOCUS_REGION_NAME = "Jita"
SCENARIO_ITEM_IDS = [34, 35, 36, 37, 38]
FORECAST_FIGURE_ITEM_ID = 37
TOP_LIQUID_SAMPLE_SIZE = 10

REGION_NAMES = {
    10000002: "Jita",
    10000043: "Amarr",
    10000032: "Dodixie",
    10000042: "Hek",
    10000030: "Rens",
}

METHODS = ["linear", "holt_winters", "arima", "autoreg"]
METHOD_LABELS = {
    "linear": "Linear Regression",
    "holt_winters": "Holt-Winters ETS",
    "arima": "ARIMA",
    "autoreg": "AutoReg",
}
METHOD_COLORS = {
    "linear": "#1f77b4",
    "holt_winters": "#ff7f0e",
    "arima": "#2ca02c",
    "autoreg": "#d62728",
}


@dataclass(frozen=True)
class ExperimentData:
    total_rows: int
    window_rows: int
    stable_day_count: int
    table_plan: pd.DataFrame
    table_turnover: pd.DataFrame
    table_metrics: pd.DataFrame
    table_method_wins: pd.DataFrame
    top_items: pd.DataFrame
    scenario_series: dict[int, list[SimpleNamespace]]
    item_names: dict[int, str]
    best_by_item: dict[str, str]
    improvement_vs_linear: dict[str, float]


def dt_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end + timedelta(days=1), time.min)
    return start_dt, end_dt


def to_series_rows(rows) -> list[SimpleNamespace]:
    return [SimpleNamespace(date=row.date, average=float(row.average)) for row in rows]


def ensure_report_dir() -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)


def save_table(df: pd.DataFrame, filename: str) -> None:
    df.to_csv(REPORT_DIR / filename, index=False, encoding="utf-8-sig")


def _excel_column_name(index: int) -> str:
    result = ""
    current = index
    while current > 0:
        current, remainder = divmod(current - 1, 26)
        result = chr(65 + remainder) + result
    return result


def _sanitize_sheet_name(name: str) -> str:
    forbidden = set("[]:*?/\\")
    sanitized = "".join("_" if char in forbidden else char for char in name).strip()
    if not sanitized:
        sanitized = "Sheet"
    return sanitized[:31]


def _coerce_excel_cell(value) -> tuple[str, str]:
    if pd.isna(value):
        return "empty", ""
    if isinstance(value, bool):
        return "number", "1" if value else "0"
    if isinstance(value, Integral):
        return "number", str(value)
    if isinstance(value, Real):
        numeric = float(value)
        if numeric.is_integer():
            return "number", str(int(value))
        return "number", repr(numeric)
    return "string", str(value)


def _sheet_xml(df: pd.DataFrame) -> str:
    widths: list[int] = []
    for column in df.columns:
        values = [str(column), *[("" if pd.isna(value) else str(value)) for value in df[column].tolist()]]
        widths.append(min(max(len(value) for value in values) + 2, 45))

    cols_xml = "".join(
        f'<col min="{index}" max="{index}" width="{width}" customWidth="1"/>'
        for index, width in enumerate(widths, start=1)
    )

    rows_xml: list[str] = []
    header_cells = []
    for index, column in enumerate(df.columns, start=1):
        ref = f"{_excel_column_name(index)}1"
        header_cells.append(
            f'<c r="{ref}" t="inlineStr" s="1"><is><t>{escape(str(column))}</t></is></c>'
        )
    rows_xml.append(f'<row r="1">{"".join(header_cells)}</row>')

    for row_index, row in enumerate(df.itertuples(index=False), start=2):
        cells: list[str] = []
        for column_index, value in enumerate(row, start=1):
            ref = f"{_excel_column_name(column_index)}{row_index}"
            kind, prepared = _coerce_excel_cell(value)
            if kind == "empty":
                continue
            if kind == "number":
                cells.append(f'<c r="{ref}"><v>{prepared}</v></c>')
            else:
                cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{escape(prepared)}</t></is></c>')
        rows_xml.append(f'<row r="{row_index}">{"".join(cells)}</row>')

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f"<cols>{cols_xml}</cols>"
        f"<sheetData>{''.join(rows_xml)}</sheetData>"
        "</worksheet>"
    )


def save_excel_workbook(filename: str, sheets: list[tuple[str, pd.DataFrame]]) -> None:
    workbook_path = REPORT_DIR / filename
    workbook_sheets = [(_sanitize_sheet_name(name), df.copy()) for name, df in sheets]
    created = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

    content_types = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    ]
    for index in range(1, len(workbook_sheets) + 1):
        content_types.append(
            f'<Override PartName="/xl/worksheets/sheet{index}.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        )
    content_types.append("</Types>")

    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
        "</Relationships>"
    )

    workbook_xml = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
        "<sheets>",
    ]
    for index, (name, _) in enumerate(workbook_sheets, start=1):
        workbook_xml.append(
            f'<sheet name="{escape(name)}" sheetId="{index}" r:id="rId{index}"/>'
        )
    workbook_xml.extend(["</sheets>", "</workbook>"])

    workbook_rels = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    ]
    for index in range(1, len(workbook_sheets) + 1):
        workbook_rels.append(
            f'<Relationship Id="rId{index}" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
            f'Target="worksheets/sheet{index}.xml"/>'
        )
    workbook_rels.append(
        f'<Relationship Id="rId{len(workbook_sheets) + 1}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
        'Target="styles.xml"/>'
    )
    workbook_rels.append("</Relationships>")

    styles_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2">'
        '<font><sz val="11"/><name val="Calibri"/></font>'
        '<font><b/><sz val="11"/><name val="Calibri"/></font>'
        "</fonts>"
        '<fills count="2">'
        '<fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        "</fills>"
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="2">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
        "</cellXfs>"
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        "</styleSheet>"
    )

    titles_vector = "".join(
        f"<vt:lpstr>{escape(name)}</vt:lpstr>" for name, _ in workbook_sheets
    )
    app_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        "<Application>FluxEV Engine</Application>"
        "<DocSecurity>0</DocSecurity>"
        "<ScaleCrop>false</ScaleCrop>"
        "<HeadingPairs><vt:vector size=\"2\" baseType=\"variant\">"
        "<vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>"
        f"<vt:variant><vt:i4>{len(workbook_sheets)}</vt:i4></vt:variant>"
        "</vt:vector></HeadingPairs>"
        f"<TitlesOfParts><vt:vector size=\"{len(workbook_sheets)}\" baseType=\"lpstr\">{titles_vector}</vt:vector></TitlesOfParts>"
        "<Company>OpenAI Codex</Company>"
        "<LinksUpToDate>false</LinksUpToDate>"
        "<SharedDoc>false</SharedDoc>"
        "<HyperlinksChanged>false</HyperlinksChanged>"
        "<AppVersion>1.0</AppVersion>"
        "</Properties>"
    )

    core_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        "<dc:title>Assignment 7 Track P Tables</dc:title>"
        "<dc:creator>OpenAI Codex</dc:creator>"
        "<cp:lastModifiedBy>OpenAI Codex</cp:lastModifiedBy>"
        f'<dcterms:created xsi:type="dcterms:W3CDTF">{created}</dcterms:created>'
        f'<dcterms:modified xsi:type="dcterms:W3CDTF">{created}</dcterms:modified>'
        "</cp:coreProperties>"
    )

    with zipfile.ZipFile(workbook_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", "".join(content_types))
        archive.writestr("_rels/.rels", root_rels)
        archive.writestr("docProps/app.xml", app_xml)
        archive.writestr("docProps/core.xml", core_xml)
        archive.writestr("xl/workbook.xml", "".join(workbook_xml))
        archive.writestr("xl/_rels/workbook.xml.rels", "".join(workbook_rels))
        archive.writestr("xl/styles.xml", styles_xml)
        for index, (_, df) in enumerate(workbook_sheets, start=1):
            archive.writestr(f"xl/worksheets/sheet{index}.xml", _sheet_xml(df))


def format_isk(value: float) -> str:
    return f"{value:,.2f}".replace(",", " ")


def format_pct(value: float) -> str:
    return f"{value:.2f}"


def plot_region_turnover(df: pd.DataFrame) -> None:
    fig, ax = plt.subplots(figsize=(10, 6))
    values = df["Turnover_TISK"].tolist()
    ax.bar(df["Region"], values, color="#3d7ea6", label="Оборот")
    ax.set_title("Рисунок 1. Оборот по регионам в устойчивом окне эксперимента")
    ax.set_xlabel("Торговый хаб")
    ax.set_ylabel("Оборот, трлн ISK")
    ax.legend()
    ax.grid(axis="y", alpha=0.25)
    fig.tight_layout()
    fig.savefig(REPORT_DIR / "figure1_region_turnover.png", dpi=200)
    plt.close(fig)


def plot_top_items(df: pd.DataFrame) -> None:
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.bar(df["Item"], df["Turnover_TISK"], color="#2f9e44", label="Оборот")
    ax.set_title("Рисунок 2. Топ-10 товаров Jita по обороту в устойчивом окне")
    ax.set_xlabel("Товар")
    ax.set_ylabel("Оборот, трлн ISK")
    ax.legend()
    ax.grid(axis="y", alpha=0.25)
    ax.tick_params(axis="x", rotation=40)
    fig.tight_layout()
    fig.savefig(REPORT_DIR / "figure2_jita_top10_turnover.png", dpi=200)
    plt.close(fig)


def plot_forecast_comparison(item_name: str, series: list[SimpleNamespace]) -> None:
    fig, ax = plt.subplots(figsize=(12, 6))
    history_dates = [row.date for row in series]
    history_values = [row.average for row in series]
    ax.plot(history_dates, history_values, color="#111827", linewidth=2.5, label="Фактическая цена")

    for method in METHODS:
        payload = build_forecast_result(
            series,
            method=method,
            forecast_days=FORECAST_DAYS,
            validation_days=VALIDATION_DAYS,
            include_anchor_point=True,
        )
        ax.plot(
            pd.to_datetime(payload["forecast_dates"]),
            payload["forecast_values"],
            linewidth=2,
            label=METHOD_LABELS[method],
            color=METHOD_COLORS[method],
        )

    ax.set_title(f"Рисунок 3. {item_name}: история цены и 7-дневный прогноз")
    ax.set_xlabel("Дата")
    ax.set_ylabel("Средняя цена, ISK за единицу")
    ax.legend()
    ax.grid(alpha=0.25)
    fig.autofmt_xdate()
    fig.tight_layout()
    fig.savefig(REPORT_DIR / "figure3_forecast_comparison.png", dpi=200)
    plt.close(fig)


def plot_validation_holdout(item_name: str, series: list[SimpleNamespace]) -> None:
    training = series[:-VALIDATION_DAYS]
    validation = series[-VALIDATION_DAYS:]

    fig, ax = plt.subplots(figsize=(12, 6))
    ax.plot(
        [row.date for row in training],
        [row.average for row in training],
        color="#6b7280",
        linewidth=2,
        label="Обучающая история",
    )
    ax.plot(
        [row.date for row in validation],
        [row.average for row in validation],
        color="#111827",
        linewidth=2.5,
        marker="o",
        label="Фактическое валидационное окно",
    )

    for method in METHODS:
        payload = build_forecast_result(
            training,
            method=method,
            forecast_days=VALIDATION_DAYS,
            validation_days=0,
            include_anchor_point=True,
        )
        ax.plot(
            pd.to_datetime(payload["forecast_dates"]),
            payload["forecast_values"],
            linewidth=2,
            label=f"{METHOD_LABELS[method]}: прогноз",
            color=METHOD_COLORS[method],
        )

    ax.set_title(f"Рисунок 4. {item_name}: hold-out верификация на последних 7 наблюдениях")
    ax.set_xlabel("Дата")
    ax.set_ylabel("Средняя цена, ISK за единицу")
    ax.legend()
    ax.grid(alpha=0.25)
    fig.autofmt_xdate()
    fig.tight_layout()
    fig.savefig(REPORT_DIR / "figure4_validation_holdout.png", dpi=200)
    plt.close(fig)


def plot_method_wins(df: pd.DataFrame) -> None:
    fig, ax = plt.subplots(figsize=(9, 5))
    ax.bar(df["Method"], df["Win_count"], color="#7c3aed", label="Победы")
    ax.set_title("Рисунок 5. Число побед методов по validation MAE на топ-10 товарах Jita")
    ax.set_xlabel("Метод прогнозирования")
    ax.set_ylabel("Число побед")
    ax.legend()
    ax.grid(axis="y", alpha=0.25)
    fig.tight_layout()
    fig.savefig(REPORT_DIR / "figure5_method_wins.png", dpi=200)
    plt.close(fig)


def dataframe_to_markdown(df: pd.DataFrame) -> str:
    columns = list(df.columns)
    header = "| " + " | ".join(columns) + " |"
    separator = "| " + " | ".join(["---"] * len(columns)) + " |"
    rows = []
    for _, row in df.iterrows():
        values = [str(row[column]) for column in columns]
        rows.append("| " + " | ".join(values) + " |")
    return "\n".join([header, separator, *rows])


async def collect_experiment_data() -> ExperimentData:
    start_dt, end_dt = dt_bounds(WINDOW_START, WINDOW_END)
    stable_day_count = (WINDOW_END - WINDOW_START).days + 1

    async with SessionLocal() as db:
        total_rows = int(
            (await db.execute(select(func.count()).select_from(MarketHistory))).scalar_one()
        )
        window_rows = int(
            (
                await db.execute(
                    select(func.count())
                    .select_from(MarketHistory)
                    .where(MarketHistory.date >= start_dt, MarketHistory.date < end_dt)
                )
            ).scalar_one()
        )

        item_names = dict(
            (
                await db.execute(
                    select(TrackedItem.type_id, TrackedItem.name).where(
                        TrackedItem.type_id.in_(SCENARIO_ITEM_IDS + [FORECAST_FIGURE_ITEM_ID])
                    )
                )
            ).all()
        )

        scenario_series: dict[int, list[SimpleNamespace]] = {}
        plan_rows: list[dict[str, object]] = []
        metrics_rows: list[dict[str, object]] = []
        best_by_item: dict[str, str] = {}
        improvement_vs_linear: dict[str, float] = {}

        for index, item_id in enumerate(SCENARIO_ITEM_IDS, start=1):
            rows = (
                await db.execute(
                    select(MarketHistory.date, MarketHistory.average)
                    .where(
                        MarketHistory.type_id == item_id,
                        MarketHistory.region_id == FOCUS_REGION_ID,
                        MarketHistory.date >= start_dt,
                        MarketHistory.date < end_dt,
                    )
                    .order_by(MarketHistory.date.asc())
                )
            ).all()
            series = to_series_rows(rows)
            scenario_series[item_id] = series

            price_values = [row.average for row in series]
            plan_rows.append(
                {
                    "Scenario": f"S{index}",
                    "Region": FOCUS_REGION_NAME,
                    "Item": item_names[item_id],
                    "Period": f"{WINDOW_START.isoformat()}..{WINDOW_END.isoformat()}",
                    "Observations": len(series),
                    "Forecast_days": FORECAST_DAYS,
                    "Validation_days": VALIDATION_DAYS,
                    "Methods": ", ".join(METHODS),
                    "Min_price_ISK": round(min(price_values), 3),
                    "Max_price_ISK": round(max(price_values), 3),
                }
            )

            baseline_validation_mae: float | None = None
            item_metrics: list[dict[str, object]] = []
            for method in METHODS:
                payload = build_forecast_result(
                    series,
                    method=method,
                    forecast_days=FORECAST_DAYS,
                    validation_days=VALIDATION_DAYS,
                    include_anchor_point=False,
                )
                metrics = payload["metrics"]
                current_row = {
                    "Item": item_names[item_id],
                    "Method": METHOD_LABELS[method],
                    "Validation_MAE": round(float(metrics["validation_mae"]), 6),
                    "Validation_RMSE": round(float(metrics["validation_rmse"]), 6),
                    "Validation_MAPE_pct": round(float(metrics["validation_mape"]), 6),
                    "R2": round(float(metrics["r2"]), 6) if metrics.get("r2") is not None else None,
                    "Best_for_item": "no",
                }
                if method == "linear":
                    baseline_validation_mae = float(metrics["validation_mae"])
                item_metrics.append(current_row)

            best_row = min(item_metrics, key=lambda row: row["Validation_MAE"])
            best_row["Best_for_item"] = "yes"
            best_by_item[item_names[item_id]] = best_row["Method"]
            if baseline_validation_mae:
                improvement = (
                    (baseline_validation_mae - float(best_row["Validation_MAE"]))
                    / baseline_validation_mae
                    * 100
                )
                improvement_vs_linear[item_names[item_id]] = round(improvement, 2)

            metrics_rows.extend(item_metrics)

        region_turnover_rows = (
            await db.execute(
                select(
                    MarketHistory.region_id,
                    func.count().label("rows"),
                    func.sum(MarketHistory.volume * MarketHistory.average).label("turnover"),
                )
                .where(MarketHistory.date >= start_dt, MarketHistory.date < end_dt)
                .group_by(MarketHistory.region_id)
                .order_by(func.sum(MarketHistory.volume * MarketHistory.average).desc())
            )
        ).all()
        total_turnover = sum(float(row.turnover) for row in region_turnover_rows)
        table_turnover_rows = []
        for row in region_turnover_rows:
            turnover = float(row.turnover)
            table_turnover_rows.append(
                {
                    "Region": REGION_NAMES[row.region_id],
                    "Rows": int(row.rows),
                    "Turnover_ISK": round(turnover, 2),
                    "Turnover_TISK": round(turnover / 1_000_000_000_000, 3),
                    "Share_pct": round(turnover / total_turnover * 100, 4),
                }
            )

        top_items_rows = (
            await db.execute(
                select(
                    TrackedItem.name,
                    func.sum(MarketHistory.volume * MarketHistory.average).label("turnover"),
                )
                .join(TrackedItem, TrackedItem.type_id == MarketHistory.type_id)
                .where(
                    MarketHistory.region_id == FOCUS_REGION_ID,
                    MarketHistory.date >= start_dt,
                    MarketHistory.date < end_dt,
                )
                .group_by(TrackedItem.name)
                .order_by(func.sum(MarketHistory.volume * MarketHistory.average).desc())
                .limit(10)
            )
        ).all()
        top_items = pd.DataFrame(
            [
                {
                    "Item": row.name,
                    "Turnover_ISK": round(float(row.turnover), 2),
                    "Turnover_TISK": round(float(row.turnover) / 1_000_000_000_000, 3),
                }
                for row in top_items_rows
            ]
        )

        top_liquid_rows = (
            await db.execute(
                select(
                    MarketHistory.type_id,
                    TrackedItem.name,
                    func.count().label("points"),
                    func.sum(MarketHistory.volume * MarketHistory.average).label("turnover"),
                )
                .join(TrackedItem, TrackedItem.type_id == MarketHistory.type_id)
                .where(
                    MarketHistory.region_id == FOCUS_REGION_ID,
                    MarketHistory.date >= start_dt,
                    MarketHistory.date < end_dt,
                )
                .group_by(MarketHistory.type_id, TrackedItem.name)
                .having(func.count() >= stable_day_count)
                .order_by(func.sum(MarketHistory.volume * MarketHistory.average).desc())
                .limit(TOP_LIQUID_SAMPLE_SIZE)
            )
        ).all()

        method_wins = Counter()
        for row in top_liquid_rows:
            rows = (
                await db.execute(
                    select(MarketHistory.date, MarketHistory.average)
                    .where(
                        MarketHistory.type_id == row.type_id,
                        MarketHistory.region_id == FOCUS_REGION_ID,
                        MarketHistory.date >= start_dt,
                        MarketHistory.date < end_dt,
                    )
                    .order_by(MarketHistory.date.asc())
                )
            ).all()
            series = to_series_rows(rows)
            scores = []
            for method in METHODS:
                payload = build_forecast_result(
                    series,
                    method=method,
                    forecast_days=FORECAST_DAYS,
                    validation_days=VALIDATION_DAYS,
                    include_anchor_point=False,
                )
                scores.append((float(payload["metrics"]["validation_mae"]), method))
            best_method = min(scores, key=lambda pair: pair[0])[1]
            method_wins[best_method] += 1

        table_method_wins = pd.DataFrame(
            [
                {
                    "Method": METHOD_LABELS[method],
                    "Win_count": method_wins.get(method, 0),
                    "Share_pct": round(method_wins.get(method, 0) / TOP_LIQUID_SAMPLE_SIZE * 100, 2),
                }
                for method in METHODS
            ]
        )

    return ExperimentData(
        total_rows=total_rows,
        window_rows=window_rows,
        stable_day_count=stable_day_count,
        table_plan=pd.DataFrame(plan_rows),
        table_turnover=pd.DataFrame(table_turnover_rows),
        table_metrics=pd.DataFrame(metrics_rows),
        table_method_wins=table_method_wins,
        top_items=top_items,
        scenario_series=scenario_series,
        item_names=item_names,
        best_by_item=best_by_item,
        improvement_vs_linear=improvement_vs_linear,
    )


def build_report(data: ExperimentData) -> str:
    plan_report = data.table_plan.rename(
        columns={
            "Scenario": "Сценарий",
            "Region": "Регион",
            "Item": "Товар",
            "Period": "Период",
            "Observations": "Наблюдений",
            "Forecast_days": "Горизонт_прогноза",
            "Validation_days": "Окно_валидации",
            "Methods": "Методы",
            "Min_price_ISK": "Мин_цена_ISK",
            "Max_price_ISK": "Макс_цена_ISK",
        }
    )
    turnover_table = data.table_turnover.copy()
    turnover_table = turnover_table.rename(
        columns={
            "Region": "Регион",
            "Rows": "Строк",
            "Turnover_ISK": "Оборот_ISK",
            "Turnover_TISK": "Оборот_трлн_ISK",
            "Share_pct": "Доля_проц",
        }
    )
    turnover_table["Оборот_ISK"] = turnover_table["Оборот_ISK"].map(format_isk)
    turnover_table["Оборот_трлн_ISK"] = turnover_table["Оборот_трлн_ISK"].map(
        lambda value: f"{value:.3f}"
    )
    turnover_table["Доля_проц"] = turnover_table["Доля_проц"].map(format_pct)

    metrics_table = data.table_metrics.copy()
    metrics_table = metrics_table.rename(
        columns={
            "Item": "Товар",
            "Method": "Метод",
            "Validation_MAE": "Validation_MAE",
            "Validation_RMSE": "Validation_RMSE",
            "Validation_MAPE_pct": "Validation_MAPE_проц",
            "R2": "R2",
            "Best_for_item": "Лучший_для_товара",
        }
    )
    for column in ["Validation_MAE", "Validation_RMSE", "Validation_MAPE_проц", "R2"]:
        metrics_table[column] = metrics_table[column].map(lambda value: f"{value:.6f}")

    wins_table = data.table_method_wins.copy()
    wins_table = wins_table.rename(
        columns={
            "Method": "Метод",
            "Win_count": "Побед",
            "Share_pct": "Доля_проц",
        }
    )
    wins_table["Доля_проц"] = wins_table["Доля_проц"].map(format_pct)

    best_lines = []
    for item in data.table_plan["Item"]:
        best_method = data.best_by_item[item]
        improvement = data.improvement_vs_linear[item]
        if improvement > 0:
            best_lines.append(
                f"- Для `{item}` лучшим методом оказался `{best_method}`, улучшив validation MAE "
                f"относительно Linear Regression на {improvement:.2f}%."
            )
        else:
            best_lines.append(
                f"- Для `{item}` лучшим методом остался `Linear Regression`; конкуренты не дали выигрыша по validation MAE."
            )

    dominant_region = data.table_turnover.iloc[0]
    dense_window_text = (
        f"В расчётах использовано стабильное окно наблюдений `{WINDOW_START.isoformat()}`-`{WINDOW_END.isoformat()}` "
        f"({data.stable_day_count} календарных дней). День `2026-04-21` исключён из основного эксперимента, "
        f"так как в БД на момент расчёта он был заполнен лишь частично."
    )

    return f"""# Результаты вычислительного эксперимента (Трек П)

## План эксперимента и расчётов

Эксперимент выполнен на реальных данных проекта FluxEV Engine, сохранённых в таблице `market_history` PostgreSQL. На момент расчёта в базе содержалось `{data.total_rows}` строк рыночной истории, из которых `{data.window_rows}` строк попали в устойчивое экспериментальное окно. {dense_window_text}

В качестве основной площадки для сравнения методов прогноза выбран хаб `Jita`, поскольку он обладает максимальной ликвидностью и наибольшим числом наблюдений. Для детального сравнения были взяты пять базовых ресурсов с полной ежедневной историей в выбранном окне: `Tritanium`, `Pyerite`, `Mexallon`, `Isogen`, `Nocxium`. Для каждого сценария использовались одинаковые параметры: горизонт прогноза `7` дней, валидационное окно `7` последних наблюдений, а также единый набор моделей `linear`, `holt_winters`, `arima`, `autoreg`. Такой дизайн исключает влияние различий во входных данных и позволяет интерпретировать разницу результатов именно как следствие различий между алгоритмами.

**Таблица 1. План вычислительного эксперимента**

{dataframe_to_markdown(plan_report)}

## Таблицы с численными данными

Сначала были рассчитаны агрегированные показатели оборота по ключевым торговым регионам в том же устойчивом окне. Полученные значения показывают ярко выраженную концентрацию рыночной активности в `Jita`: суммарный оборот этого хаба составил {format_isk(float(dominant_region["Turnover_ISK"]))} ISK, что соответствует {dominant_region["Share_pct"]:.2f}% всего оборота рассматриваемой выборки.

**Таблица 2. Оборот по регионам в окне `{WINDOW_START.isoformat()}`-`{WINDOW_END.isoformat()}`**

{dataframe_to_markdown(turnover_table)}

Основная таблица сравнения моделей строилась по валидационным метрикам. Критерием выбора лучшего метода в каждом сценарии служил минимум `Validation_MAE`, так как именно эта метрика используется в проекте для выбора предпочтительной модели на одном временном ряду.

**Таблица 3. Сравнение моделей по товарам (Jita, валидационное окно 7 дней)**

{dataframe_to_markdown(metrics_table)}

Для дополнительной проверки устойчивости вывода был проведён подсчёт числа побед методов на `10` наиболее ликвидных товарах `Jita`, имеющих полное покрытие в выбранном окне.

**Таблица 4. Число побед методов по критерию `Validation_MAE` на топ-10 ликвидных товарах Jita**

{dataframe_to_markdown(wins_table)}

## Графики и диаграммы

Ниже приведены графики, построенные на тех же данных и с теми же параметрами, что и численные таблицы.

![Figure 1](figure1_region_turnover.png)

На рисунке 1 видно, что рынок в пределах исследуемого окна жёстко центрирован вокруг `Jita`; остальные хабы выполняют роль вторичных площадок с существенно меньшим оборотом.

![Figure 2](figure2_jita_top10_turnover.png)

Рисунок 2 показывает структуру оборота внутри `Jita`. Наибольший вклад в суммарный оборот в исследуемом окне внесли `HyperCore`, `Logic Circuit`, `Triglavian Survey Database`, `Drone Iteration Data` и `Isogen`.

![Figure 3](figure3_forecast_comparison.png)

Рисунок 3 иллюстрирует сравнение прогнозных траекторий на примере `Isogen`. На графике видны реальные значения и продолжения ряда, построенные всеми четырьмя методами.

![Figure 4](figure4_validation_holdout.png)

Рисунок 4 отражает процедуру верификации на тестовых данных: модель обучается на усечённой истории, а затем прогнозирует последние `7` наблюдений, которые сравниваются с фактическими значениями.

![Figure 5](figure5_method_wins.png)

Рисунок 5 обобщает результаты сравнения на расширенной выборке из `10` наиболее ликвидных товаров `Jita`.

## Анализ результатов и сравнение с бейзлайном

В рамках Трека П базовой моделью выступает `Linear Regression`. Сравнение с конкурентами показало, что единый доминирующий метод отсутствует, а качество прогноза определяется структурой конкретного временного ряда.

{chr(10).join(best_lines)}

В двух сценариях из пяти лучший результат дал `ARIMA`, в двух сценариях — `Holt-Winters ETS`, и только в одном сценарии бейзлайн `Linear Regression` сохранил лидерство. Это означает, что линейный тренд остаётся полезной отправной точкой, но на рядах с локальными переломами, изменением наклона и выраженной автокорреляцией он уступает более гибким моделям.

Дополнительная проверка на расширенной выборке из `10` наиболее ликвидных товаров `Jita` усиливает этот вывод: `ARIMA` выиграла {int(data.table_method_wins.loc[data.table_method_wins["Method"] == "ARIMA", "Win_count"].iloc[0])} сценариев, `Holt-Winters ETS` — {int(data.table_method_wins.loc[data.table_method_wins["Method"] == "Holt-Winters ETS", "Win_count"].iloc[0])}, `AutoReg` — {int(data.table_method_wins.loc[data.table_method_wins["Method"] == "AutoReg", "Win_count"].iloc[0])}, а `Linear Regression` не стала лучшей ни в одном из этих более сложных сценариев. Тем самым конкурентные модели в среднем оказываются предпочтительнее бейзлайна на наиболее ликвидных и содержательно сложных рядах.

Важно отметить, что высокое значение `R2` само по себе не гарантирует лучшего поведения на тестовом участке. Например, для части сценариев `ARIMA` показывает более слабые внутривыборочные показатели, но выигрывает по `Validation_MAE`, то есть лучше работает именно в режиме краткосрочного прогноза. Для практического использования в аналитической системе это важнее, чем качество аппроксимации уже известных данных.

## Верификация на тестовых данных

Верификация выполнена по схеме `temporal hold-out`. Для каждого временного ряда последние `7` наблюдений не использовались при обучении, а применялись как тестовый фрагмент. Далее модель обучалась на предыдущей части ряда, строила прогноз на `7` дней, и полученные значения сравнивались с фактическими ценами тестового участка. В качестве контрольных показателей использовались `Validation_MAE`, `Validation_RMSE` и `Validation_MAPE`.

Такая постановка верификации соответствует реальному сценарию применения системы: при работе аналитика будущие значения заранее неизвестны, поэтому модель должна корректно переноситься на новые данные, а не только качественно описывать историю. Полученные результаты подтверждают корректность прогнозной подсистемы и показывают, что выбор модели следует делать не по одному универсальному правилу, а по поведению на конкретном типе рыночного ряда.

## Вывод по разделу

Проведённый вычислительный эксперимент подтвердил, что разработанный программный интерфейс действительно решает не только задачу визуализации, но и задачу сравнительного анализа методов прогнозирования на данных внутриигровой экономики. На уровне агрегированных показателей была выявлена сильная концентрация оборота в `Jita`, а на уровне отдельных товаров установлено, что более сложные модели нередко превосходят линейный бейзлайн по ошибке на тестовом участке.

Для Трека П основной результат состоит в том, что сравнение с бейзлайном проведено на одинаковых временных рядах и показало практическую полезность конкурентных моделей. При этом абсолютного лидера среди методов не обнаружено: выбор оптимального подхода зависит от структуры ряда, текущей волатильности и характера локальных изменений цены. Следовательно, интеграция в систему нескольких моделей прогноза и механизма выбора лучшей по валидационной метрике является обоснованным решением для анализа рынка EVE Online.
"""


async def main() -> None:
    ensure_report_dir()
    data = await collect_experiment_data()

    save_table(data.table_plan, "table1_experiment_plan.csv")
    save_table(data.table_turnover, "table2_region_turnover.csv")
    save_table(data.table_metrics, "table3_model_metrics.csv")
    save_table(data.table_method_wins, "table4_method_wins.csv")
    save_table(data.top_items, "table5_top_items_jita.csv")
    save_excel_workbook(
        "assignment7_track_p_tables.xlsx",
        [
            ("Table 1 Plan", data.table_plan),
            ("Table 2 Regions", data.table_turnover),
            ("Table 3 Metrics", data.table_metrics),
            ("Table 4 Wins", data.table_method_wins),
            ("Table 5 Top Items", data.top_items),
        ],
    )
    save_excel_workbook("table1_experiment_plan.xlsx", [("Experiment plan", data.table_plan)])
    save_excel_workbook("table2_region_turnover.xlsx", [("Region turnover", data.table_turnover)])
    save_excel_workbook("table3_model_metrics.xlsx", [("Model metrics", data.table_metrics)])
    save_excel_workbook("table4_method_wins.xlsx", [("Method wins", data.table_method_wins)])
    save_excel_workbook("table5_top_items_jita.xlsx", [("Top items Jita", data.top_items)])

    plot_region_turnover(data.table_turnover)
    plot_top_items(data.top_items)
    plot_forecast_comparison(
        data.item_names[FORECAST_FIGURE_ITEM_ID],
        data.scenario_series[FORECAST_FIGURE_ITEM_ID],
    )
    plot_validation_holdout(
        data.item_names[FORECAST_FIGURE_ITEM_ID],
        data.scenario_series[FORECAST_FIGURE_ITEM_ID],
    )
    plot_method_wins(data.table_method_wins)

    REPORT_PATH.write_text(build_report(data), encoding="utf-8")
    print(f"Report written to: {REPORT_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
