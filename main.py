from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.esi.client import esi
from app.collector.scheduler import start_scheduler
from app.api.market import router as market_router
from app.api.dashboard_data import router as dashboard_data_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown resources.

    Starts the shared ESI HTTP client and background scheduler before the
    application begins serving requests, then gracefully closes network
    resources on shutdown.
    """
    await esi.start()
    start_scheduler()
    yield
    await esi.stop()


app = FastAPI(title="FluxEVEngine", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(market_router)
app.include_router(dashboard_data_router)
