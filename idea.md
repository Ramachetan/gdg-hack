# Otto — AI Co-Pilot for Fleets

> "Otto rides shotgun with every driver and briefs every fleet manager — so 1,000 hours of dashcam footage finally become 1 minute of insight."

**Event:** Build With AI Hackathon (GDG NYC) · **Duration:** 1 day

## Problem
Fleets capture massive volumes of dashcam video that no human ever reviews. Safety events surface too late, coaching is generic, and drivers get no real-time support. Tools like Samsara and Motive watch and report — none talk, intervene, or brief conversationally.

## Solution
A multimodal AI co-pilot with two faces:
- **In-cab voice agent** — calm, real-time help for drivers
- **Fleet intelligence layer** — turns raw footage into interleaved visual briefings for managers

## Demo Flow
1. Manager opens Otto's web app, taps mic
2. Says: *"Otto, brief me on the Dallas route today."*
3. Otto streams back in one fluid response:
   - Text summary of the day
   - Auto-generated annotated still from a near-miss
   - Generated route risk illustration
   - Spoken narration over the visuals
   - Coaching card for tomorrow's huddle

## Hackathon Scope (1 Day)
Single-page web app where a fleet manager speaks to Otto and receives a streaming, interleaved multimodal briefing about 3 pre-loaded dashcam clips. The in-cab driver experience is shown as a pre-recorded segment in the demo video.

**In scope:** voice I/O, Gemini interleaved text+image streaming, Firestore-cached clip analyses, Cloud Run deploy, 90s demo video.

**Out of scope:** live dashcam ingestion, multi-agent ADK orchestration, auth, mobile app, real-time video analysis.

## Architecture
```
Browser (Next.js, Web Speech API)
        │ SSE stream
        ▼
Cloud Run: Otto-Fleet API (Python, google-genai SDK)
        │
        ├── Firestore  (cached clip analyses)
        ├── Cloud Storage  (clips + generated assets)
        └── Gemini 2.5  (interleaved text + image)
```

## Tech Compliance
| Requirement | Implementation |
|---|---|
| Gemini interleaved/mixed output | `response_modalities: [TEXT, IMAGE]` streaming |
| Hosted on Google Cloud | Cloud Run (frontend + backend) |
| Google GenAI SDK | `google-genai` Python SDK |

## Timeline
| Hours | Milestone |
|---|---|
| 0–1 | GCP setup, trim 3 clips, upload to GCS |
| 1–3 | Pre-process clips with Gemini, cache to Firestore |
| 3–6 | Streaming interleaved briefing endpoint |
| 6–8 | Next.js frontend, voice I/O, deploy to Cloud Run |
| 8–9 | Record + edit 90s demo video |
| 9–10 | README, GitHub push, submit |

## Deliverables
- Public Cloud Run URL
- GitHub repo with README + architecture diagram
- 90-second demo video
- Submission form completed

---
*One Otto. Two views. Riding shotgun for every fleet.*
