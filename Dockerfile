# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# Pin and compile a patched SQLite for WAL reliability on both amd64 and arm64.
FROM python:3.14-slim-bookworm AS sqlite
RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /build
RUN curl --fail --location --retry 3 https://www.sqlite.org/2026/sqlite-autoconf-3510300.tar.gz -o sqlite.tar.gz \
    && tar xzf sqlite.tar.gz --strip-components=1 \
    && ./configure --prefix=/opt/sqlite --disable-static \
    && make -j2 && make install

FROM python:3.14-slim-bookworm AS app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 MASHINA_DATA=/app/data MASHINA_PRODUCTION=1 LD_LIBRARY_PATH=/opt/sqlite/lib
COPY --from=sqlite /opt/sqlite/lib/ /opt/sqlite/lib/
COPY --from=ghcr.io/astral-sh/uv:0.9.4 /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
ARG MASHINA_RECOGNITION=0
RUN if [ "$MASHINA_RECOGNITION" = "1" ]; then \
      uv sync --frozen --no-dev --extra recognition --no-cache; \
    else uv sync --frozen --no-dev --no-cache; fi
COPY backend/ ./backend/
COPY --from=frontend /build/dist/ ./frontend/dist/
RUN groupadd --gid 10001 mashina && useradd --uid 10001 --gid 10001 --no-create-home mashina \
    && mkdir -p /app/data && chown -R 10001:10001 /app/data \
    && /app/.venv/bin/python -c "import sqlite3; assert sqlite3.sqlite_version_info >= (3,51,3), sqlite3.sqlite_version"
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["/app/.venv/bin/python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health',timeout=3)"]
CMD ["/app/.venv/bin/uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-proxy-headers"]
