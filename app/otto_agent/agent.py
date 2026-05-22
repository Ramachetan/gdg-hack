"""Otto Roadside — Ford F-150 live multimodal car-repair co-pilot."""

import os

from google.adk.agents import Agent

from .prompt import OTTO_INSTRUCTION
from .tools import (
    annotate_frame,
    book_appointment,
    find_nearest_shop,
    find_repair_guide,
)

# Default model: Vertex AI native-audio Live API.
# Override with DEMO_AGENT_MODEL env var if running against AI Studio
# (then use gemini-2.5-flash-native-audio-preview-12-2025).
_DEFAULT_MODEL = "gemini-live-2.5-flash-native-audio"

agent = Agent(
    name="otto",
    model=os.getenv("DEMO_AGENT_MODEL", _DEFAULT_MODEL),
    instruction=OTTO_INSTRUCTION,
    tools=[
        find_repair_guide,
        annotate_frame,
        find_nearest_shop,
        book_appointment,
    ],
)
