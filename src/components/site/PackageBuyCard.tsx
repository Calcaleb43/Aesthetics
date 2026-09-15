"use client";

import { useState, type FormEvent } from "react";
import { formatCad } from "@/lib/booking/money";

type PackageCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  sessionCount: number;
};

export function PackageBuyCard({
  pkg,
  hstRateBps,
}: {
  pkg: PackageCard;
  hstRateBps: number;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const tax = Math.round((pkg.priceCents * hstRateBps) / 10000);
  const total = pkg.priceCents + tax;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/packages/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: pkg.id,
          clientName: name,
          clientEmail: email,
          clientPhone: phone,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.checkoutUrl) {
        setError(typeof body.error === "string" ? body.error : "Checkout failed");
        setBusy(false);
        return;
      }
      window.location.href = body.checkoutUrl;
    } catch {
      setError("Checkout failed");
      setBusy(false);
    }
  }

  return (
    <article className="border-b border-[var(--line)] py-10 md:py-12">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <p className="text-[0.68rem] tracking-[0.2em] text-[var(--gold-deep)] uppercase">
            {pkg.sessionCount} session{pkg.sessionCount === 1 ? "" : "s"}
          </p>
          <h2 className="display mt-2 text-3xl md:text-4xl">{pkg.title}</h2>
          {pkg.description ? (
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{pkg.description}</p>
          ) : null}
          <p className="mt-4 text-sm font-medium">
            {formatCad(pkg.priceCents)}
            <span className="font-normal text-[var(--ink-soft)]"> + HST · {formatCad(total)} total</span>
          </p>
        </div>
        <button type="button" className="btn shrink-0" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Buy package"}
        </button>
      </div>

      {open ? (
        <form onSubmit={onSubmit} className="mt-8 grid max-w-md gap-4">
          <label className="grid gap-1.5 text-sm">
            <span>Full name</span>
            <input
              className="rounded-xl border border-black/10 bg-white px-3 py-2.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={160}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Email</span>
            <input
              type="email"
              className="rounded-xl border border-black/10 bg-white px-3 py-2.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Phone</span>
            <input
              type="tel"
              className="rounded-xl border border-black/10 bg-white px-3 py-2.5"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              maxLength={64}
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Redirecting…" : `Pay ${formatCad(total)}`}
          </button>
        </form>
      ) : null}
    </article>
  );
}
