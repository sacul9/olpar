"""
SQLite-based FIFO queue for offline buffering.
When the network is down, scanned items are stored locally
and flushed in order when connectivity returns.

Each item retains its original idempotencyKey so the server
can still deduplicate on replay.
"""

import sqlite3
import json
import logging
from pathlib import Path
from typing import Optional

from config import OFFLINE_DB_PATH

logger = logging.getLogger(__name__)


class OfflineBuffer:
    def __init__(self, db_path: Optional[Path] = None):
        self._db_path = str(db_path or OFFLINE_DB_PATH)
        self._conn = sqlite3.connect(self._db_path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS buffer (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                payload TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        self._conn.commit()

    def enqueue(self, payload: dict) -> None:
        """Add a scan payload to the offline buffer."""
        self._conn.execute(
            "INSERT INTO buffer (payload) VALUES (?)",
            (json.dumps(payload),),
        )
        self._conn.commit()
        logger.info("Buffered offline item (key=%s)", payload.get("idempotencyKey", "?"))

    def count(self) -> int:
        """Number of items waiting to be sent."""
        cursor = self._conn.execute("SELECT COUNT(*) FROM buffer")
        return cursor.fetchone()[0]

    def flush(self, send_fn) -> int:
        """
        Send all buffered items in FIFO order using send_fn.
        send_fn(payload: dict) -> bool: returns True if sent successfully.
        Returns number of items successfully sent.
        """
        cursor = self._conn.execute(
            "SELECT id, payload FROM buffer ORDER BY id ASC"
        )
        rows = cursor.fetchall()

        if not rows:
            return 0

        sent = 0
        for row_id, payload_json in rows:
            payload = json.loads(payload_json)
            try:
                success = send_fn(payload)
                if success:
                    self._conn.execute("DELETE FROM buffer WHERE id = ?", (row_id,))
                    self._conn.commit()
                    sent += 1
                else:
                    # Stop flushing on first failure to maintain order
                    logger.warning("Flush stopped: send_fn returned False")
                    break
            except Exception as e:
                logger.error("Flush error: %s", e)
                break

        if sent > 0:
            logger.info("Flushed %d/%d buffered items", sent, len(rows))

        return sent

    def close(self):
        self._conn.close()
