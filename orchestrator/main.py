"""
OmniSign Orchestrator — FastAPI WebSocket Gateway
==================================================
The single entry point for the frontend. Routes data between agents.
Handles two bidirectional pipelines:
  1. Sign-to-Text: Webcam landmarks → Agent1 → Agent2 → Text output
  2. Text-to-Sign: Text input → Agent2 → Agent3 → Animation clip IDs
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import httpx
import json
import os
import logging
import asyncio
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("omnisign.orchestrator")

# Agent endpoints — Docker service names resolve automatically
AGENT1_URL = os.getenv("AGENT1_URL", "http://localhost:8001")
AGENT2_URL = os.getenv("AGENT2_URL", "http://localhost:8002")
AGENT3_URL = os.getenv("AGENT3_URL", "http://localhost:8003")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    logger.info("🚀 OmniSign Orchestrator starting...")
    logger.info(f"   Agent 1 (Gesture→Text): {AGENT1_URL}")
    logger.info(f"   Agent 2 (Syntax Bridge): {AGENT2_URL}")
    logger.info(f"   Agent 3 (Neural Signer): {AGENT3_URL}")

    # Wait for agents to be ready
    async with httpx.AsyncClient(timeout=5.0) as client:
        for name, url in [("Agent1", AGENT1_URL), ("Agent2", AGENT2_URL), ("Agent3", AGENT3_URL)]:
            for attempt in range(10):
                try:
                    r = await client.get(f"{url}/health")
                    if r.status_code == 200:
                        logger.info(f"   ✅ {name} is ready")
                        break
                except Exception:
                    pass
                if attempt < 9:
                    await asyncio.sleep(2)
            else:
                logger.warning(f"   ⚠️  {name} not reachable — will retry on demand")

    yield
    logger.info("🛑 OmniSign Orchestrator shutting down.")


app = FastAPI(
    title="OmniSign Orchestrator",
    description="Bidirectional Sign Language Translation Gateway",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# Pipeline 1: Sign → Text (Expressive)
# Webcam landmarks → Gloss tokens → English text
# ─────────────────────────────────────────────
@app.websocket("/ws/sign-to-text")
async def sign_to_text_pipeline(ws: WebSocket):
    """
    Receives JSON landmark frames from browser MediaPipe WASM.
    Routes through Agent1 (gesture recognition) → Agent2 (gloss-to-text).
    Returns translated text to the frontend.
    """
    await ws.accept()
    logger.info("📡 Sign-to-Text WebSocket connected")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            while True:
                data = await ws.receive_json()
                # data = { "landmarks": [42 floats], "session_id": "...", "frame_id": int }

                try:
                    # Step 1: Landmarks → Gloss tokens (Agent 1)
                    r1 = await client.post(f"{AGENT1_URL}/predict", json=data)
                    r1_data = r1.json()

                    if r1_data.get("status") == "buffering":
                        await ws.send_json({
                            "type": "status",
                            "message": "Analyzing gesture...",
                            "buffered": r1_data.get("buffered", 0),
                        })
                        continue

                    if r1_data.get("status") == "low_confidence":
                        await ws.send_json({
                            "type": "status",
                            "message": "Gesture unclear, keep signing...",
                        })
                        continue

                    gloss_tokens = r1_data.get("gloss", [])
                    if not gloss_tokens:
                        continue

                    # Step 2: Gloss → Natural text (Agent 2)
                    r2 = await client.post(
                        f"{AGENT2_URL}/gloss-to-text",
                        json={"gloss": gloss_tokens},
                    )
                    r2_data = r2.json()

                    await ws.send_json({
                        "type": "translation",
                        "text": r2_data.get("text", ""),
                        "gloss": gloss_tokens,
                        "confidence": r1_data.get("confidence", 0),
                    })

                except httpx.RequestError as e:
                    logger.error(f"Agent request failed: {e}")
                    await ws.send_json({
                        "type": "error",
                        "message": "Translation service temporarily unavailable",
                    })

    except WebSocketDisconnect:
        logger.info("📡 Sign-to-Text WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")


# ─────────────────────────────────────────────
# Pipeline 2: Text → Sign (Receptive)
# English text → Gloss sequence → Animation clip IDs
# ─────────────────────────────────────────────
@app.websocket("/ws/text-to-sign")
async def text_to_sign_pipeline(ws: WebSocket):
    """
    Receives text input from the frontend.
    Routes through Agent2 (text-to-gloss) → Agent3 (gloss-to-clips).
    Returns animation clip IDs + NMM metadata for Three.js rendering.
    """
    await ws.accept()
    logger.info("📡 Text-to-Sign WebSocket connected")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            while True:
                data = await ws.receive_json()
                # data = { "text": "Hello, how are you?" }

                text = data.get("text", "").strip()
                if not text:
                    continue

                try:
                    # Step 1: Text → Gloss sequence (Agent 2)
                    r2 = await client.post(
                        f"{AGENT2_URL}/text-to-gloss",
                        json={"text": text},
                    )
                    r2_data = r2.json()
                    gloss_sequence = r2_data.get("gloss", [])

                    if not gloss_sequence:
                        await ws.send_json({
                            "type": "error",
                            "message": "Could not parse text into sign language",
                        })
                        continue

                    # Step 2: Gloss → Animation clips + NMMs (Agent 3)
                    r3 = await client.post(
                        f"{AGENT3_URL}/get-clips",
                        json={"gloss": gloss_sequence},
                    )
                    r3_data = r3.json()

                    await ws.send_json({
                        "type": "animation",
                        "clips": r3_data.get("clips", []),
                        "gloss": gloss_sequence,
                        "original_text": text,
                        "method": r2_data.get("method", "unknown"),
                    })

                except httpx.RequestError as e:
                    logger.error(f"Agent request failed: {e}")
                    await ws.send_json({
                        "type": "error",
                        "message": "Translation service temporarily unavailable",
                    })

    except WebSocketDisconnect:
        logger.info("📡 Text-to-Sign WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")


# ─────────────────────────────────────────────
# REST Endpoints
# ─────────────────────────────────────────────
@app.get("/health")
async def health():
    """Health check for the orchestrator itself."""
    return {"status": "ok", "service": "orchestrator"}


@app.get("/health/all")
async def health_all():
    """Aggregate health check for all services."""
    results = {"orchestrator": "ok"}
    async with httpx.AsyncClient(timeout=3.0) as client:
        for name, url in [
            ("agent1_gesture", AGENT1_URL),
            ("agent2_syntax", AGENT2_URL),
            ("agent3_signer", AGENT3_URL),
        ]:
            try:
                r = await client.get(f"{url}/health")
                results[name] = "ok" if r.status_code == 200 else "degraded"
            except Exception:
                results[name] = "unreachable"

    all_ok = all(v == "ok" for v in results.values())
    return {"status": "ok" if all_ok else "degraded", "services": results}


@app.post("/api/translate/sign-to-text")
async def rest_sign_to_text(payload: dict):
    """REST fallback for sign-to-text (same pipeline as WebSocket)."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        r1 = await client.post(f"{AGENT1_URL}/predict", json=payload)
        r1_data = r1.json()

        if r1_data.get("status") != "ok" and not r1_data.get("gloss"):
            return r1_data

        r2 = await client.post(
            f"{AGENT2_URL}/gloss-to-text",
            json={"gloss": r1_data.get("gloss", [])},
        )
        return {**r2.json(), "confidence": r1_data.get("confidence", 0)}


@app.post("/api/translate/text-to-sign")
async def rest_text_to_sign(payload: dict):
    """REST fallback for text-to-sign (same pipeline as WebSocket)."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        r2 = await client.post(f"{AGENT2_URL}/text-to-gloss", json=payload)
        r2_data = r2.json()

        r3 = await client.post(
            f"{AGENT3_URL}/get-clips",
            json={"gloss": r2_data.get("gloss", [])},
        )
        return {**r3.json(), "gloss": r2_data.get("gloss", []), "method": r2_data.get("method")}
