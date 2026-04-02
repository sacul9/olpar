"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Hook that listens for barcode scanner input (USB HID scanners send keystrokes + Enter).
 *
 * How it works:
 * - USB barcode scanners behave like keyboards
 * - They type the barcode digits very fast (< 50ms between chars)
 * - They end with Enter
 * - We detect this pattern: rapid keystrokes + Enter = barcode scan
 * - Human typing is slower (> 50ms between chars) and gets ignored
 *
 * @param onScan - callback when a barcode is detected
 * @param enabled - whether to listen (disable during modals/forms)
 */
export function useBarcodeScanner(
  onScan: (barcode: string) => void,
  enabled: boolean = true
) {
  const bufferRef = useRef("");
  const lastKeystrokeRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if focus is on an input/select/textarea (user is typing)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
        // Exception: if it's our hidden barcode input, allow it
        if (!(e.target as HTMLElement).dataset?.barcodeInput) return;
      }

      const now = Date.now();
      const timeSinceLast = now - lastKeystrokeRef.current;

      // If Enter and buffer has 7+ digits, it's a barcode
      if (e.key === "Enter" && bufferRef.current.length >= 7) {
        e.preventDefault();
        const barcode = bufferRef.current;
        bufferRef.current = "";
        onScan(barcode);
        return;
      }

      // If too slow between keystrokes (> 100ms), reset — human typing
      if (timeSinceLast > 100 && bufferRef.current.length > 0) {
        bufferRef.current = "";
      }

      // Accumulate digits
      if (/^[0-9]$/.test(e.key)) {
        bufferRef.current += e.key;
        lastKeystrokeRef.current = now;

        // Safety: clear buffer after 500ms of no input
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          bufferRef.current = "";
        }, 500);
      }
    },
    [onScan, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [handleKeyDown, enabled]);
}
