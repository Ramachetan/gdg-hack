"""In-process cache for the latest camera frame and any annotations Otto produces.

Single-tenant by design — this app is expected to run as one Cloud Run instance
serving one demo user at a time. ``annotate_frame`` and the ``/annotations/{id}``
endpoint share state through this module.
"""

from __future__ import annotations

import threading
import uuid

_lock = threading.Lock()
_latest_frame_jpeg: bytes | None = None
_annotations: dict[str, bytes] = {}


# --- camera frames -------------------------------------------------------------

def set_latest_frame(jpeg_bytes: bytes) -> None:
    """Stash the most recent camera JPEG so tools can read it."""
    global _latest_frame_jpeg
    with _lock:
        _latest_frame_jpeg = jpeg_bytes


def get_latest_frame() -> bytes | None:
    with _lock:
        return _latest_frame_jpeg


# --- annotation PNGs (referenced by URL from tool responses) ------------------

def store_annotation(png_bytes: bytes) -> str:
    """Save an annotation PNG. Returns a short id used in the /annotations URL."""
    annotation_id = uuid.uuid4().hex[:12]
    with _lock:
        _annotations[annotation_id] = png_bytes
    return annotation_id


def get_annotation(annotation_id: str) -> bytes | None:
    with _lock:
        return _annotations.get(annotation_id)
