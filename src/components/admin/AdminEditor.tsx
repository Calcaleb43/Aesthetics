"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Field = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select" | "number" | "json" | "url-list" | "value-list" | "boolean" | "faq-items";
  options?: string[];
  rows?: number;
  hint?: string;
  readOnly?: boolean;
};

type FaqItem = { question: string; answer: string };
type ValueItem = { title: string; body: string };

function stringifyInitial(value: unknown, type?: Field["type"]) {
  if (type === "boolean") return value ? "true" : "false";
  if (type === "url-list") return Array.isArray(value) ? (value as string[]).join("\n") : "";
  if (typeof value === "string") return value;
  if (value == null) return "";
  return JSON.stringify(value, null, 2);
}

export function AdminEditor({
  endpoint,
  method = "PUT",
  initial,
  fields,
  identityKey,
  previewHref,
  deleteEndpoint,
  deletePayload,
  onSaved,
}: {
  endpoint: string;
  method?: "PUT" | "POST" | "PATCH";
  initial: Record<string, unknown>;
  fields: Field[];
  identityKey?: string;
  previewHref?: string | null;
  deleteEndpoint?: string;
  deletePayload?: Record<string, unknown>;
  onSaved?: (payload: Record<string, unknown>) => void;
}) {
  const router = useRouter();

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, stringifyInitial(initial[f.name], f.type)])),
  );
  const [faqItems, setFaqItems] = useState<FaqItem[]>(() =>
    Array.isArray(initial.items) ? (initial.items as FaqItem[]) : [],
  );
  const [valueItems, setValueItems] = useState<ValueItem[]>(() =>
    Array.isArray(initial.values) ? (initial.values as ValueItem[]) : [],
  );
  const [status, setStatus] = useState<{ tone: "ok" | "err" | ""; text: string }>({ tone: "", text: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setValues(Object.fromEntries(fields.map((f) => [f.name, stringifyInitial(initial[f.name], f.type)])));
    setFaqItems(Array.isArray(initial.items) ? (initial.items as FaqItem[]) : []);
    setValueItems(Array.isArray(initial.values) ? (initial.values as ValueItem[]) : []);
    setStatus({ tone: "", text: "" });
  }, [identityKey, initial, fields]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus({ tone: "", text: "" });

    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = values[field.name] ?? "";
      if (field.type === "number") payload[field.name] = Number(raw);
      else if (field.type === "boolean") payload[field.name] = raw === "true";
      else if (field.type === "url-list") {
        payload[field.name] = raw
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
      } else if (field.type === "faq-items") payload[field.name] = faqItems;
      else if (field.type === "value-list") payload[field.name] = valueItems;
      else if (field.type === "json") {
        try {
          payload[field.name] = JSON.parse(raw || "null");
        } catch {
          setStatus({ tone: "err", text: `Invalid JSON in ${field.label}` });
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

    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setStatus({
        tone: "err",
        text: typeof body.error === "string" ? body.error : "Save failed — check DATABASE_URL and field values.",
      });
      return;
    }

    setStatus({ tone: "ok", text: "Saved successfully" });
    onSaved?.(payload);
    router.refresh();
  }

  async function onDelete() {
    if (!deleteEndpoint || !deletePayload) return;
    if (!window.confirm("Delete this item permanently?")) return;
    setDeleting(true);
    const res = await fetch(deleteEndpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deletePayload),
    });
    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStatus({
        tone: "err",
        text: typeof body.error === "string" ? body.error : "Delete failed",
      });
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-3xl gap-5">
      <div className="flex flex-wrap items-center gap-3">
        {previewHref ? (
          <a
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className="text-xs uppercase tracking-[0.14em] text-[#c6a75e] transition hover:text-white"
          >
            Preview live →
          </a>
        ) : null}
      </div>

      {fields.map((field) => {
        if (field.type === "faq-items") {
          return (
            <div key={field.name} className="grid gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/80">{field.label}</p>
                <button
                  type="button"
                  className="text-xs uppercase tracking-[0.14em] text-[#c6a75e]"
                  onClick={() => setFaqItems((items) => [...items, { question: "", answer: "" }])}
                >
                  + Add question
                </button>
              </div>
              <div className="grid gap-4">
                {faqItems.map((item, index) => (
                  <div key={index} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.14em] text-white/40">Q{index + 1}</p>
                      <button
                        type="button"
                        className="text-xs text-red-300"
                        onClick={() => setFaqItems((items) => items.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      className="admin-input mb-3"
                      placeholder="Question"
                      value={item.question}
                      onChange={(e) =>
                        setFaqItems((items) =>
                          items.map((row, i) => (i === index ? { ...row, question: e.target.value } : row)),
                        )
                      }
                    />
                    <textarea
                      className="admin-input"
                      rows={4}
                      placeholder="Answer"
                      value={item.answer}
                      onChange={(e) =>
                        setFaqItems((items) =>
                          items.map((row, i) => (i === index ? { ...row, answer: e.target.value } : row)),
                        )
                      }
                    />
                  </div>
                ))}
                {!faqItems.length && <p className="text-sm text-white/40">No FAQ items yet.</p>}
              </div>
            </div>
          );
        }

        if (field.type === "value-list") {
          return (
            <div key={field.name} className="grid gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/80">{field.label}</p>
                <button
                  type="button"
                  className="text-xs uppercase tracking-[0.14em] text-[#c6a75e]"
                  onClick={() => setValueItems((items) => [...items, { title: "", body: "" }])}
                >
                  + Add value
                </button>
              </div>
              {valueItems.map((item, index) => (
                <div key={index} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex justify-end">
                    <button
                      type="button"
                      className="text-xs text-red-300"
                      onClick={() => setValueItems((items) => items.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    className="admin-input mb-3"
                    placeholder="Title"
                    value={item.title}
                    onChange={(e) =>
                      setValueItems((items) =>
                        items.map((row, i) => (i === index ? { ...row, title: e.target.value } : row)),
                      )
                    }
                  />
                  <textarea
                    className="admin-input"
                    rows={3}
                    placeholder="Body"
                    value={item.body}
                    onChange={(e) =>
                      setValueItems((items) =>
                        items.map((row, i) => (i === index ? { ...row, body: e.target.value } : row)),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          );
        }

        return (
          <label key={field.name} className="grid gap-2 text-sm text-white/80">
            <span className="flex items-center justify-between gap-3">
              {field.label}
              {field.hint ? <span className="text-xs font-normal text-white/35">{field.hint}</span> : null}
            </span>
            {field.type === "textarea" || field.type === "json" || field.type === "url-list" ? (
              <textarea
                rows={field.rows || (field.type === "json" ? 12 : field.type === "url-list" ? 6 : 8)}
                className="admin-input font-mono text-xs"
                readOnly={field.readOnly}
                value={values[field.name] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                placeholder={field.type === "url-list" ? "One image URL per line" : undefined}
              />
            ) : field.type === "select" || field.type === "boolean" ? (
              <select
                className="admin-input"
                value={values[field.name] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
              >
                {(field.type === "boolean" ? ["true", "false"] : field.options || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {field.type === "boolean" ? (opt === "true" ? "Yes" : "No") : opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === "number" ? "number" : "text"}
                className="admin-input"
                readOnly={field.readOnly}
                value={values[field.name] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
              />
            )}
          </label>
        );
      })}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="submit" disabled={saving} className="admin-btn">
          {saving ? "Saving..." : "Save changes"}
        </button>
        {deleteEndpoint ? (
          <button
            type="button"
            disabled={deleting}
            onClick={onDelete}
            className="rounded-full border border-red-400/40 px-5 py-3 text-sm uppercase tracking-[0.12em] text-red-200 transition hover:bg-red-500/10"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        ) : null}
        {status.text ? (
          <p className={`text-sm ${status.tone === "ok" ? "text-emerald-300" : "text-red-300"}`}>{status.text}</p>
        ) : null}
      </div>
    </form>
  );
}

export function CollectionPills({
  items,
  selectedKey,
  basePath,
  param = "slug",
  onCreate,
  createLabel = "New",
}: {
  items: { key: string; label: string; status?: string }[];
  selectedKey?: string;
  basePath: string;
  param?: string;
  onCreate?: () => void;
  createLabel?: string;
}) {
  return (
    <div className="mb-8 flex flex-wrap gap-2">
      {items.map((item) => {
        const active = selectedKey === item.key;
        const status = item.status;
        return (
          <Link
            key={item.key}
            href={`${basePath}?${param}=${encodeURIComponent(item.key)}`}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs uppercase tracking-[0.12em] transition ${
              active ? "admin-chip-active" : "bg-white/10 text-white/80 hover:bg-white/15"
            }`}
          >
            <span>{item.label}</span>
            {status ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[0.58rem] tracking-[0.08em] ${
                  status === "published"
                    ? active
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-500/20 text-emerald-200"
                    : active
                      ? "bg-black/20 text-black/70"
                      : "bg-white/10 text-white/50"
                }`}
              >
                {status}
              </span>
            ) : null}
          </Link>
        );
      })}
      {onCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="rounded-full border border-dashed border-white/25 px-4 py-2 text-xs uppercase tracking-[0.12em] text-white/60 transition hover:border-[#c6a75e] hover:text-[#c6a75e]"
        >
          + {createLabel}
        </button>
      ) : null}
    </div>
  );
}
