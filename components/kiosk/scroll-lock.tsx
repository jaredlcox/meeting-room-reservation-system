"use client";

import { useEffect } from "react";

/**
 * Locks document scroll on kiosk (rooms) pages so the iPad toolbar doesn't
 * allow any body scroll or overscroll bounce.
 */
export function KioskScrollLock() {
  useEffect(() => {
    const { documentElement, body } = document;
    const prevHtmlOverflow = documentElement.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    documentElement.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      documentElement.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  return null;
}
