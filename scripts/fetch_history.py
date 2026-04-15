"""Fetch market history for tracked items from ESI."""
import argparse
import asyncio
import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta

import aiohttp
from sqlalchemy import func, select

from app.db.models import MarketHistory, TrackedItem
from app.db.session import SessionLocal

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

ESI_BASE = "https://esi.evetech.net/latest"
REGIONS = {
    10000002: "Jita",
    10000043: "Amarr",
    10000032: "Dodixie",
    10000042: "Hek",
    10000030: "Rens",
}
DAYS = 30
DEFAULT_CONCURRENCY = 20
DEFAULT_TIMEOUT = 30
DEFAULT_PROGRESS_EVERY = 100
DEFAULT_FRESHNESS_LAG_DAYS = 2


def parse_args():
    parser = argparse.ArgumentParser(description="Fetch ESI market history into the database.")
    parser.add_argument("--days", type=int, default=DAYS, help="History window to keep, in days.")
    parser.add_argument(
        "--incremental",
        action="store_true",
        help="Skip item/region pairs that already have fresh enough data.",
    )
    parser.add_argument(
        "--freshness-lag-days",
        type=int,
        default=DEFAULT_FRESHNESS_LAG_DAYS,
        help="A pair is fresh if max(date) >= today minus this many days.",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=DEFAULT_CONCURRENCY,
        help="Maximum parallel ESI requests.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT,
        help="HTTP timeout per ESI request, in seconds.",
    )
    parser.add_argument(
        "--progress-every",
        type=int,
        default=DEFAULT_PROGRESS_EVERY,
        help="Log progress after this many processed item/region pairs.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned work and exit without calling ESI or writing to DB.",
    )
    parser.add_argument(
        "--max-pairs",
        type=int,
        default=0,
        help="Process at most this many item/region pairs; useful for smoke tests.",
    )
    return parser.parse_args()


async def fetch_history(session: aiohttp.ClientSession, type_id: int, region_id: int) -> list:
    try:
        async with session.get(
            f"{ESI_BASE}/markets/{region_id}/history/",
            params={"type_id": type_id},
        ) as resp:
            if resp.status == 404:
                return []
            if resp.status >= 400:
                logger.warning(f"ESI HTTP {resp.status} for {type_id} / {region_id}")
                return []
            return await resp.json()
    except (aiohttp.ClientError, asyncio.TimeoutError) as e:
        logger.warning(f"ESI request failed for {type_id} / {region_id}: {e}")
        return []


async def load_existing_state(cutoff: datetime):
    existing_dates = defaultdict(set)
    latest_dates = {}

    async with SessionLocal() as db:
        rows = (await db.execute(
            select(
                MarketHistory.type_id,
                MarketHistory.region_id,
                MarketHistory.date,
            ).where(MarketHistory.date >= cutoff)
        )).all()

        latest_rows = (await db.execute(
            select(
                MarketHistory.type_id,
                MarketHistory.region_id,
                func.max(MarketHistory.date),
            ).group_by(MarketHistory.type_id, MarketHistory.region_id)
        )).all()

    for type_id, region_id, date in rows:
        existing_dates[(type_id, region_id)].add(date.date())

    for type_id, region_id, max_date in latest_rows:
        latest_dates[(type_id, region_id)] = max_date.date()

    return existing_dates, latest_dates


def build_item_region_pairs(items, latest_dates: dict, incremental: bool, fresh_after):
    pairs = []
    skipped_fresh = 0

    for region_id, region_name in REGIONS.items():
        for item in items:
            key = (item.type_id, region_id)
            latest_date = latest_dates.get(key)
            if incremental and latest_date and latest_date >= fresh_after:
                skipped_fresh += 1
                continue
            pairs.append((item.type_id, region_id, region_name))

    return pairs, skipped_fresh


async def fetch_pair(http_session, semaphore, type_id: int, region_id: int, region_name: str):
    async with semaphore:
        history = await fetch_history(http_session, type_id, region_id)
    return type_id, region_id, region_name, history


def rows_from_history(type_id: int, region_id: int, history: list, cutoff: datetime, existing_dates: set):
    rows = []
    skipped = 0

    for entry in history:
        entry_date = datetime.strptime(entry["date"], "%Y-%m-%d")
        entry_day = entry_date.date()
        if entry_date < cutoff:
            continue

        if entry_day in existing_dates:
            skipped += 1
            continue

        rows.append(MarketHistory(
            type_id=type_id,
            region_id=region_id,
            date=entry_date,
            average=entry["average"],
            highest=entry["highest"],
            lowest=entry["lowest"],
            volume=entry["volume"],
            order_count=entry["order_count"],
        ))
        existing_dates.add(entry_day)

    return rows, skipped


async def main():
    args = parse_args()
    cutoff = datetime.now() - timedelta(days=args.days)
    fresh_after = (datetime.now() - timedelta(days=args.freshness_lag_days)).date()

    async with SessionLocal() as db:
        items = (await db.execute(select(TrackedItem))).scalars().all()

    logger.info("Loading existing market_history state from DB...")
    existing_dates, latest_dates = await load_existing_state(cutoff)
    pairs, skipped_fresh = build_item_region_pairs(
        items=items,
        latest_dates=latest_dates,
        incremental=args.incremental,
        fresh_after=fresh_after,
    )
    if args.max_pairs > 0:
        pairs = pairs[:args.max_pairs]

    logger.info("=" * 60)
    logger.info("FluxEV Engine - Historical Data Fetcher")
    logger.info("=" * 60)
    logger.info(f"Mode             : {'incremental' if args.incremental else 'full'}")
    logger.info(f"Items loaded     : {len(items)}")
    logger.info(f"Regions          : {', '.join(REGIONS.values())}")
    logger.info(f"Period           : last {args.days} days (since {cutoff.strftime('%Y-%m-%d')})")
    logger.info(f"Fresh after      : {fresh_after} (incremental skip threshold)")
    logger.info(f"Concurrency      : {args.concurrency}")
    logger.info(f"Max pairs        : {args.max_pairs or 'all'}")
    logger.info(f"Pairs skipped    : {skipped_fresh} (already fresh)")
    logger.info(f"Total API calls  : ~{len(pairs)}")
    logger.info("-" * 60)

    if args.dry_run:
        logger.info("Dry run complete: no ESI requests were made and DB was not changed.")
        return

    t_start = time.time()
    total_saved = 0
    total_skipped = 0
    processed = 0
    total_empty = 0
    region_stats = {
        region_id: {"name": name, "saved": 0, "skipped": 0, "empty": 0}
        for region_id, name in REGIONS.items()
    }

    timeout = aiohttp.ClientTimeout(total=args.timeout)
    semaphore = asyncio.Semaphore(args.concurrency)

    async with aiohttp.ClientSession(timeout=timeout) as http_session:
        tasks = [
            asyncio.create_task(fetch_pair(http_session, semaphore, type_id, region_id, region_name))
            for type_id, region_id, region_name in pairs
        ]

        async with SessionLocal() as db:
            for task in asyncio.as_completed(tasks):
                type_id, region_id, region_name, history = await task
                processed += 1

                if not history:
                    total_empty += 1
                    region_stats[region_id]["empty"] += 1
                else:
                    key = (type_id, region_id)
                    rows, skipped = rows_from_history(
                        type_id=type_id,
                        region_id=region_id,
                        history=history,
                        cutoff=cutoff,
                        existing_dates=existing_dates[key],
                    )
                    if rows:
                        db.add_all(rows)

                    total_saved += len(rows)
                    total_skipped += skipped
                    region_stats[region_id]["saved"] += len(rows)
                    region_stats[region_id]["skipped"] += skipped

                if args.progress_every and processed % args.progress_every == 0:
                    await db.commit()
                    logger.info(
                        f"Progress: {processed}/{len(pairs)} API calls | "
                        f"saved {total_saved} | skipped {total_skipped} | empty {total_empty}"
                    )

            await db.commit()

    for region_id, stats in region_stats.items():
        logger.info(
            f"  {stats['name']:<10} saved: {stats['saved']:>5} rows | "
            f"skipped: {stats['skipped']:>6} | empty: {stats['empty']:>3}"
        )

    elapsed_total = time.time() - t_start
    logger.info("-" * 60)
    logger.info(f"Total new rows saved : {total_saved}")
    logger.info(f"Total rows skipped   : {total_skipped} (already in DB)")
    logger.info(f"Fresh pairs skipped  : {skipped_fresh} (no ESI call)")
    logger.info(f"Empty ESI responses  : {total_empty}")
    logger.info(f"Total time           : {elapsed_total:.1f}s")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
