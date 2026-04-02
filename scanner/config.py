"""
Configuracion centralizada del scanner.
Todas las variables de entorno se leen aqui.
"""

import os
from pathlib import Path

# ─── API ────────────────────────────────────────────────
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:3000")
SCANNER_API_KEY = os.environ.get("SCANNER_API_KEY", "")

# ─── Camera ─────────────────────────────────────────────
CAMERA_INDEX = int(os.environ.get("CAMERA_INDEX", "0"))
RESOLUTION_WIDTH = int(os.environ.get("RESOLUTION_WIDTH", "1280"))
RESOLUTION_HEIGHT = int(os.environ.get("RESOLUTION_HEIGHT", "720"))
FPS = int(os.environ.get("FPS", "25"))

# ─── Debounce ───────────────────────────────────────────
DEBOUNCE_SECONDS = float(os.environ.get("DEBOUNCE_SECONDS", "3"))

# ─── Camera offline detection ───────────────────────────
CAMERA_OFFLINE_SECONDS = float(os.environ.get("CAMERA_OFFLINE_SECONDS", "5"))

# ─── Video storage ──────────────────────────────────────
VIDEO_OUTPUT_DIR = Path(os.environ.get("VIDEO_OUTPUT_DIR", "/tmp/olpar_videos"))
VIDEO_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ─── Offline buffer ────────────────────────────────────
OFFLINE_DB_PATH = Path(os.environ.get("OFFLINE_DB_PATH", "/tmp/olpar_offline.db"))

# ─── Retry ──────────────────────────────────────────────
MAX_RETRIES = int(os.environ.get("MAX_RETRIES", "3"))
RETRY_BACKOFF_BASE = float(os.environ.get("RETRY_BACKOFF_BASE", "1.0"))

# ─── Local API server (receives commands from dashboard) ─
LOCAL_API_HOST = os.environ.get("LOCAL_API_HOST", "0.0.0.0")
LOCAL_API_PORT = int(os.environ.get("LOCAL_API_PORT", "8765"))

# ─── Supabase Storage (for video upload) ────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
STORAGE_BUCKET = os.environ.get("STORAGE_BUCKET", "videos")
