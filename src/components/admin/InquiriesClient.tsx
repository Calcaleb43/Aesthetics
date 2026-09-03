"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type InquiryItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  serviceInterest: string | null;
  message: string;
  status: string;
  createdAt: string;
};

export function InquiriesClient({ initial }: { initial: InquiryItem[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "new" | "read" | "archived">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (filter === "all") return initial;
    return initial.filter((row) => row.status === filter);
  }, [filter, initial]);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    const res = await fetch("/api/admin/inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBusyId(null);
    if (res.ok) router.refresh();
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this inquiry?")) return;
    setBusyId(id);
    const res = await fetch("/api/admin/inquiries", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusyId(null);
    if (res.ok) router.refresh();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {(["all", "new", "read", "archived"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.12em] ${
              filter === key ? "admin-chip-active" : "bg-white/10 text-white/70"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {rows.map((row) => (
          <article key={row.id} className="admin-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg">{row.name}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] ${
                      row.status === "new"
                        ? "bg-[#c6a75e]/20 text-[#c6a75e]"
                        : row.status === "archived"
                          ? "bg-white/10 text-white/45"
                          : "bg-emerald-500/15 text-emerald-200"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-white/65">
                  <a href={`mailto:${row.email}`} className="transition hover:text-[#c6a75e]">
                    {row.email}
                  </a>
                  {row.phone ? ` · ${row.phone}` : ""}
                </p>
                {row.serviceInterest ? (
                  <p className="mt-1 text-sm text-white/50">Interest: {row.serviceInterest}</p>
                ) : null}
              </div>
              <p className="text-xs uppercase tracking-[0.12em] text-white/40">
                {new Date(row.createdAt).toLocaleString()}
              </p>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/80">{row.message}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`mailto:${row.email}?subject=${encodeURIComponent("Re: your Aniekanvas consultation")}`}
                className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5"
              >
                Reply
              </a>
              {row.status !== "read" ? (
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => setStatus(row.id, "read")}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5"
                >
                  Mark read
                </button>
              ) : null}
              {row.status !== "archived" ? (
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => setStatus(row.id, "archived")}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5"
                >
                  Archive
                </button>
              ) : null}
              {row.status === "archived" ? (
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => setStatus(row.id, "new")}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5"
                >
                  Restore
                </button>
              ) : null}
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => onDelete(row.id)}
                className="rounded-full border border-red-400/30 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-red-200 transition hover:bg-red-500/10"
              >
                Delete
              </button>
            </div>
          </article>
        ))}
        {!rows.length && <p className="text-sm text-white/50">No inquiries in this view.</p>}
      </div>
    </div>
  );
}
