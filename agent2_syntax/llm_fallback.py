"""LLM fallback for complex sentence → gloss conversion via Ollama."""
import httpx
import json
import re
import os

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")

SYSTEM_PROMPT = """You are a sign language gloss generator. Convert English sentences 
into ISL (Indian Sign Language) gloss notation. Rules:
- Use UPPERCASE words
- Remove articles (a, an, the)
- Remove copula (is, are, am) unless essential
- Use sign language word order (Topic-Comment)
- Output only the gloss tokens as a JSON array, nothing else.
Example: "What is your name?" → ["YOUR", "NAME", "WHAT"]"""


def llm_to_gloss(text: str) -> list:
    """Use Ollama LLM to convert complex text to gloss. Falls back to word-by-word."""
    try:
        response = httpx.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": f"{SYSTEM_PROMPT}\n\nInput: {text}\nOutput:",
                "stream": False,
                "options": {"temperature": 0.1},
            },
            timeout=5.0,
        )
        raw = response.json().get("response", "")
        match = re.search(r"\[.*?\]", raw)
        if match:
            return json.loads(match.group())
    except Exception:
        pass

    # Ultimate fallback: word-by-word (graceful degradation)
    stop = {"a", "an", "the", "is", "are", "am", "was", "were", "to", "of", "it"}
    return [w.upper() for w in text.split() if w.lower() not in stop]
