FROM python:3.12-slim

# Install system dependencies for OpenCV and Tesseract
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-spa \
    tesseract-ocr-eng \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ .

ENV REDIS_URL=redis://redis:6379
ENV API_BASE=http://backend:4000
ENV POLL_INTERVAL=5
# Debe coincidir con WORKER_SECRET del backend. Sobreescribir en produccion.
ENV WORKER_SECRET=dev-worker-secret-change-me

CMD ["python", "worker.py"]
