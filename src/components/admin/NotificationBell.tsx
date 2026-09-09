"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setUnread(data.unread || 0);
      setItems(data.notifications || []);
    } catch {
      /* ignore poll errors */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 45_000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function markRead(id: string) {
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  async function markAllRead() {
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    await load();
  }

  async function onItemClick(item: NotificationItem) {
    if (!item.readAt) await markRead(item.id);
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-white/30 hover:text-white"
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c6a75e] px-1 text-[0.6rem] font-bold text-[#0f0f0f]">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/10 bg-[#141414] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Notifications</p>
            {unread > 0 ? (
              <button
                type="button"
                className="text-[0.65rem] uppercase tracking-[0.12em] text-[#c6a75e] hover:underline"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`w-full border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5 ${
                    item.readAt ? "opacity-60" : ""
                  }`}
                  onClick={() => void onItemClick(item)}
                >
                  <div className="flex items-start gap-2">
                    {!item.readAt ? (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c6a75e]" aria-hidden />
                    ) : (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      {item.body ? <p className="mt-0.5 text-xs text-white/50 line-clamp-2">{item.body}</p> : null}
                      <p className="mt-1 text-[0.6rem] uppercase tracking-[0.1em] text-white/35">
                        {new Date(item.createdAt).toLocaleString("en-CA")}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
            {!items.length ? (
              <li className="px-4 py-6 text-center text-sm text-white/40">No notifications yet.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
