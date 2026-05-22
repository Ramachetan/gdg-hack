# --- Stage 1: build the React UI ----------------------------------------------
FROM node:20-slim AS ui-build
WORKDIR /ui
COPY app/ui/package.json app/ui/package-lock.json ./
# `npm install` (not `npm ci`) tolerates lockfile platform skew — the lock is
# generated on the dev host (often Windows) and omits Linux-only optional
# deps that `npm ci` strictly demands.
RUN npm install --no-audit --no-fund
COPY app/ui ./
RUN npm run build

# --- Stage 2: Python runtime --------------------------------------------------
FROM python:3.11-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /workspace

COPY pyproject.toml uv.lock ./
COPY app ./app

# Vite is configured to emit to `../static/dist` relative to the ui/ dir,
# which in the build stage resolves to /static/dist. Replace any local copy.
RUN rm -rf /workspace/app/static/dist
COPY --from=ui-build /static/dist /workspace/app/static/dist

RUN uv sync --frozen --no-dev

WORKDIR /workspace/app

CMD ["sh", "-c", "uv run --project .. uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
