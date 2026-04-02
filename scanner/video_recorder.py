"""
Thread-safe video recorder.
Uses threading.Lock() to protect the VideoWriter from concurrent access
between the capture loop and the FastAPI endpoints.
"""

import threading
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

import cv2

from config import VIDEO_OUTPUT_DIR, FPS, RESOLUTION_WIDTH, RESOLUTION_HEIGHT

logger = logging.getLogger(__name__)


class VideoRecorder:
    def __init__(self):
        self._lock = threading.Lock()
        self._writer: Optional[cv2.VideoWriter] = None
        self._video_path: Optional[Path] = None
        self._session_id: Optional[str] = None
        self._recording = False

    @property
    def is_recording(self) -> bool:
        return self._recording

    @property
    def session_id(self) -> Optional[str]:
        return self._session_id

    @property
    def video_path(self) -> Optional[Path]:
        return self._video_path

    def start(self, session_id: str) -> Path:
        """Start recording video for a session. Returns the output file path."""
        with self._lock:
            if self._recording:
                logger.warning("Already recording session %s, stopping first", self._session_id)
                self._stop_internal()

            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            self._video_path = VIDEO_OUTPUT_DIR / f"sesion_{session_id}_{ts}.mp4"
            self._session_id = session_id

            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            self._writer = cv2.VideoWriter(
                str(self._video_path),
                fourcc,
                FPS,
                (RESOLUTION_WIDTH, RESOLUTION_HEIGHT),
            )

            if not self._writer.isOpened():
                logger.error("Failed to open VideoWriter at %s", self._video_path)
                self._writer = None
                raise RuntimeError("Failed to open VideoWriter")

            self._recording = True
            logger.info("Recording started: %s", self._video_path)
            return self._video_path

    def write_frame(self, frame) -> None:
        """Write a frame to the video. Thread-safe."""
        with self._lock:
            if self._recording and self._writer is not None:
                self._writer.write(frame)

    def stop(self) -> Optional[Path]:
        """Stop recording and return the video file path."""
        with self._lock:
            return self._stop_internal()

    def _stop_internal(self) -> Optional[Path]:
        """Internal stop — must be called with lock held."""
        if self._writer is not None:
            self._writer.release()
            self._writer = None

        path = self._video_path
        self._recording = False
        self._session_id = None
        self._video_path = None

        if path:
            logger.info("Recording stopped: %s", path)
        return path
