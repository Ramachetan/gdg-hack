"""Thin client for the iFixit public API — used by the find_repair_guide tool.

We hit two endpoints:
    GET /api/2.0/search/{query}?filter=guide   → ranked list of guide hits
    GET /api/2.0/guides/{guideid}              → full guide with steps + media

No auth, no rate-limit headaches at hackathon scale. Content is CC BY-NC-SA;
the rendered HTML includes a backlink to the iFixit source.
"""

from __future__ import annotations

import html as _html
import logging
import urllib.parse
from typing import Any

import requests

logger = logging.getLogger(__name__)

_BASE = "https://www.ifixit.com/api/2.0"
_TIMEOUT = 8.0
_USER_AGENT = "Otto-Roadside-Hackathon/0.1 (+adk-bidi-demo)"


def _get(path: str, params: dict[str, Any] | None = None) -> Any:
    url = f"{_BASE}/{path}"
    r = requests.get(url, params=params or {}, timeout=_TIMEOUT, headers={"User-Agent": _USER_AGENT})
    r.raise_for_status()
    return r.json()


def search_guides(query: str, limit: int = 5) -> list[dict]:
    """Return up to ``limit`` guide hits for ``query`` (relevance-sorted)."""
    quoted = urllib.parse.quote(query, safe="")
    data = _get(f"search/{quoted}", {"limit": limit, "filter": "guide"})
    return data.get("results") or []


def get_guide(guide_id: int) -> dict:
    """Fetch a single guide's full content (steps, media, attribution)."""
    return _get(f"guides/{guide_id}")


def find_best_guide(query: str) -> dict | None:
    """Search and immediately fetch the top hit. Returns None if no results."""
    try:
        hits = search_guides(query, limit=5)
    except requests.RequestException as exc:
        logger.warning("iFixit search failed: %s", exc)
        return None
    if not hits:
        return None
    guide_id = hits[0].get("guideid")
    if not guide_id:
        return None
    try:
        return get_guide(int(guide_id))
    except requests.RequestException as exc:
        logger.warning("iFixit guide fetch failed for %s: %s", guide_id, exc)
        return None


def render_guide_html(guide: dict, max_steps: int = 4) -> str:
    """Compose a compact HTML block for the visual-guide panel.

    Caps step count so the tool response stays token-light when it goes back
    to the model. The frontend gets the same HTML and renders it inline.
    """
    title = _html.escape(guide.get("title") or "Repair guide")
    summary = guide.get("summary") or ""
    diff = guide.get("difficulty") or ""
    time_req = guide.get("time_required") or ""
    url = guide.get("url") or ""

    parts: list[str] = []
    if summary:
        parts.append(f'<p class="ifixit-summary">{_html.escape(summary)}</p>')
    meta_bits = []
    if diff:
        meta_bits.append(f"Difficulty: {_html.escape(diff)}")
    if time_req:
        meta_bits.append(f"Time: {_html.escape(time_req)}")
    if meta_bits:
        parts.append(f'<p class="ifixit-meta">{" · ".join(meta_bits)}</p>')

    steps = guide.get("steps") or []
    if steps:
        parts.append('<ol class="ifixit-steps">')
        for step in steps[:max_steps]:
            parts.append("<li>")
            # First image, if any
            media = (step.get("media") or {}).get("data") or []
            if media:
                img_url = media[0].get("standard") or media[0].get("thumbnail")
                if img_url:
                    parts.append(
                        f'<img src="{_html.escape(img_url)}" alt="" loading="lazy">'
                    )
            for line in step.get("lines") or []:
                text = line.get("text_rendered") or line.get("text_raw") or ""
                bullet = (line.get("bullet") or "").lower()
                prefix = "⚠️ " if "caution" in bullet or "reminder" in bullet or "warning" in bullet else ""
                # text_rendered already contains safe HTML from iFixit
                parts.append(f"<div>{prefix}{text}</div>")
            parts.append("</li>")
        parts.append("</ol>")

        if len(steps) > max_steps:
            parts.append(
                f'<p class="ifixit-more">+{len(steps) - max_steps} more steps in the full guide.</p>'
            )

    if url:
        parts.append(
            f'<p class="ifixit-attribution">Source: '
            f'<a href="{_html.escape(url)}" target="_blank" rel="noopener noreferrer">'
            f'{title} on iFixit</a> (CC BY-NC-SA)</p>'
        )

    return "\n".join(parts)


def steps_as_plaintext(guide: dict, max_steps: int = 4) -> list[str]:
    """Distill steps to plain-text bullets for the model to narrate from.

    Keeps the model's view of the tool response small; the full HTML still
    goes back too but the model can reason from these short summaries.
    """
    out: list[str] = []
    for step in (guide.get("steps") or [])[:max_steps]:
        chunks = []
        for line in step.get("lines") or []:
            txt = line.get("text_raw") or ""
            if txt:
                chunks.append(txt)
        if chunks:
            out.append(" ".join(chunks))
    return out
