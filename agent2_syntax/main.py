"""
Agent 2 — Syntax Bridge Microservice
=====================================
Port: 8002
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from gloss_mapper import text_to_gloss, gloss_to_text
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("omnisign.agent2")

app = FastAPI(title="Agent 2 - Syntax Bridge", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.post("/text-to-gloss")
async def text_to_gloss_endpoint(payload: dict):
    text = payload.get("text", "").strip()
    if not text:
        return {"gloss": [], "method": "none", "original": text}
    gloss, method = text_to_gloss(text)
    return {"gloss": gloss, "method": method, "original": text}


@app.post("/gloss-to-text")
async def gloss_to_text_endpoint(payload: dict):
    gloss = payload.get("gloss", [])
    if not gloss:
        return {"text": "", "gloss": gloss}
    text = gloss_to_text(gloss)
    return {"text": text, "gloss": gloss}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "agent2_syntax"}
