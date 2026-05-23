# Otto — Live Repair Co-Pilot

> Point your phone at anything broken. Otto sees what you see, hears what you say, and walks you through the fix in real time.

**Build With AI Hackathon submission — Category: Live Agents (Real-time Interaction, Audio + Vision).**

---

## The Problem

Something is broken — your phone won't charge, your laptop fan is screaming, your dishwasher is throwing an error code, your car won't start. Every existing answer is the wrong shape:

- **YouTube** is generic and doesn't know your specific device.
- **ChatGPT** can't see what you're pointing at.
- **A repair shop** is expensive and slow.

There's no tool that looks at the actual thing you're holding, hears your actual question, and walks you through the fix live.

## What Otto Does

Otto is a calm, look-over-your-shoulder repair co-pilot:

- **Sees** your camera feed continuously and identifies what device you're working on.
- **Hears** you talk naturally — can be interrupted, asks clarifying questions, never repeats itself.
- **Grounds** every procedural claim in iFixit's library of millions of step-by-step repair guides spanning phones, laptops, tablets, consoles, appliances, cars, bikes, and more.
- **Points** at the exact screw, port, terminal, or cable on *your own camera frame* using Gemini 2.5's spatial grounding — not vague verbal directions.
- **Warns** you before you touch anything risky (exposed battery terminals, capacitors, hot surfaces, mains AC) and tells you to stop and find a pro when a fix is genuinely out of scope.

## How It Hits the Judging Criteria

### Innovation & Multimodal UX (40%)
- No text box. Conversation is voice-first, vision-grounded, and continuously streaming — Otto sees and hears at the same time you do.
- When the user needs to look at a specific part, Otto draws a labeled dot on their **actual live camera frame** (via the `point_at_parts` tool) rather than describing a location in words.
- Native-audio model means barge-in / interruption works naturally and the agent's tone adapts to the user.

### Technical Implementation (30%)
- Built on **Google ADK** (`google.adk.agents.Agent`, `Runner`, `LiveRequestQueue`) and **Gemini Live API** (`gemini-live-2.5-flash-native-audio`).
- Spatial grounding uses **Gemini 2.5 Flash** in a separate one-shot vision call (the cookbook-recommended approach for precise pointing).
- Sliding-window context compression (100k → 80k tokens) lifts the Live API's session cap so a single repair session can run as long as it needs.
- Tools run on a worker pool (`ToolThreadPoolConfig`) so iFixit lookups and PIL image annotation don't block the audio stream.
- All factual claims are grounded — every procedural answer traces to an iFixit guide, every part callout traces to the live camera frame. No hallucinated damage, no invented parts.

### Demo & Presentation (30%)
- Real working software, deployed to Cloud Run, with an architecture diagram and a video showing the end-to-end flow against an actual broken device.

## Architecture

```
 ┌──────────────────┐   audio + frames (WebSocket)   ┌─────────────────────────┐
 │   React UI       │ ─────────────────────────────▶ │  FastAPI (app/main.py)  │
 │   (Vite, mic,    │ ◀───────────────────────────── │  - WebSocket bridge     │
 │    camera, orb)  │   audio + transcripts + tool   │  - Annotation cache     │
 └──────────────────┘   results (WebSocket)          └───────────┬─────────────┘
                                                                 │
                                                       ADK Runner + LiveRequestQueue
                                                                 │
                                                                 ▼
                                                  ┌──────────────────────────┐
                                                  │  Otto Agent (ADK)        │
                                                  │  - Gemini Live (audio)   │
                                                  │  - find_repair_guide ──► iFixit public API
                                                  │  - point_at_parts ─────► Gemini 2.5 Flash (vision)
                                                  │  - annotate_frame ─────► PIL overlay on live frame
                                                  └──────────────────────────┘
```

**Hosted on Google Cloud Run** (see `deploy.sh`). Uses **Vertex AI** for the Live API (`GOOGLE_GENAI_USE_VERTEXAI=TRUE`).

## Tech Stack

| Layer        | Tech |
|--------------|------|
| Agent        | Google **ADK** (`google-adk>=1.32`) |
| LLM (audio)  | Gemini Live — `gemini-live-2.5-flash-native-audio` |
| LLM (vision) | Gemini 2.5 Flash (spatial pointing) |
| Backend      | FastAPI + WebSockets, Python 3.11, `uv` |
| Frontend     | React 19 + Vite + Tailwind v4, native WebAudio worklets for PCM capture/playback |
| Grounding    | iFixit public API |
| Hosting      | Google Cloud Run (session affinity, WebSocket, 60-min timeout) |

## Repository Layout

```
gdg-hack/
├── app/
│   ├── main.py                 FastAPI + WebSocket bridge to ADK Runner
│   ├── otto_agent/
│   │   ├── agent.py            ADK Agent definition (model + tools)
│   │   ├── prompt.py           Otto's system instruction (grounding rules, safety)
│   │   ├── tools.py            find_repair_guide, annotate_frame, point_at_parts
│   │   ├── ifixit_client.py    iFixit API client + guide renderer
│   │   └── frame_cache.py      Latest-frame cache + annotation store
│   ├── static/                 Audio worklet processors + Vite build output
│   └── ui/                     React frontend (camera, mic, orb, guide panel)
├── Dockerfile                  Two-stage build (Vite UI → Python runtime)
├── deploy.sh                   One-shot Cloud Run deploy
├── pyproject.toml              Python deps (managed by uv)
└── idea.md                     Original pitch
```

## Running Locally

**Prerequisites:** Python 3.10+, [uv](https://docs.astral.sh/uv/), Node 20+, a Google Cloud project with the Vertex AI API enabled (or a Gemini API key).

1. **Configure environment** — copy the existing `app/.env` or create one:
   ```env
   GOOGLE_GENAI_USE_VERTEXAI=TRUE
   GOOGLE_CLOUD_PROJECT=your-project-id
   GOOGLE_CLOUD_LOCATION=us-central1
   DEMO_AGENT_MODEL=gemini-live-2.5-flash-native-audio
   ```
   For local dev against Vertex, also run `gcloud auth application-default login`.

2. **Build the React UI:**
   ```bash
   cd app/ui
   npm install
   npm run build      # emits to ../static/dist
   ```

3. **Run the server:**
   ```bash
   cd ../..
   uv sync
   uv run uvicorn app.main:app --reload --port 8080
   ```

4. Open `http://localhost:8080`, grant camera + microphone permissions, and start talking to Otto.

## Deploying to Cloud Run

```bash
PROJECT_ID=your-project-id ./deploy.sh
```

The script enables required APIs, builds via Cloud Build, and rolls out a Cloud Run revision tuned for long-lived WebSocket sessions (session affinity, 60-min timeout, min-instances=1 to avoid cold-start on the first call).

## Team

- **Project name:** Otto
- **Members & contributors:**
  - Rama Chetan Atmudi
  - Ajay Kumar Gogineni
  - Krishna Teja Reddy
  - Kushal Kongara

## Links

- iFixit public API — https://www.ifixit.com/api/2.0/doc
- Google ADK docs — https://google.github.io/adk-docs/
- Gemini Live API — https://ai.google.dev/gemini-api/docs/live
- Hackathon portal — https://goo.gle/CHM-hack-26
