"use client";

import { FormEvent, useState } from "react";

type Field = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select" | "number" | "json";
  options?: string[];
  rows?: number;
};

export function AdminEditor({
  endpoint,
  method = "PUT",
  initial,
  fields,
}: {
  endpoint: string;
  method?: "PUT" | "POST" | "PATCH";
  initial: Record<string, unknown>;
  fields: Field[];
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(initial).map(([k, v]) => [
        k,
        typeof v === "string" ? v : JSON.stringify(v ?? "", null, 2),
      ]),
    ),
  );
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = values[field.name] ?? "";
      if (field.type === "number") payload[field.name] = Number(raw);
      else if (field.type === "json") {
        try {
          payload[field.name] = JSON.parse(raw || "null");
        } catch {
          setStatus(`Invalid JSON in ${field.label}`);
          setSaving(false);
          return;
        }
      } else payload[field.name] = raw;
    }

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    setStatus(res.ok ? "Saved" : "Save failed — is DATABASE_URL configured?");
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-3xl gap-4">
      {fields.map((field) => (
        <label key={field.name} className="grid gap-2 text-sm">
          {field.label}
          {field.type === "textarea" || field.type === "json" ? (
            <textarea
              rows={field.rows || (field.type === "json" ? 12 : 8)}
              className="rounded border border-white/15 bg-black/30 px-3 py-2 font-mono text-xs"
              value={values[field.name] || ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            />
          ) : field.type === "select" ? (
            <select
              className="rounded border border-white/15 bg-black/30 px-3 py-2"
              value={values[field.name] || ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            >
              {(field.options || []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type === "number" ? "number" : "text"}
              className="rounded border border-white/15 bg-black/30 px-3 py-2"
              value={values[field.name] || ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            />
          )}
        </label>
      ))}
      <button
        type="submit"
        disabled={saving}
        className="w-fit rounded-full bg-[#f5f1eb] px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-black"
      >
        {saving ? "Saving..." : "Save changes"}
      </button>
      {status && <p className="text-sm text-white/70">{status}</p>}
    </form>
  );
}
