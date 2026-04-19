from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

engine = create_async_engine(settings.database_url)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models in the project."""

    pass


async def get_db() -> AsyncSession:
    """Yield an async SQLAlchemy session for FastAPI dependency injection."""
    async with SessionLocal() as session:
        yield session
