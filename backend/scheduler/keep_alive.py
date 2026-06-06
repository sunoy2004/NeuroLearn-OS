"""Periodic health pings to keep Render services from sleeping."""

import time

import httpx

from backend.config import settings

PING_TARGETS = (
    ("Agent Service", "AGENT_HEALTH_URL"),
    ("API Service", "API_HEALTH_URL"),
)


async def ping_services() -> None:
    """GET both Render health endpoints; log results without raising."""
    print("Pinging Render Services...")

    async with httpx.AsyncClient(timeout=90.0, follow_redirects=True) as client:
        for label, settings_key in PING_TARGETS:
            url = getattr(settings, settings_key, "").strip()
            if not url:
                print(f"[KeepAlive] {label}: skipped (URL not configured)")
                continue

            try:
                started = time.perf_counter()
                response = await client.get(url)
                elapsed_ms = (time.perf_counter() - started) * 1000

                if response.status_code == 200:
                    print(f"[KeepAlive] {label}: {response.status_code} OK ({elapsed_ms:.0f}ms)")
                else:
                    print(
                        f"[KeepAlive] {label}: {response.status_code} "
                        f"({elapsed_ms:.0f}ms)"
                    )
            except Exception as exc:
                print(f"[KeepAlive] {label} failed: {exc}")
