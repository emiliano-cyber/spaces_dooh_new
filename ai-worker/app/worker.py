"""
SPACE EYE — BullMQ Consumer (Python)
Polls Redis for verification jobs and processes them.
"""
import json
import time
import os
import sys
import requests
import redis
from dotenv import load_dotenv
from verifier import Verifier
from evidence_builder import EvidenceBuilder

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379")
API_BASE = os.getenv("API_BASE", "http://127.0.0.1:4000").rstrip("/")
WORKER_SECRET = os.getenv("WORKER_SECRET", "dev-worker-secret-change-me")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))

r = redis.from_url(REDIS_URL)
evidence_builder = EvidenceBuilder()

# Headers para autenticarse contra los endpoints /api/internal/* del backend.
INTERNAL_HEADERS = {"X-Worker-Secret": WORKER_SECRET}


def get_next_job():
    """Poll BullMQ queue for next job."""
    # BullMQ stores jobs in Redis with specific key patterns
    job_id = r.rpoplpush("bull:verification:wait", "bull:verification:active")
    if not job_id:
        return None

    job_data = r.hgetall(f"bull:verification:{job_id.decode()}")
    if not job_data:
        return None

    return {
        "id": job_id.decode(),
        "data": json.loads(job_data.get(b"data", b"{}")),
    }


def complete_job(job_id, result):
    """Mark job as completed in BullMQ."""
    r.hset(f"bull:verification:{job_id}", "returnvalue", json.dumps(result))
    r.lrem("bull:verification:active", 1, job_id)
    r.rpush("bull:verification:completed", job_id)


def fail_job(job_id, error):
    """Mark job as failed in BullMQ."""
    r.hset(f"bull:verification:{job_id}", "failedReason", str(error))
    r.lrem("bull:verification:active", 1, job_id)
    r.rpush("bull:verification:failed", job_id)


def fetch_bytes(url):
    """Download the bytes of a photo/creative served by the backend."""
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    return resp.content


def post_result(photo_id, result, pdf_bytes=None):
    """Submit the verification result (multipart) back to the backend.

    `result` viaja como campo de formulario (parte multipart sin filename) para
    que multer.fields lo entregue en req.body; el PDF, si existe, como archivo.
    """
    files = {"result": (None, json.dumps(result))}
    if pdf_bytes:
        files["evidence"] = ("evidence.pdf", pdf_bytes, "application/pdf")

    resp = requests.post(
        f"{API_BASE}/api/internal/verification/{photo_id}/result",
        headers=INTERNAL_HEADERS,
        files=files,
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()


def process_job(job):
    """Process a single verification job end-to-end."""
    photo_id = job["data"]["photo_id"]
    print(f"[Worker] Processing photo_id={photo_id}")

    try:
        # 1. Fetch job context (marks the photo as 'running' backend-side).
        ctx_resp = requests.get(
            f"{API_BASE}/api/internal/verification/{photo_id}/context",
            headers=INTERNAL_HEADERS,
            timeout=30,
        )
        if ctx_resp.status_code == 422:
            # La campana no tiene creatividad de referencia: nada que comparar.
            print(f"[Worker] photo {photo_id}: campaign missing creative, skipping")
            post_result(photo_id, {
                "is_correct": False, "confidence": 0.0,
                "error": "campaign_missing_creative",
            })
            return {"photo_id": photo_id, "status": "skipped"}
        ctx_resp.raise_for_status()
        ctx = ctx_resp.json()

        # 2. Download field photo + expected creative.
        field_bytes = fetch_bytes(ctx["photo_url"])
        creative_bytes = fetch_bytes(ctx["creative_url"])

        # 3. Run the 3-layer verifier with the campaign thresholds.
        verifier = Verifier(
            min_ssim=ctx["min_ssim_score"],
            max_phash_distance=ctx["max_phash_distance"],
        )
        result = verifier.verify(
            field_bytes, creative_bytes, expected_text=ctx.get("expected_text")
        )

        # 4. Build the evidence PDF (best-effort; no debe tumbar el job).
        pdf_bytes = None
        try:
            pdf_bytes = evidence_builder.build(
                result, field_bytes, creative_bytes,
                device_name=ctx.get("device_name") or f"Device {photo_id}",
                campaign_name=ctx.get("campaign_name") or "",
            )
        except Exception as e:
            print(f"[Worker] evidence build failed for {photo_id}: {e}")

        # 5. Submit results back to the backend (verifications + photo status).
        post_result(photo_id, result, pdf_bytes)

        verdict = "CORRECT" if result.get("is_correct") else "INCORRECT"
        print(f"[Worker] photo {photo_id}: {verdict} (confidence={result.get('confidence')})")
        return {
            "photo_id": photo_id,
            "status": "verified",
            "is_correct": result.get("is_correct"),
        }

    except Exception as e:
        # Report the failure so the photo leaves the 'running' state.
        print(f"[Worker] photo {photo_id} processing error: {e}")
        try:
            post_result(photo_id, {
                "is_correct": False, "confidence": 0.0, "error": str(e)[:400],
            })
        except Exception as e2:
            print(f"[Worker] could not report failure for {photo_id}: {e2}")
        raise


def main():
    print(f"[Worker] Starting verification worker")
    print(f"[Worker] Redis: {REDIS_URL}")
    print(f"[Worker] Poll interval: {POLL_INTERVAL}s")

    while True:
        try:
            job = get_next_job()
            if job:
                try:
                    result = process_job(job)
                    complete_job(job["id"], result)
                    print(f"[Worker] Job {job['id']} completed")
                except Exception as e:
                    print(f"[Worker] Job {job['id']} failed: {e}")
                    fail_job(job["id"], str(e))
            else:
                time.sleep(POLL_INTERVAL)
        except redis.ConnectionError:
            print("[Worker] Redis connection lost, retrying in 10s...")
            time.sleep(10)
        except KeyboardInterrupt:
            print("[Worker] Shutting down")
            sys.exit(0)
        except Exception as e:
            print(f"[Worker] Unexpected error: {e}")
            time.sleep(5)


if __name__ == "__main__":
    main()
