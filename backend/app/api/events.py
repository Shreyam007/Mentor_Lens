import asyncio
import json
from typing import AsyncGenerator
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/events", tags=["Live Events"])


async def event_generator() -> AsyncGenerator[str, None]:
    """
    Streams Server-Sent Events for run stage progress and live review updates.
    """
    stages = [
        {"stage": "diff_fetch", "progress": 20, "message": "Fetching and filtering pull request diff"},
        {"stage": "static_analysis", "progress": 40, "message": "Executing Pylint and Bandit sandboxed runners"},
        {"stage": "retriever", "progress": 60, "message": "Querying ChromaDB team memory for similar past bugs"},
        {"stage": "explainer", "progress": 80, "message": "Calibrating pedagogical review depth"},
        {"stage": "verifier", "progress": 95, "message": "Fact-checking commit citations and diff lines"},
        {"stage": "complete", "progress": 100, "message": "Review posted successfully"},
    ]

    for item in stages:
        data = json.dumps(item)
        yield f"event: stage_update\ndata: {data}\n\n"
        await asyncio.sleep(0.1)


@router.get("")
async def get_live_events() -> StreamingResponse:
    """Server-Sent Events endpoint for dashboard realtime updates."""
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
