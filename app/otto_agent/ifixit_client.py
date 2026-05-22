"""Thin client for the iFixit public API — used by the find_repair_guide tool.

Endpoints we use:
    GET /api/2.0/suggest/{q}?doctypes=device   → fuzzy-resolve a model string
                                                  to a canonical device wiki
    GET /api/2.0/wikis/CATEGORY/{title}        → device page incl. its guides[]
    GET /api/2.0/search/{q}?filter=guide       → site-wide fallback search
    GET /api/2.0/guides/{guideid}              → full guide with steps + media

Relevance strategy: when the agent passes a device_hint, we resolve it to a
canonical device wiki first and pick from that wiki's own guides list. That
gives us model-specific results instead of whatever iFixit ranks first globally
(which is otherwise dominated by popular phones/laptops regardless of query).

No auth, no rate-limit headaches at hackathon scale. Content is CC BY-NC-SA;
the rendered HTML includes a backlink to the iFixit source.
"""

from __future__ import annotations

import html as _html
import logging
import re
import urllib.parse
from typing import Any

import requests

logger = logging.getLogger(__name__)

_BASE = "https://www.ifixit.com/api/2.0"
_TIMEOUT = 8.0
_USER_AGENT = "Otto-FixAnything-Hackathon/0.1 (+adk-bidi-demo)"

_STOPWORDS = {
    "a", "an", "the", "to", "of", "for", "in", "on", "and", "or", "my", "your",
    "how", "do", "i", "is", "it", "this", "that", "with", "what", "guide",
}

# Verb stems we expand for matching (so "replace the battery" can also score
# guides titled "Battery Replacement").
_INTENT_STEMS = {
    "replace": "replacement",
    "replacing": "replacement",
    "repair": "repair",
    "repairing": "repair",
    "fix": "repair",
    "fixing": "repair",
    "remove": "removal",
    "removing": "removal",
    "swap": "replacement",
    "change": "replacement",
    "install": "installation",
    "installing": "installation",
}


def _get(path: str, params: dict[str, Any] | None = None) -> Any:
    url = f"{_BASE}/{path}"
    r = requests.get(url, params=params or {}, timeout=_TIMEOUT, headers={"User-Agent": _USER_AGENT})
    r.raise_for_status()
    return r.json()


def _tokens(s: str, expand_intent: bool = False) -> set[str]:
    raw = {t for t in re.findall(r"[a-z0-9]+", (s or "").lower()) if t and t not in _STOPWORDS}
    if expand_intent:
        # Add canonical stems so query verbs match guide noun forms in titles.
        raw |= {_INTENT_STEMS[t] for t in list(raw) if t in _INTENT_STEMS}
    return raw


def search_guides(query: str, limit: int = 5) -> list[dict]:
    """Return up to ``limit`` guide hits for ``query`` (relevance-sorted)."""
    quoted = urllib.parse.quote(query, safe="")
    data = _get(f"search/{quoted}", {"limit": limit, "filter": "guide"})
    return data.get("results") or []


def suggest_devices(query: str, limit: int = 5) -> list[dict]:
    """Resolve a fuzzy model string to canonical device wikis."""
    quoted = urllib.parse.quote(query, safe="")
    data = _get(f"suggest/{quoted}", {"doctypes": "device", "limit": limit})
    return data.get("results") or []


def get_device_wiki(title: str) -> dict | None:
    """Fetch a device wiki (CATEGORY namespace). Includes its own guides[]."""
    quoted = urllib.parse.quote(title, safe="")
    try:
        return _get(f"wikis/CATEGORY/{quoted}")
    except requests.RequestException as exc:
        logger.warning("iFixit device wiki fetch failed for %r: %s", title, exc)
        return None


def get_guide(guide_id: int) -> dict:
    """Fetch a single guide's full content (steps, media, attribution)."""
    return _get(f"guides/{guide_id}")


def _pick_best_match(candidates: list[dict], query: str) -> dict | None:
    """Choose the candidate whose title best matches the query (token overlap).

    Returns None if no candidate has any non-stopword overlap with the query —
    that signals "this device has guides, but none look related to what you
    asked," and the caller should fall through rather than returning a random
    guide for that device.
    """
    q_tokens = _tokens(query, expand_intent=True)
    if not q_tokens or not candidates:
        return None
    scored = []
    for c in candidates:
        title = c.get("title") or ""
        subject = c.get("subject") or ""
        t_tokens = _tokens(title) | _tokens(subject)
        overlap = len(q_tokens & t_tokens)
        if overlap == 0:
            continue
        # Tiebreaker: prefer "replacement" type when the query asked to replace.
        type_bonus = 0
        gtype = (c.get("type") or "").lower()
        if gtype == "replacement" and "replacement" in q_tokens:
            type_bonus = 1
        # Tiebreaker: shorter titles tend to be more specific top-level guides
        # (e.g. "Battery Replacement" vs "Battery Connector Bracket Removal").
        specificity = -len(t_tokens)
        scored.append(((overlap, type_bonus, specificity), c))
    if not scored:
        return None
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return scored[0][1]


def find_best_guide(query: str, device_hint: str | None = None) -> dict | None:
    """Find the best guide for ``query``, optionally scoped to ``device_hint``.

    Strategy:
      1. If ``device_hint`` is given, resolve it via /suggest?doctypes=device,
         fetch that device's wiki, and pick the best-matching guide from its
         own guides[]. This is dramatically more accurate than free-text search
         because it sidesteps iFixit's global popularity ranking.
      2. Otherwise (or if step 1 finds no match), fall back to the site-wide
         search endpoint and take the top hit.

    Returns the full guide dict (with steps + media) or None.
    """
    # --- Device-scoped path -------------------------------------------------
    if device_hint:
        try:
            devices = suggest_devices(device_hint, limit=3)
        except requests.RequestException as exc:
            logger.warning("iFixit device suggest failed for %r: %s", device_hint, exc)
            devices = []
        for d in devices:
            title = d.get("title")
            if not title:
                continue
            wiki = get_device_wiki(title)
            if not wiki:
                continue
            guides = wiki.get("guides") or []
            best = _pick_best_match(guides, query)
            if best and best.get("guideid"):
                logger.info(
                    "find_best_guide: device path hit — device=%r guide=%r",
                    title, best.get("title"),
                )
                try:
                    return get_guide(int(best["guideid"]))
                except requests.RequestException as exc:
                    logger.warning("iFixit guide fetch failed for %s: %s", best["guideid"], exc)
                    continue

    # --- Fallback: global search -------------------------------------------
    search_query = f"{device_hint} {query}".strip() if device_hint else query.strip()
    try:
        hits = search_guides(search_query, limit=5)
    except requests.RequestException as exc:
        logger.warning("iFixit search failed: %s", exc)
        return None
    if not hits:
        return None
    guide_id = hits[0].get("guideid")
    if not guide_id:
        return None
    logger.info("find_best_guide: fallback search hit — guide=%r", hits[0].get("title"))
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
