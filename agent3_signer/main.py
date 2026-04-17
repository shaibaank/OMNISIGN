"""
Agent 3 — Neural Signer Microservice
=====================================
Maps gloss tokens to pre-baked animation clip IDs and NMM (Non-Manual Marker) weights.
The frontend Three.js renderer consumes these to drive the 3D avatar.

Port: 8003
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from clip_mapper import get_animation_sequence
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("omnisign.agent3")

app = FastAPI(title="Agent 3 - Neural Signer", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.post("/get-clips")
async def get_clips(payload: dict):
    gloss = payload.get("gloss", [])
    if not gloss:
        return {"clips": [], "error": "Empty gloss input"}
    clips = get_animation_sequence(gloss)
    return {"clips": clips, "total_duration_ms": sum(c["duration_ms"] for c in clips)}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "agent3_signer"}
