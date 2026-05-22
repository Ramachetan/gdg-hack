"""Otto's function tools — invoked by the live agent during conversation.

Status of each tool:
- find_nearest_shop / book_appointment: mocked for the demo (hardcoded JSON).
- consult_owners_manual: real keyword index, but returns "no manual loaded" until
  the user drops F-150 manual files into manual_raw/ and we run the normalizer.
- annotate_frame: stubbed — needs main.py to stash the latest frame in session
  state before this can do anything real. Tracked separately.
"""

from __future__ import annotations

import io
import logging
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from . import frame_cache, ifixit_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# find_repair_guide  (powered by iFixit's public API)
# ---------------------------------------------------------------------------

def find_repair_guide(query: str, car_hint: str | None = None) -> dict[str, Any]:
    """Pull the best-matching repair guide from iFixit's public library.

    Use this for any procedural advice — replacing a battery, checking oil,
    diagnosing a warning light. Pair the query with what you can see in the
    camera. iFixit's guides cover most makes and models with step-by-step
    photos and instructions you can show the user inline.

    Args:
        query: The repair or procedure to look up. Be specific: "battery
            replacement", "oil dipstick", "engine air filter", "brake fluid".
        car_hint: Optional vehicle context to narrow results. Examples:
            "2018 Ford F-150", "Honda Civic", "Toyota Camry". If the user
            hasn't told you the model, omit this.

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
    search_query = f"{car_hint} {query}".strip() if car_hint else query.strip()
    logger.info("find_repair_guide: query=%r car_hint=%r → %r", query, car_hint, search_query)

    guide = ifixit_client.find_best_guide(search_query)
    if guide is None and car_hint:
        # Fallback: drop the car hint and try the raw query
        guide = ifixit_client.find_best_guide(query.strip())
    if guide is None:
        return {
            "status": "no_results",
            "message": (
                f"iFixit had no repair guide for '{search_query}'. Try a simpler query, "
                "or describe what you see in the camera without citing a guide."
            ),
        }

    return {
        "status": "ok",
        "title": guide.get("title"),
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
# find_nearest_shop  (mocked for demo)
# ---------------------------------------------------------------------------

_MOCK_SHOPS = [
    {
        "shop_id": "joes-garage",
        "name": "Joe's Garage",
        "distance_miles": 0.6,
        "eta_minutes": 8,
        "rating": 4.7,
        "hours": "open until 7 PM today",
        "specialties": ["batteries", "electrical", "general repair"],
    },
    {
        "shop_id": "midtown-auto",
        "name": "Midtown Auto Service",
        "distance_miles": 1.4,
        "eta_minutes": 15,
        "rating": 4.5,
        "hours": "open until 6 PM today",
        "specialties": ["brakes", "alignment", "general repair"],
    },
]


def find_nearest_shop(symptom: str) -> dict[str, Any]:
    """Find the nearest open mechanic for the described problem.

    Args:
        symptom: what the user is dealing with, e.g. "won't start", "warning
            light on", "weird grinding noise".

    Returns:
        dict with the top shop and a short list of alternates.
    """
    logger.info("find_nearest_shop called: symptom=%r", symptom)
    return {
        "status": "ok",
        "top_pick": _MOCK_SHOPS[0],
        "alternates": _MOCK_SHOPS[1:],
        "user_consent_required": True,
    }


# ---------------------------------------------------------------------------
# book_appointment  (mocked for demo)
# ---------------------------------------------------------------------------

def book_appointment(shop_id: str, time: str) -> dict[str, Any]:
    """Book an appointment at a shop returned by ``find_nearest_shop``.

    Only call this after the user has explicitly confirmed they want to book.

    Args:
        shop_id: id from a previous ``find_nearest_shop`` result.
        time: requested time, e.g. "11:30 AM today", "as soon as possible".

    Returns:
        dict with the booking confirmation.
    """
    shop = next((s for s in _MOCK_SHOPS if s["shop_id"] == shop_id), None)
    if shop is None:
        return {"status": "not_found", "message": f"No shop with id {shop_id}."}

    logger.info("book_appointment booked: shop=%s time=%s", shop_id, time)
    return {
        "status": "booked",
        "confirmation_number": "OTTO-7184",
        "shop_name": shop["name"],
        "time": time,
        "eta_minutes": shop["eta_minutes"],
        "message": f"Confirmed at {shop['name']} for {time}. They're {shop['eta_minutes']} minutes away.",
    }
