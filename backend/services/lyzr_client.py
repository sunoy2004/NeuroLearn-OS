"""
Shared Lyzr Studio inference client — used by backend multi-agent orchestration.
POST https://agent-prod.studio.lyzr.ai/v3/inference/chat/
"""

import os
import uuid
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import httpx

from backend.config import settings


def _ensure_env_loaded() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


_ensure_env_loaded()


def _base_url() -> str:
    return (settings.LYZR_BASE_URL or "https://agent-prod.studio.lyzr.ai").rstrip("/")


def get_agent_lyzr_credentials(prefix: str) -> Tuple[str, str]:
    """Return (api_key, lyzr_agent_id) for an env prefix like ORCHESTRATOR or TUTOR."""
    api_key = (
        os.environ.get(f"{prefix}_AGENT_API_KEY", "").strip()
        or os.environ.get("ORCHESTRATOR_AGENT_API_KEY", "").strip()
    )
    agent_id = os.environ.get(f"{prefix}_AGENT_LYZR_ID", "").strip()
    return api_key, agent_id


def is_lyzr_configured(api_key: str, agent_id: str) -> bool:
    if not api_key or not agent_id:
        return False
    if "dummy" in api_key.lower() or api_key.startswith("YOUR_"):
        return False
    if agent_id.startswith("YOUR_"):
        return False
    return True


def lyzr_chat(
    api_key: str,
    agent_id: str,
    message: str,
    session_id: Optional[str] = None,
    user_id: str = "neurolearn-user",
) -> str:
    if not is_lyzr_configured(api_key, agent_id):
        raise RuntimeError(f"Lyzr agent not configured (agent_id={agent_id or 'missing'})")

    url = f"{_base_url()}/v3/inference/chat/"
    headers = {"x-api-key": api_key, "Content-Type": "application/json"}
    payload = {
        "user_id": user_id,
        "agent_id": agent_id,
        "session_id": session_id or f"nl-{uuid.uuid4().hex[:12]}",
        "message": message,
    }

    last_err: Optional[Exception] = None
    for attempt in range(3):
        try:
            with httpx.Client(timeout=90.0) as client:
                resp = client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                if isinstance(data, str):
                    return data.strip()
                if isinstance(data, dict):
                    for key in ("response", "message", "content", "output", "text"):
                        val = data.get(key)
                        if isinstance(val, str) and val.strip():
                            return val.strip()
                return str(data)
        except Exception as e:
            last_err = e
            time.sleep(0.4 * (attempt + 1))
    raise RuntimeError(f"Lyzr API error: {last_err}")


def lyzr_agent_execute(
    prefix: str,
    name: str,
    system_prompt: str,
    user_prompt: str,
    context: Optional[Dict[str, Any]] = None,
    session_id: Optional[str] = None,
) -> str:
    api_key, agent_id = get_agent_lyzr_credentials(prefix)
    parts = [f"[System Instructions]\n{system_prompt}"]
    if context:
        parts.append(f"[Context]\n{context}")
    parts.append(user_prompt)
    message = "\n\n".join(parts)
    return lyzr_chat(api_key, agent_id, message, session_id=session_id)
