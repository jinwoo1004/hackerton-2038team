# Build from repository root: docker build -f service/Dockerfile -t monitoring-analysis .
FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    APP_RUNTIME=deployed STORAGE_LOCATION=/data/storage PORT=8000
WORKDIR /app
COPY service/requirements.txt ./requirements.txt
RUN python -m pip install --no-cache-dir -r requirements.txt \
    && groupadd --gid 10001 monitoring && useradd --uid 10001 --gid 10001 --no-create-home monitoring \
    && mkdir -p /data/storage && chown -R 10001:10001 /app /data/storage
COPY --chown=10001:10001 service/app/ ./app/
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8000')+'/health', timeout=3).close()" || exit 1
CMD ["sh", "-c", "exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --no-access-log"]
