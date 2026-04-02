"""
HTTP client for communicating with the Olpar Next.js API.
Includes retry with exponential backoff and offline buffer fallback.
"""

import time
import logging
from typing import Optional
import requests

from config import (
    API_BASE_URL,
    SCANNER_API_KEY,
    MAX_RETRIES,
    RETRY_BACKOFF_BASE,
)

logger = logging.getLogger(__name__)

# Persistent session for connection pooling
_session = requests.Session()
_session.headers.update({
    "x-api-key": SCANNER_API_KEY,
    "Content-Type": "application/json",
})


def _request_with_retry(
    method: str,
    path: str,
    json_data: Optional[dict] = None,
    files: Optional[dict] = None,
    timeout: float = 10.0,
) -> Optional[dict]:
    """
    Make an HTTP request with retry and exponential backoff.
    Returns parsed JSON on success, None on complete failure.
    """
    url = f"{API_BASE_URL}{path}"

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            if files:
                # For file uploads, don't use the session's Content-Type
                headers = {"x-api-key": SCANNER_API_KEY}
                resp = requests.post(
                    url, headers=headers, files=files,
                    data=json_data, timeout=timeout,
                )
            else:
                resp = _session.request(
                    method, url, json=json_data, timeout=timeout,
                )

            if resp.status_code < 500:
                # 2xx, 4xx — don't retry client errors
                return resp.json()

            logger.warning(
                "Server error %d on %s (attempt %d/%d)",
                resp.status_code, path, attempt, MAX_RETRIES,
            )

        except requests.exceptions.RequestException as e:
            logger.warning(
                "Request failed for %s (attempt %d/%d): %s",
                path, attempt, MAX_RETRIES, e,
            )

        if attempt < MAX_RETRIES:
            wait = RETRY_BACKOFF_BASE * (2 ** (attempt - 1))
            logger.info("Retrying in %.1fs...", wait)
            time.sleep(wait)

    logger.error("All %d attempts failed for %s", MAX_RETRIES, path)
    return None


def post_item(
    sesion_id: str,
    codigo_barras: str,
    idempotency_key: str,
    screenshot_base64: Optional[str] = None,
) -> Optional[dict]:
    """Register a scanned item. Returns API response or None."""
    payload = {
        "sesionId": sesion_id,
        "codigoBarras": codigo_barras,
        "idempotencyKey": idempotency_key,
    }
    if screenshot_base64:
        payload["screenshotBase64"] = screenshot_base64

    return _request_with_retry("POST", "/api/scanner/item", json_data=payload)


def post_camara_offline(sesion_id: str) -> Optional[dict]:
    """Notify that the camera went offline."""
    return _request_with_retry(
        "POST", "/api/scanner/camara-offline",
        json_data={"sesionId": sesion_id},
    )


def post_video_listo(sesion_id: str, storage_path: str) -> Optional[dict]:
    """Notify that video has been uploaded."""
    return _request_with_retry(
        "POST", "/api/scanner/video-listo",
        json_data={"sesionId": sesion_id, "storagePath": storage_path},
    )


def upload_video_to_storage(
    sesion_id: str, video_path: str,
) -> Optional[str]:
    """
    Upload video to Supabase Storage and return the storage path.
    Returns None on failure.
    """
    from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, STORAGE_BUCKET

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.error("Supabase credentials not configured for video upload")
        return None

    import os
    filename = os.path.basename(video_path)
    storage_path = f"{sesion_id}/{filename}"
    url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{storage_path}"

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with open(video_path, "rb") as f:
                resp = requests.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                        "Content-Type": "video/mp4",
                    },
                    data=f,
                    timeout=120,
                )

            if resp.status_code < 300:
                logger.info("Video uploaded: %s", storage_path)
                return storage_path

            logger.warning(
                "Video upload failed %d (attempt %d/%d): %s",
                resp.status_code, attempt, MAX_RETRIES, resp.text[:200],
            )

        except Exception as e:
            logger.warning(
                "Video upload error (attempt %d/%d): %s",
                attempt, MAX_RETRIES, e,
            )

        if attempt < MAX_RETRIES:
            wait = RETRY_BACKOFF_BASE * (2 ** (attempt - 1))
            time.sleep(wait)

    logger.error("Video upload failed after %d attempts", MAX_RETRIES)
    return None
