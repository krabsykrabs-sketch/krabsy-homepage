FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY main.py storage.py dashboard.py ./

# Persistent volume mount-point for the JSONL log + GeoIP DB.
# Coolify should be configured to mount a named volume here.
VOLUME ["/data"]

EXPOSE 8000

# --proxy-headers + --forwarded-allow-ips * are required so the in-memory
# rate limiter and geoip lookup see the real client IP, not the Traefik
# container IP. Coolify's default ingress sets X-Forwarded-For.
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*"]
