from contextlib import asynccontextmanager
import aiohttp
from app.core.config import settings


class ESIClient:
    """Minimal async client for requests to the EVE ESI API."""

    def __init__(self):
        """Initialize the client without opening a network session yet."""
        self._session: aiohttp.ClientSession | None = None

    async def start(self):
        """Create a shared aiohttp session using the configured base URL."""
        self._session = aiohttp.ClientSession(
            base_url=settings.esi_base_url.rstrip('/') + '/',
            headers={"Accept": "application/json"},
        )

    async def stop(self):
        """Close the shared aiohttp session if it was started before."""
        if self._session:
            await self._session.close()

    async def get(self, path: str, **params) -> dict | list:
        """Send a GET request to ESI and decode the JSON response."""
        async with self._session.get(path.lstrip('/'), params=params) as resp:
            resp.raise_for_status()
            return await resp.json()


esi = ESIClient()
