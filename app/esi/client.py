from contextlib import asynccontextmanager
import aiohttp
from app.core.config import settings


class ESIClient:
    def __init__(self):
        self._session: aiohttp.ClientSession | None = None

    async def start(self):
        self._session = aiohttp.ClientSession(
            base_url=settings.esi_base_url,
            headers={"Accept": "application/json"},
        )

    async def stop(self):
        if self._session:
            await self._session.close()

    async def get(self, path: str, **params) -> dict | list:
        async with self._session.get(path, params=params) as resp:
            resp.raise_for_status()
            return await resp.json()


esi = ESIClient()
