"""Otto's function tools — invoked by the live agent during conversation.

- find_repair_guide: hits iFixit's public API for step-by-step repair guides.
- annotate_frame: draws a labelled box on the latest frame in frame_cache.
- point_at_parts: asks Gemini 2.5 to detect parts on the latest frame and
  returns bounding boxes the UI overlays over the live camera.
"""

from __future__ import annotations

import io
import json
import logging
import os
from typing import Any

from google import genai
from google.genai import types as genai_types
from PIL import Image, ImageDraw, ImageFont

from . import frame_cache, ifixit_client

logger = logging.getLogger(__name__)

# Model used for one-shot vision calls (pointing/segmentation). Separate from
# the Live model — only 2.5+ supports spatial grounding well.
_POINTING_MODEL = os.getenv("OTTO_POINTING_MODEL", "gemini-2.5-flash")

_genai_client: genai.Client | None = None


def _get_genai_client() -> genai.Client:
    """Lazily build the genai client so import order doesn't matter for env vars."""
    global _genai_client
    if _genai_client is None:
        _genai_client = genai.Client()
    return _genai_client


# ---------------------------------------------------------------------------
# find_repair_guide  (powered by iFixit's public API)
# ---------------------------------------------------------------------------

def find_repair_guide(query: str, device_hint: str | None = None) -> dict[str, Any]:
    """Pull the best-matching repair guide from iFixit's public library.

    Use this for any procedural advice — replacing a screen, opening a case,
    swapping a battery, diagnosing an indicator light, fixing a stuck button.
    Pair the query with what you can see in the camera. iFixit's library spans
    phones, laptops, tablets, game consoles, appliances, cars, bikes, and more,
    with step-by-step photos you can show the user inline.

    Args:
        query: The repair or procedure to look up. Be specific: "screen
            replacement", "battery replacement", "open back cover", "fan
            cleaning", "engine air filter".
        device_hint: Optional device context to narrow results. Examples:
            "iPhone 13", "MacBook Pro 2021", "PS5 Slim", "2018 Ford F-150",
            "Dyson V8". If the user hasn't told you the model, omit this.

    Returns:
        dict with keys:
            status: "ok" | "no_results" | "error"
            title: full guide title (when ok)
            url: link back to iFixit for full content (when ok)
            difficulty: "Easy"/"Moderate"/etc (when ok, if known)
            time_required: human time estimate (when ok, if known)
            summary: short text summary the agent can paraphrase
            steps_text: list of short plaintext step summaries to narrate from
            html: rendered HTML for the visual-guide panel (frontend renders)
            message: explanation when status != "ok"
    """
    logger.info("find_repair_guide: query=%r device_hint=%r", query, device_hint)

    # Device-scoped lookup (much more accurate) when the agent provides a hint;
    # the client falls back to site-wide search internally if nothing matches.
    guide = ifixit_client.find_best_guide(query.strip(), device_hint=device_hint)
    if guide is None:
        return {
            "status": "no_results",
            "message": (
                f"iFixit had no repair guide for '{query}'"
                f"{f' on {device_hint}' if device_hint else ''}. Try a simpler "
                "query, or describe what you see in the camera without citing a guide."
            ),
        }

    # iFixit guides under a device wiki are often titled bare ("Screen Removal")
    # because the parent device implies the context. Prepend the category so the
    # title is unambiguous in the chat bubble — "iPhone 13 — Screen Removal".
    raw_title = (guide.get("title") or "").strip()
    category = (guide.get("category") or "").strip()
    if raw_title and category and category.lower() not in raw_title.lower():
        display_title = f"{category} — {raw_title}"
    else:
        display_title = raw_title or "Repair guide"

    return {
        "status": "ok",
        "title": display_title,
        "matched_device": category or None,
        "url": guide.get("url"),
        "difficulty": guide.get("difficulty"),
        "time_required": guide.get("time_required"),
        "summary": guide.get("summary"),
        "steps_text": ifixit_client.steps_as_plaintext(guide, max_steps=4),
        "html": ifixit_client.render_guide_html(guide, max_steps=4),
    }


# ---------------------------------------------------------------------------
# annotate_frame
# ---------------------------------------------------------------------------

def annotate_frame(
    focus_part: str,
    instruction: str,
    box: list[float],
) -> dict[str, Any]:
    """Draw a labelled box over the user's most recent camera frame.

    Use whenever the user needs to LOOK at a specific part. Don't describe a
    location in words — show them on their own frame. You are vision-capable;
    look at the most recent frame yourself to determine where the part is.

    Args:
        focus_part: short name of the thing being highlighted, e.g. "negative
            battery terminal", "oil dipstick", "coolant reservoir cap".
        instruction: short label drawn on the annotation, e.g. "this one",
            "loosen this clamp first". Keep under ~30 characters.
        box: bounding box of the part in the frame, as
            [x1, y1, x2, y2] where each value is a fraction in [0, 1] of the
            image width/height. (0,0) is top-left, (1,1) is bottom-right.

    Returns:
        dict with status. On success includes ``annotated_image_url`` — the
        frontend will render this inline in the visual-guide panel.
    """
    logger.info(
        "annotate_frame: focus_part=%r instruction=%r box=%r",
        focus_part,
        instruction,
        box,
    )

    frame_bytes = frame_cache.get_latest_frame()
    if frame_bytes is None:
        return {
            "status": "no_frame",
            "message": (
                "I don't have a camera frame to annotate yet. Tell the user to "
                "turn on the camera (Look mode) and try again."
            ),
        }

    if len(box) != 4 or not all(0.0 <= v <= 1.0 for v in box):
        return {
            "status": "bad_box",
            "message": "box must be [x1, y1, x2, y2] with each value between 0 and 1.",
        }

    # Reject whole-frame "highlights" — the agent sometimes calls annotate_frame
    # with a box covering ~the entire image to "show what it sees", which just
    # pops a full-screen still image at the user without actually pointing at
    # anything specific. Pointing at a whole device is a no-op for the user.
    x1, y1, x2, y2 = box
    area_frac = max(0.0, (x2 - x1)) * max(0.0, (y2 - y1))
    if area_frac > 0.65:
        return {
            "status": "too_broad",
            "message": (
                "The bounding box covers most of the frame, which isn't useful "
                "as a highlight. Either call `point_at_parts` to pin a specific "
                "feature, or just describe what you see in words for this turn."
            ),
        }

    try:
        img = Image.open(io.BytesIO(frame_bytes)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        logger.warning("annotate_frame: failed to decode frame: %s", exc)
        return {
            "status": "decode_error",
            "message": "Could not decode the camera frame. Ask the user to try again.",
        }

    w, h = img.size
    x1, y1, x2, y2 = box
    px1, py1, px2, py2 = int(x1 * w), int(y1 * h), int(x2 * w), int(y2 * h)
    # Snap to a minimum visible size
    if px2 - px1 < 8: px2 = min(w, px1 + 8)
    if py2 - py1 < 8: py2 = min(h, py1 + 8)

    draw = ImageDraw.Draw(img, "RGBA")

    # Highlight box: thick red rectangle + translucent fill
    fill = (255, 80, 80, 60)
    stroke = (255, 50, 50, 255)
    line_w = max(4, w // 200)
    draw.rectangle([(px1, py1), (px2, py2)], fill=fill, outline=stroke, width=line_w)

    # Label
    try:
        font_size = max(18, w // 40)
        font = ImageFont.truetype("arial.ttf", font_size)
    except OSError:
        font = ImageFont.load_default()

    label = instruction.strip()[:60]
    text_pad = 8
    text_bbox = draw.textbbox((0, 0), label, font=font)
    tw = text_bbox[2] - text_bbox[0]
    th = text_bbox[3] - text_bbox[1]
    # Place label above the box if room, else inside top
    label_x = px1
    label_y = max(0, py1 - th - 2 * text_pad)
    if label_y == 0 and py1 < th + 2 * text_pad:
        label_y = py1 + text_pad
    draw.rectangle(
        [(label_x, label_y), (label_x + tw + 2 * text_pad, label_y + th + 2 * text_pad)],
        fill=(255, 50, 50, 230),
    )
    draw.text((label_x + text_pad, label_y + text_pad), label, fill="white", font=font)

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    annotation_id = frame_cache.store_annotation(buf.getvalue())

    return {
        "status": "ok",
        "focus_part": focus_part,
        "instruction": instruction,
        "annotated_image_url": f"/annotations/{annotation_id}.png",
    }


# ---------------------------------------------------------------------------
# point_at_parts
# ---------------------------------------------------------------------------

_POINTING_PROMPT_TEMPLATE = (
    "Detect: {what}\n"
    "Return bounding boxes as a JSON array with labels. Never return masks, "
    "explanations, or code fencing. Limit to {n} items. "
    "If an object is present multiple times, name each by a unique characteristic "
    '(e.g. "top-left screw", "rightmost orange cable").\n'
    'Format each entry exactly as {{"box_2d": [ymin, xmin, ymax, xmax], "label": <label>}}, '
    "where box_2d coordinates are normalized to 0-1000 of image height (y) and width (x).\n"
    "Make each box tight to the part — just big enough to enclose it.\n"
    "If you cannot find what was asked, return an empty JSON array []."
)


def _strip_json_fence(text: str) -> str:
    """Remove ```json ... ``` fences the model sometimes adds anyway."""
    text = text.strip()
    if text.startswith("```"):
        # Drop first fence line and everything after the closing fence
        text = text.split("\n", 1)[1] if "\n" in text else ""
        text = text.split("```", 1)[0]
    return text.strip()


def point_at_parts(
    description: str,
    max_items: int = 5,
) -> dict[str, Any]:
    """Use Gemini 2.5 to detect parts in the user's latest camera frame and
    return labeled bounding boxes the UI overlays on the live feed.

    Prefer this over `annotate_frame` whenever you need PRECISE pointing — the
    individual screws holding a panel, a specific connector on a board, the
    one button the user should press. The dedicated vision model is far more
    accurate at small, cluttered targets than estimating a box yourself.

    Args:
        description: Self-contained description of what to point at, written so
            a separate vision model can find it without other context. Be
            specific. Good: "the four phillips screws on the corners of the
            back panel", "the silver SATA data connector on the motherboard",
            "the orange ribbon cable connecting the screen". Bad: "that one",
            "the thing we talked about".
        max_items: Maximum number of boxes to draw (1–10). Use 1–2 for a
            single part, more for "all the screws" cases.

    Returns:
        dict with status. On ``ok`` includes ``boxes`` — a list of
        ``{label, ymin, xmin, ymax, xmax}`` with coords normalized 0–1000 of
        image height/width, which the agent can narrate from.
    """
    # NOTE: defined as a SYNC function on purpose. ADK runs async tools by
    # spawning `asyncio.run(...)` in a worker thread for each call, which
    # creates and tears down a fresh event loop every time. `genai.Client().aio`
    # caches an httpx AsyncClient bound to the first such loop; on the next
    # call that loop is closed and every call raises
    # `RuntimeError: Event loop is closed`. The sync genai API has no event-
    # loop binding and the ADK sync-tool path dispatches us via
    # `loop.run_in_executor` (see ToolThreadPoolConfig in app/main.py), so the
    # main audio loop still keeps streaming during the call.
    logger.info("point_at_parts: description=%r max_items=%d", description, max_items)

    frame_bytes = frame_cache.get_latest_frame()
    if frame_bytes is None:
        return {
            "status": "no_frame",
            "message": (
                "I don't have a camera frame yet. Tell the user to turn on the "
                "camera (Look mode) and try again."
            ),
        }

    max_items = max(1, min(int(max_items), 10))
    prompt = _POINTING_PROMPT_TEMPLATE.format(what=description.strip(), n=max_items)

    try:
        client = _get_genai_client()
        response = client.models.generate_content(
            model=_POINTING_MODEL,
            contents=[
                genai_types.Part.from_bytes(data=frame_bytes, mime_type="image/jpeg"),
                prompt,
            ],
            config=genai_types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json",
                # Cookbook explicitly disables thinking for spatial tasks: adds
                # latency without improving results.
                thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
            ),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("point_at_parts: model call failed: %s", exc)
        return {
            "status": "model_error",
            "message": "Vision model could not respond. Ask the user to try again.",
        }

    raw = (response.text or "").strip()
    try:
        items = json.loads(_strip_json_fence(raw))
    except json.JSONDecodeError as exc:
        logger.warning("point_at_parts: bad JSON from model: %s; raw=%r", exc, raw[:300])
        return {
            "status": "no_points",
            "message": "Vision model returned no usable boxes.",
        }

    if not isinstance(items, list) or not items:
        return {
            "status": "no_points",
            "message": (
                f"Could not find {description!r} in the current frame. Ask the "
                "user to reposition the camera so the part is visible and try again."
            ),
        }

    boxes: list[dict[str, Any]] = []
    for item in items[:max_items]:
        if not isinstance(item, dict):
            continue
        raw_box = item.get("box_2d")
        if not isinstance(raw_box, list) or len(raw_box) != 4:
            continue
        try:
            ymin, xmin, ymax, xmax = (float(v) for v in raw_box)
        except (TypeError, ValueError):
            continue
        # Clamp to 0..1000 and skip degenerate/inverted boxes
        ymin = max(0.0, min(1000.0, ymin))
        xmin = max(0.0, min(1000.0, xmin))
        ymax = max(0.0, min(1000.0, ymax))
        xmax = max(0.0, min(1000.0, xmax))
        if xmax - xmin < 1.0 or ymax - ymin < 1.0:
            continue
        label = str(item.get("label", "")).strip()[:40]
        boxes.append({
            "label": label,
            "ymin": ymin,
            "xmin": xmin,
            "ymax": ymax,
            "xmax": xmax,
        })

    if not boxes:
        return {
            "status": "no_points",
            "message": (
                f"Could not find {description!r} in the current frame. Ask the "
                "user to reposition the camera so the part is visible and try again."
            ),
        }

    return {
        "status": "ok",
        "focus_part": description,
        "instruction": boxes[0]["label"] if len(boxes) == 1 else f"{len(boxes)} parts",
        "boxes": boxes,
    }
