from datetime import datetime
from sqlalchemy import Integer, String, Float, DateTime, BigInteger
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class TrackedItem(Base):
    __tablename__ = "tracked_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MarketHistory(Base):
    __tablename__ = "market_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    type_id: Mapped[int] = mapped_column(Integer, nullable=False)
    region_id: Mapped[int] = mapped_column(Integer, nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    average: Mapped[float] = mapped_column(Float, nullable=False)
    highest: Mapped[float] = mapped_column(Float, nullable=False)
    lowest: Mapped[float] = mapped_column(Float, nullable=False)
    volume: Mapped[int] = mapped_column(BigInteger, nullable=False)
    order_count: Mapped[int] = mapped_column(Integer, nullable=False)


class MarketOrder(Base):
    __tablename__ = "market_orders"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    type_id: Mapped[int] = mapped_column(Integer, nullable=False)
    region_id: Mapped[int] = mapped_column(Integer, nullable=False)
    location_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    volume_remain: Mapped[int] = mapped_column(Integer, nullable=False)
    is_buy_order: Mapped[bool] = mapped_column(nullable=False)
    issued: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
