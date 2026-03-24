from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db.models import TrackedItem, MarketHistory

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/items")
async def list_tracked_items(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TrackedItem))
    return result.scalars().all()


@router.get("/history/{type_id}")
async def get_history(type_id: int, region_id: int = 10000002, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MarketHistory)
        .where(MarketHistory.type_id == type_id, MarketHistory.region_id == region_id)
        .order_by(MarketHistory.date.desc())
        .limit(30)
    )
    return result.scalars().all()
