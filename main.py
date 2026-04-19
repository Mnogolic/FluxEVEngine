from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
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

static_dir = Path(__file__).resolve().parent / "static"
if static_dir.is_dir():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
