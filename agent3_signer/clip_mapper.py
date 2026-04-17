"""Clip Mapper — Maps gloss tokens to animation clip IDs + NMM weights."""
import json
from pathlib import Path

_data_path = Path("data/gloss_to_clip.json")
GLOSS_MAP = json.loads(_data_path.read_text()) if _data_path.exists() else {}

FALLBACK_CLIP = {
    "clip_id": "fingerspell_generic",
    "duration_ms": 600,
    "nmm": {"brow_neutral": 1.0},
}


def get_animation_sequence(gloss_tokens: list) -> list:
    """Convert gloss tokens to a sequence of animation clips with transitions."""
    clips = []
    for token in gloss_tokens:
        clip = GLOSS_MAP.get(token.upper(), FALLBACK_CLIP.copy())
        clip = dict(clip)  # Don't mutate the original
        clip["gloss"] = token
        clips.append(clip)

    # Add transitional blend frames between clips
    blended = []
    for i, clip in enumerate(clips):
        blended.append(clip)
        if i < len(clips) - 1:
            blended.append({
                "clip_id": "transition",
                "duration_ms": 150,
                "nmm": {},
                "gloss": "_transition_",
            })
    return blended
