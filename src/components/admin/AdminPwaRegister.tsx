"use client";

import { useEffect } from "react";

/**
 * Registers the admin-scoped service worker so /admin can be installed as a PWA.
 */
export function AdminPwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    void navigator.serviceWorker
      .register("/admin/sw.js", { scope: "/admin" })
      .then((reg) => {
        if (cancelled) return;
        reg.update().catch(() => {});
      })
      .catch(() => {
        // Manifest alone still helps iOS "Add to Home Screen"; SW is best-effort.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
