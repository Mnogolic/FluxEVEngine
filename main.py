from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.esi.client import esi
from app.collector.scheduler import start_scheduler
from app.api.market import router as market_router
from app.api.dashboard import router as dashboard_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await esi.start()
    start_scheduler()
    yield
    await esi.stop()


app = FastAPI(title="FluxEVEngine", lifespan=lifespan)
app.include_router(market_router)
app.include_router(dashboard_router)
