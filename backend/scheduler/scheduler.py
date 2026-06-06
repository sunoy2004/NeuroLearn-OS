"""APScheduler wiring for Render keep-alive pings."""

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from backend.config import settings
from backend.scheduler.keep_alive import ping_services

_scheduler: AsyncIOScheduler | None = None
_started = False


def start_scheduler() -> None:
    """Start the keep-alive scheduler once per process."""
    global _scheduler, _started

    if _started:
        return

    if not settings.KEEP_ALIVE_ENABLED:
        print("[KeepAlive] Scheduler disabled (KEEP_ALIVE_ENABLED=false)")
        return

    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        ping_services,
        "interval",
        minutes=settings.KEEP_ALIVE_INTERVAL_MINUTES,
        id="keep_alive_ping",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    _started = True
    print("KeepAlive Scheduler Started")


def stop_scheduler() -> None:
    """Shut down the scheduler on application exit."""
    global _scheduler, _started

    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)

    _scheduler = None
    _started = False
