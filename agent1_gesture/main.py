"""
Agent 1 — Gesture-to-Text Microservice
=======================================
Receives 21-point hand landmark arrays from browser MediaPipe WASM.
Uses a sliding window buffer and ONNX DNN model to recognize ISL/ASL gloss tokens.
Falls back to a rule-based geometric classifier when no ONNX model is available.

Port: 8001
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import json
import math
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("omnisign.agent1")

app = FastAPI(title="Agent 1 - Gesture to Text", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Configuration ───
WINDOW = int(os.getenv("LANDMARK_BUFFER_WINDOW", "30"))
CONFIDENCE_THRESHOLD = float(os.getenv("GESTURE_CONFIDENCE_THRESHOLD", "0.65"))
MODEL_PATH = os.getenv("ONNX_MODEL_PATH", "model/landmark_dnn.onnx")

# ─── Model Loading ───
ort_session = None
labels = []

try:
    import onnxruntime as ort

    if Path(MODEL_PATH).exists():
        ort_session = ort.InferenceSession(
            MODEL_PATH, providers=["CPUExecutionProvider"]
        )
        labels_path = Path("model/class_labels.json")
        if labels_path.exists():
            labels = json.loads(labels_path.read_text())
        logger.info(f"✅ ONNX model loaded from {MODEL_PATH} ({len(labels)} classes)")
    else:
        logger.warning(f"⚠️  ONNX model not found at {MODEL_PATH} — using geometric fallback")
except ImportError:
    logger.warning("⚠️  onnxruntime not installed — using geometric fallback")


# ─── Geometric Fallback Classifier ───
# When no trained ONNX model is available, use hand geometry to detect basic signs.
# This recognizes common ISL/ASL gestures based on finger extension patterns.

def _finger_extended(landmarks: list, finger_tip: int, finger_pip: int) -> bool:
    """Check if a finger is extended based on tip vs PIP joint y-position."""
    if len(landmarks) < max(finger_tip * 2 + 2, finger_pip * 2 + 2):
        return False
    tip_y = landmarks[finger_tip * 2 + 1]
    pip_y = landmarks[finger_pip * 2 + 1]
    return tip_y < pip_y  # In normalized coords, y=0 is top


def _thumb_extended(landmarks: list) -> bool:
    """Check thumb extension (uses x-distance from palm)."""
    if len(landmarks) < 10:
        return False
    thumb_tip_x = landmarks[4 * 2]
    thumb_ip_x = landmarks[3 * 2]
    wrist_x = landmarks[0]
    # Thumb is extended if tip is further from wrist than IP joint
    return abs(thumb_tip_x - wrist_x) > abs(thumb_ip_x - wrist_x)


def _distance(landmarks: list, p1: int, p2: int) -> float:
    """Euclidean distance between two landmark points."""
    x1, y1 = landmarks[p1 * 2], landmarks[p1 * 2 + 1]
    x2, y2 = landmarks[p2 * 2], landmarks[p2 * 2 + 1]
    return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)


def geometric_classify(landmarks: list) -> tuple:
    """
    Rule-based gesture classification using finger extension patterns.
    Returns (gloss_token, confidence).
    
    Landmark indices (MediaPipe hand):
      0=wrist, 4=thumb_tip, 8=index_tip, 12=middle_tip, 16=ring_tip, 20=pinky_tip
      PIP joints: 3=thumb_ip, 6=index_pip, 10=middle_pip, 14=ring_pip, 18=pinky_pip
    """
    if len(landmarks) < 42:
        return None, 0.0

    thumb = _thumb_extended(landmarks)
    index = _finger_extended(landmarks, 8, 6)
    middle = _finger_extended(landmarks, 12, 10)
    ring = _finger_extended(landmarks, 16, 14)
    pinky = _finger_extended(landmarks, 20, 18)

    fingers = [thumb, index, middle, ring, pinky]
    extended_count = sum(fingers)

    # Open palm = HELLO (all fingers extended)
    if extended_count == 5:
        return "HELLO", 0.85

    # Fist = NO / STOP (no fingers extended)
    if extended_count == 0:
        return "NO", 0.80

    # Thumbs up = YES / GOOD
    if thumb and not index and not middle and not ring and not pinky:
        return "YES", 0.85

    # Index finger only = POINT / ONE / I
    if not thumb and index and not middle and not ring and not pinky:
        return "I", 0.80

    # Peace sign (index + middle) = TWO / PEACE / V
    if not thumb and index and middle and not ring and not pinky:
        return "YOU", 0.78

    # Index + middle + ring = THREE / W
    if not thumb and index and middle and ring and not pinky:
        return "WANT", 0.75

    # Pinky only = I-LOVE-YOU (simplified)
    if not thumb and not index and not middle and not ring and pinky:
        return "SMALL", 0.70

    # Thumb + pinky (shaka) = HELLO (informal) / PHONE
    if thumb and not index and not middle and not ring and pinky:
        return "PHONE", 0.75

    # Thumb + index (L shape) = L / LIKE
    if thumb and index and not middle and not ring and not pinky:
        return "LIKE", 0.75

    # Thumb + index + pinky = I-LOVE-YOU (ASL)
    if thumb and index and not middle and not ring and pinky:
        return "LOVE", 0.82

    # Check for pinch (thumb tip close to index tip) = OK / UNDERSTAND
    pinch_dist = _distance(landmarks, 4, 8)
    if pinch_dist < 0.05:
        return "OK", 0.80

    # Four fingers (no thumb) = WAIT
    if not thumb and index and middle and ring and pinky:
        return "WAIT", 0.72

    return "UNKNOWN", 0.30


# ─── Per-session landmark buffers ───
buffers: dict[str, list] = {}
last_predictions: dict[str, list] = {}


@app.post("/predict")
async def predict(payload: dict):
    """
    Predict gloss token from landmark data.
    
    Input:  { "landmarks": [42 floats], "session_id": "abc", "frame_id": 0 }
    Output: { "gloss": ["HELLO"], "confidence": 0.85, "status": "ok" }
    """
    session_id = payload.get("session_id", "default")
    landmarks = payload.get("landmarks", [])

    if not landmarks or len(landmarks) < 42:
        return {"gloss": [], "status": "invalid_input", "message": "Expected 42 landmark values (21 points × 2 coords)"}

    # Buffer management
    if session_id not in buffers:
        buffers[session_id] = []
        last_predictions[session_id] = []

    buffers[session_id].append(landmarks)

    # ─── ONNX Model Path ───
    if ort_session is not None:
        if len(buffers[session_id]) < WINDOW:
            return {
                "gloss": [],
                "status": "buffering",
                "buffered": len(buffers[session_id]),
                "window": WINDOW,
            }

        # Build input tensor: (1, WINDOW, 42)
        window_data = np.array(
            buffers[session_id][-WINDOW:], dtype=np.float32
        ).reshape(1, WINDOW, 42)
        buffers[session_id] = buffers[session_id][-WINDOW:]  # Slide window

        input_name = ort_session.get_inputs()[0].name
        outputs = ort_session.run(None, {input_name: window_data})
        pred_idx = int(np.argmax(outputs[0]))
        confidence = float(np.max(outputs[0]))

        if confidence < CONFIDENCE_THRESHOLD:
            return {"gloss": [], "status": "low_confidence", "confidence": confidence}

        gloss_token = labels[pred_idx] if pred_idx < len(labels) else "UNKNOWN"
        return {"gloss": [gloss_token], "confidence": confidence, "status": "ok"}

    # ─── Geometric Fallback Path ───
    else:
        # Use latest frame for geometric classification (no buffering needed)
        gloss_token, confidence = geometric_classify(landmarks)

        if gloss_token is None or confidence < CONFIDENCE_THRESHOLD:
            return {"gloss": [], "status": "low_confidence", "confidence": confidence}

        # Debounce: don't repeat the same token rapidly
        recent = last_predictions.get(session_id, [])
        if recent and recent[-1] == gloss_token and len(buffers[session_id]) % 15 != 0:
            return {"gloss": [], "status": "debouncing"}

        last_predictions[session_id] = (recent + [gloss_token])[-10:]

        return {
            "gloss": [gloss_token],
            "confidence": confidence,
            "status": "ok",
            "method": "geometric_fallback",
        }


@app.post("/predict-batch")
async def predict_batch(payload: dict):
    """Batch prediction for multiple frames at once."""
    frames = payload.get("frames", [])
    results = []
    for frame in frames:
        result = await predict(frame)
        if result.get("gloss"):
            results.extend(result["gloss"])
    return {"gloss": results, "count": len(results)}


@app.delete("/session/{session_id}")
async def clear_session(session_id: str):
    """Clear the buffer for a given session."""
    buffers.pop(session_id, None)
    last_predictions.pop(session_id, None)
    return {"status": "cleared", "session_id": session_id}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "agent1_gesture",
        "model": "onnx" if ort_session else "geometric_fallback",
        "classes": len(labels),
    }


@app.get("/info")
async def info():
    return {
        "service": "Agent 1 — Gesture to Text",
        "description": "Converts 21-point hand landmarks into ISL/ASL gloss tokens",
        "model_type": "ONNX DNN" if ort_session else "Geometric rule-based classifier",
        "window_size": WINDOW,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "supported_gestures": [
            "HELLO", "YES", "NO", "I", "YOU", "WANT", "LIKE", "LOVE",
            "OK", "PHONE", "SMALL", "WAIT", "UNKNOWN",
        ] if not ort_session else f"{len(labels)} trained classes",
    }
