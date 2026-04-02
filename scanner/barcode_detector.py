"""
Barcode detection wrapper around pyzbar.
Handles EAN-13, Code128, and QR codes.
"""

import logging
from dataclasses import dataclass
from typing import List, Tuple

import cv2
import numpy as np
from pyzbar import pyzbar
from pyzbar.pyzbar import ZBarSymbol

logger = logging.getLogger(__name__)

# Only detect these barcode types
ALLOWED_TYPES = {
    ZBarSymbol.EAN13,
    ZBarSymbol.EAN8,
    ZBarSymbol.CODE128,
    ZBarSymbol.QRCODE,
}


@dataclass
class BarcodeResult:
    data: str
    type: str
    polygon: List[Tuple[int, int]]


def detect(frame: np.ndarray) -> List[BarcodeResult]:
    """
    Detect barcodes in a frame.
    Returns list of BarcodeResult with decoded data and polygon.
    """
    # Convert to grayscale for better detection
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Apply adaptive threshold to handle uneven lighting
    # (common in warehouses with fluorescent lights)
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 51, 10,
    )

    # Detect on both original gray and thresholded
    results = []
    seen_data = set()

    for img in [gray, thresh]:
        decoded = pyzbar.decode(img, symbols=list(ALLOWED_TYPES))
        for barcode in decoded:
            data = barcode.data.decode("utf-8", errors="replace")
            if data and data not in seen_data:
                seen_data.add(data)
                polygon = [(p.x, p.y) for p in barcode.polygon]
                results.append(BarcodeResult(
                    data=data,
                    type=barcode.type,
                    polygon=polygon,
                ))

    return results


def draw_detection(frame: np.ndarray, result: BarcodeResult) -> None:
    """Draw bounding box and label on frame for display."""
    pts = np.array(result.polygon, dtype=np.int32).reshape((-1, 1, 2))
    cv2.polylines(frame, [pts], True, (0, 255, 0), 2)

    if result.polygon:
        x, y = result.polygon[0]
        cv2.putText(
            frame, f"{result.data} ({result.type})",
            (x, y - 10),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2,
        )
