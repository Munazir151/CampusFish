import asyncio
import json
from typing import Any

import httpx

from .config import settings

TERMINAL_STATES = {"COMPLETED", "FAILED", "CANCELLED"}


class TinyFishError(RuntimeError):
    pass


class TinyFishClient:
    def __init__(self) -> None:
        if not settings.tinyfish_api_key:
            raise TinyFishError("TINYFISH_API_KEY is not set")
        self._client = httpx.AsyncClient(
            base_url=settings.tinyfish_base_url,
            headers={
                "X-API-Key": settings.tinyfish_api_key,
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(60.0, connect=15.0),
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def start_run(self, url: str, goal: str, output_schema: dict | None = None) -> str:
        payload: dict[str, Any] = {"url": url, "goal": goal}
        if output_schema:
            payload["output_schema"] = output_schema
        response = await self._client.post("/v1/automation/run-async", json=payload)
        if response.status_code >= 400:
            raise TinyFishError(f"TinyFish start failed ({response.status_code}): {response.text[:500]}")
        data = response.json()
        run_id = data.get("run_id") or data.get("id")
        if not run_id:
            raise TinyFishError(f"TinyFish returned no run_id: {data}")
        return run_id

    async def get_run(self, run_id: str) -> dict:
        response = await self._client.get(f"/v1/runs/{run_id}")
        if response.status_code >= 400:
            raise TinyFishError(f"TinyFish poll failed ({response.status_code}): {response.text[:500]}")
        return response.json()

    async def cancel_run(self, run_id: str) -> dict:
        response = await self._client.post(f"/v1/runs/{run_id}/cancel")
        if response.status_code >= 400:
            raise TinyFishError(f"TinyFish cancel failed ({response.status_code}): {response.text[:300]}")
        return response.json()

    async def wait_for_run(self, run_id: str, timeout_seconds: int) -> dict:
        deadline = asyncio.get_event_loop().time() + timeout_seconds
        delay = 2.0
        while asyncio.get_event_loop().time() < deadline:
            run = await self.get_run(run_id)
            status = str(run.get("status", "")).upper()
            if status in TERMINAL_STATES:
                if status != "COMPLETED":
                    raise TinyFishError(run.get("error") or f"Run ended with status {status}")
                return run
            await asyncio.sleep(delay)
            delay = min(delay * 1.4, 8.0)
        raise TinyFishError(f"Run timed out after {timeout_seconds}s")

    async def run(self, url: str, goal: str, output_schema: dict | None, timeout_seconds: int) -> dict:
        run_id = await self.start_run(url, goal, output_schema)
        run = await self.wait_for_run(run_id, timeout_seconds)
        run["_run_id"] = run_id
        return run


def extract_result(run: dict) -> Any:
    """TinyFish returns the agent output in run.result; it may be wrapped or a JSON string."""
    result = run.get("result")
    if result is None:
        result = run.get("output")
    if isinstance(result, str):
        text = result.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:]
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"raw": result}
    return result


def normalize_items(result: Any) -> list[dict]:
    """Tolerate the many shapes an agent may return a list in."""
    if result is None:
        return []
    if isinstance(result, list):
        return [i for i in result if isinstance(i, dict)]
    if isinstance(result, dict):
        for key in ("results", "items", "circulars", "notices", "data", "notifications"):
            value = result.get(key)
            if isinstance(value, list):
                return [i for i in value if isinstance(i, dict)]
        if isinstance(result.get("result"), list):
            return [i for i in result["result"] if isinstance(i, dict)]
        if result.get("title"):
            return [result]
    return []
