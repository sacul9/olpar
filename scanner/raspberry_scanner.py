"""
Olpar Scanner — Raspberry Pi 5
Main entry point. Runs the camera capture loop and the local FastAPI server.

Architecture:
- Main thread: OpenCV capture loop + barcode detection
- FastAPI thread: receives start/stop commands from the dashboard
- Video recording: thread-safe via VideoRecorder mutex
- Offline buffer: SQLite FIFO for when network is down
- API client: retry with exponential backoff

Anti-fraud: the scanner is the SOLE source of truth for cantidadDetectada.
"""

import sys
import time
import uuid
import base64
import signal
import logging
import threading
from typing import Dict

import cv2

from config import (
    CAMERA_INDEX,
    RESOLUTION_WIDTH,
    RESOLUTION_HEIGHT,
    FPS,
    DEBOUNCE_SECONDS,
    CAMERA_OFFLINE_SECONDS,
    LOCAL_API_HOST,
    LOCAL_API_PORT,
)
import api_client
from barcode_detector import detect, draw_detection
from video_recorder import VideoRecorder
from offline_buffer import OfflineBuffer

# ─── Logging ────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("scanner")

# ─── Global state ───────────────────────────────────────

recorder = VideoRecorder()
buffer = OfflineBuffer()
last_barcode_time: Dict[str, float] = {}  # barcode -> timestamp
last_frame_ok_time: float = time.time()
shutdown_event = threading.Event()

# ─── Cleanup old debounce entries every 60s ─────────────

def cleanup_debounce():
    """Remove stale entries from debounce dict to prevent memory leak."""
    while not shutdown_event.is_set():
        shutdown_event.wait(60)
        now = time.time()
        stale = [k for k, v in last_barcode_time.items() if now - v > 30]
        for k in stale:
            del last_barcode_time[k]
        if stale:
            logger.debug("Cleaned %d stale debounce entries", len(stale))


# ─── Offline buffer flush (runs periodically) ──────────

def flush_buffer_loop():
    """Try to flush offline buffer every 30 seconds."""
    while not shutdown_event.is_set():
        shutdown_event.wait(30)
        if buffer.count() > 0:
            logger.info("Flushing offline buffer (%d items)...", buffer.count())

            def send_fn(payload):
                result = api_client.post_item(
                    sesion_id=payload["sesionId"],
                    codigo_barras=payload["codigoBarras"],
                    idempotency_key=payload["idempotencyKey"],
                )
                return result is not None

            buffer.flush(send_fn)


# ─── Process a detected barcode ────────────────────────

def process_barcode(barcode_data: str, frame) -> None:
    """Handle a detected barcode: debounce, capture, send to API."""
    now = time.time()

    # Debounce: skip if same barcode was seen within DEBOUNCE_SECONDS
    if barcode_data in last_barcode_time:
        if now - last_barcode_time[barcode_data] < DEBOUNCE_SECONDS:
            return

    last_barcode_time[barcode_data] = now
    session_id = recorder.session_id

    if not session_id:
        logger.debug("Barcode %s detected but no active session", barcode_data)
        return

    logger.info("Barcode detected: %s", barcode_data)

    # Generate unique idempotency key for this scan event
    idempotency_key = str(uuid.uuid4())

    # Capture screenshot
    screenshot_b64 = None
    try:
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        screenshot_b64 = base64.b64encode(buf).decode("ascii")
    except Exception as e:
        logger.warning("Screenshot capture failed: %s", e)

    # Send to API (with retry)
    result = api_client.post_item(
        sesion_id=session_id,
        codigo_barras=barcode_data,
        idempotency_key=idempotency_key,
        screenshot_base64=screenshot_b64,
    )

    if result is None:
        # Network failed — buffer for later
        buffer.enqueue({
            "sesionId": session_id,
            "codigoBarras": barcode_data,
            "idempotencyKey": idempotency_key,
            # Don't buffer screenshot — too large for SQLite
        })
    else:
        if result.get("duplicado"):
            logger.info("Duplicate item (already registered)")
        elif result.get("exceso"):
            logger.warning("EXCESS DETECTED: %s", result.get("productoNombre"))
        else:
            logger.info(
                "Item registered: %s (%d detected)",
                result.get("productoNombre", barcode_data),
                result.get("cantidadDetectada", 0),
            )


# ─── Main capture loop ─────────────────────────────────

def main():
    global last_frame_ok_time

    logger.info("Initializing camera %d...", CAMERA_INDEX)
    cap = cv2.VideoCapture(CAMERA_INDEX)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, RESOLUTION_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, RESOLUTION_HEIGHT)
    cap.set(cv2.CAP_PROP_FPS, FPS)

    if not cap.isOpened():
        logger.error("Failed to open camera %d", CAMERA_INDEX)
        sys.exit(1)

    logger.info(
        "Camera ready: %dx%d @ %dfps",
        RESOLUTION_WIDTH, RESOLUTION_HEIGHT, FPS,
    )
    logger.info("Waiting for session to start...")

    camera_offline_notified = False

    while not shutdown_event.is_set():
        ret, frame = cap.read()

        if not ret:
            # Camera offline
            elapsed = time.time() - last_frame_ok_time
            if elapsed > CAMERA_OFFLINE_SECONDS and not camera_offline_notified:
                logger.error("Camera offline for %.1fs", elapsed)
                if recorder.session_id:
                    api_client.post_camara_offline(recorder.session_id)
                camera_offline_notified = True
            time.sleep(0.1)
            continue

        last_frame_ok_time = time.time()
        camera_offline_notified = False

        # Write frame to video if recording
        recorder.write_frame(frame)

        # Detect barcodes
        results = detect(frame)
        for result in results:
            draw_detection(frame, result)
            # Process in current thread — API calls have retry built in
            process_barcode(result.data, frame)

        # Display on local monitor (if connected)
        try:
            cv2.imshow("Olpar - Estacion de Devoluciones", frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                logger.info("Quit requested via keyboard")
                shutdown_event.set()
                break
        except cv2.error:
            # No display available (headless mode)
            pass

    # Cleanup
    logger.info("Shutting down...")
    cap.release()
    video_path = recorder.stop()
    if video_path and recorder.session_id:
        # Upload remaining video
        handle_video_upload(recorder.session_id, str(video_path))
    cv2.destroyAllWindows()
    buffer.close()


# ─── Video upload handler ───────────────────────────────

def handle_video_upload(session_id: str, video_path: str) -> None:
    """Upload video to Supabase Storage and notify the API."""
    logger.info("Uploading video for session %s...", session_id)
    storage_path = api_client.upload_video_to_storage(session_id, video_path)
    if storage_path:
        api_client.post_video_listo(session_id, storage_path)
        # Delete local file after successful upload
        try:
            import os
            os.unlink(video_path)
            logger.info("Local video deleted: %s", video_path)
        except OSError as e:
            logger.warning("Failed to delete local video: %s", e)
    else:
        logger.error(
            "Video upload failed — keeping local file: %s", video_path,
        )


# ─── FastAPI local server ──────────────────────────────

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Olpar Scanner Local API")


class IniciarSesionRequest(BaseModel):
    sesion_id: str


class CerrarSesionRequest(BaseModel):
    sesion_id: str


@app.post("/iniciar-sesion")
def iniciar_sesion(req: IniciarSesionRequest):
    """Called by the dashboard when a new session starts."""
    try:
        video_path = recorder.start(req.sesion_id)
        return {"ok": True, "video_path": str(video_path)}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cerrar-sesion")
def cerrar_sesion(req: CerrarSesionRequest):
    """Called by the dashboard when a session is closed."""
    video_path = recorder.stop()

    if video_path and video_path.exists():
        # Upload in background thread to not block the API response
        threading.Thread(
            target=handle_video_upload,
            args=(req.sesion_id, str(video_path)),
            daemon=True,
        ).start()

    return {"ok": True}


@app.get("/health")
def health():
    """Health check endpoint."""
    return {
        "ok": True,
        "recording": recorder.is_recording,
        "session_id": recorder.session_id,
        "offline_buffer_count": buffer.count(),
        "camera_ok": (time.time() - last_frame_ok_time) < CAMERA_OFFLINE_SECONDS,
    }


# ─── Entry point ───────────────────────────────────────

def run_api_server():
    """Run FastAPI server in a separate thread."""
    uvicorn.run(
        app,
        host=LOCAL_API_HOST,
        port=LOCAL_API_PORT,
        log_level="warning",
    )


def handle_signal(signum, frame):
    logger.info("Signal %d received, shutting down...", signum)
    shutdown_event.set()


if __name__ == "__main__":
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    # Start background threads
    threading.Thread(target=run_api_server, daemon=True, name="api-server").start()
    threading.Thread(target=cleanup_debounce, daemon=True, name="debounce-cleanup").start()
    threading.Thread(target=flush_buffer_loop, daemon=True, name="buffer-flush").start()

    logger.info("Scanner started. API on %s:%d", LOCAL_API_HOST, LOCAL_API_PORT)

    # Run main capture loop (blocks until shutdown)
    main()
