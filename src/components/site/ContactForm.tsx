"use client";

import { FormEvent, useState } from "react";

export function ContactForm({ serviceOptions }: { serviceOptions: string[] }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const options = [...serviceOptions, "General consultation"].filter(
    (value, index, arr) => arr.indexOf(value) === index,
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("done");
      setMessage("Thanks — your consultation request was received.");
      e.currentTarget.reset();
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please email Aniekanvas@gmail.com directly.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-4">
      <label className="grid gap-2 text-sm">
        Name
        <input name="name" required className="border border-[var(--line)] bg-white px-4 py-3" />
      </label>
      <label className="grid gap-2 text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          className="border border-[var(--line)] bg-white px-4 py-3"
        />
      </label>
      <label className="grid gap-2 text-sm">
        Phone
        <input name="phone" className="border border-[var(--line)] bg-white px-4 py-3" />
      </label>
      <label className="grid gap-2 text-sm">
        Service interest
        <select name="serviceInterest" className="border border-[var(--line)] bg-white px-4 py-3">
          {options.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm">
        Message
        <textarea
          name="message"
          required
          rows={5}
          className="border border-[var(--line)] bg-white px-4 py-3"
        />
      </label>
      <button type="submit" className="btn btn-solid w-fit" disabled={status === "loading"}>
        {status === "loading" ? "Sending..." : "Request consultation"}
      </button>
      {message && (
        <p className={`text-sm ${status === "error" ? "text-red-700" : "text-[var(--ink-soft)]"}`}>
          {message}
        </p>
      )}
    </form>
  );
}
