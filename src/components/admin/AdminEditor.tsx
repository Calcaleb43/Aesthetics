"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MediaPicker, type MediaItem } from "@/components/admin/MediaPicker";

type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "select"
    | "number"
    | "money"
    | "json"
    | "url-list"
    | "media"
    | "media-list"
    | "value-list"
    | "boolean"
    | "faq-items"
    | "service-variants";
  options?: string[];
  rows?: number;
  hint?: string;
  readOnly?: boolean;
};

type FaqItem = { question: string; answer: string };
type ValueItem = { title: string; body: string };
type VariantItem = {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  sortOrder: number;
  durationMinutes: number;
  priceCents: number;
  depositCents: number | null;
  paymentMode: string;
  bookable: boolean;
  status: string;
};

function emptyVariant(sortOrder: number): VariantItem {
  return {
    slug: "",
    title: "",
    summary: "",
    sortOrder,
    durationMinutes: 30,
    priceCents: 0,
    depositCents: null,
    paymentMode: "deposit",
    bookable: true,
    status: "draft",
  };
}

function centsToDollars(cents: number | null | undefined) {
  if (cents == null) return "";
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

function dollarsToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const dollars = Number(trimmed);
  if (Number.isNaN(dollars)) return null;
  return Math.round(dollars * 100);
}

function stringifyInitial(value: unknown, type?: Field["type"]) {
  if (type === "boolean") return value ? "true" : "false";
  if (type === "url-list" || type === "media-list") {
    return Array.isArray(value) ? (value as string[]).join("\n") : typeof value === "string" ? value : "";
  }
  if (type === "money") {
    if (value == null || value === "") return "";
    const cents = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(cents)) return "";
    const dollars = cents / 100;
    return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
  }
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
  const [variantItems, setVariantItems] = useState<VariantItem[]>(() =>
    Array.isArray(initial.variants) ? (initial.variants as VariantItem[]) : [],
  );
  const [variantMoney, setVariantMoney] = useState<Record<string, { price: string; deposit: string }>>(() => {
    const rows = Array.isArray(initial.variants) ? (initial.variants as VariantItem[]) : [];
    return Object.fromEntries(
      rows.map((v, i) => [
        String(i),
        { price: centsToDollars(v.priceCents), deposit: centsToDollars(v.depositCents) },
      ]),
    );
  });
  const [status, setStatus] = useState<{ tone: "ok" | "err" | ""; text: string }>({ tone: "", text: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pickerField, setPickerField] = useState<string | null>(null);

  useEffect(() => {
    setValues(Object.fromEntries(fields.map((f) => [f.name, stringifyInitial(initial[f.name], f.type)])));
    setFaqItems(Array.isArray(initial.items) ? (initial.items as FaqItem[]) : []);
    setValueItems(Array.isArray(initial.values) ? (initial.values as ValueItem[]) : []);
    const rows = Array.isArray(initial.variants) ? (initial.variants as VariantItem[]) : [];
    setVariantItems(rows);
    setVariantMoney(
      Object.fromEntries(
        rows.map((v, i) => [
          String(i),
          { price: centsToDollars(v.priceCents), deposit: centsToDollars(v.depositCents) },
        ]),
      ),
    );
    setStatus({ tone: "", text: "" });
  }, [identityKey, initial, fields]);

  const pickerMeta = fields.find((f) => f.name === pickerField);

  function applyMediaSelection(fieldName: string, selected: MediaItem[], multiple: boolean) {
    if (multiple) {
      const existing = (values[fieldName] || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const merged = [...existing];
      for (const item of selected) {
        if (!merged.includes(item.url)) merged.push(item.url);
      }
      setValues((v) => ({ ...v, [fieldName]: merged.join("\n") }));
      return;
    }
    setValues((v) => ({ ...v, [fieldName]: selected[0]?.url || "" }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus({ tone: "", text: "" });

    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = values[field.name] ?? "";
      if (field.type === "number") payload[field.name] = Number(raw);
      else if (field.type === "money") {
        const dollars = raw.trim() === "" ? null : Number(raw);
        if (dollars != null && Number.isNaN(dollars)) {
          setStatus({ tone: "err", text: `Invalid amount in ${field.label}` });
          setSaving(false);
          return;
        }
        payload[field.name] = dollars == null ? null : Math.round(dollars * 100);
      } else if (field.type === "boolean") payload[field.name] = raw === "true";
      else if (field.type === "url-list" || field.type === "media-list") {
        payload[field.name] = raw
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
      }       else if (field.type === "faq-items") payload[field.name] = faqItems;
      else if (field.type === "value-list") payload[field.name] = valueItems;
      else if (field.type === "service-variants") {
        const variants = variantItems.map((item, index) => {
          const money = variantMoney[String(index)] || { price: "0", deposit: "" };
          const priceCents = dollarsToCents(money.price);
          const depositCents = dollarsToCents(money.deposit);
          return {
            ...(item.id ? { id: item.id } : {}),
            slug: item.slug || item.title,
            title: item.title,
            summary: item.summary || "",
            sortOrder: item.sortOrder ?? index,
            durationMinutes: Number(item.durationMinutes) || 30,
            priceCents: priceCents ?? 0,
            depositCents,
            paymentMode: item.paymentMode || "deposit",
            bookable: item.bookable !== false,
            status: item.status || "draft",
          };
        });
        if (variants.some((v) => !v.title.trim())) {
          setStatus({ tone: "err", text: "Each variant needs a title" });
          setSaving(false);
          return;
        }
        payload[field.name] = variants;
      } else if (field.type === "json") {
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
    onSaved?.({ ...payload, ...(typeof body === "object" && body ? body : {}) });
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
    <>
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

        if (field.type === "media" || field.type === "media-list") {
          const urls =
            field.type === "media-list"
              ? (values[field.name] || "")
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
              : values[field.name]
                ? [values[field.name]]
                : [];
          return (
            <div key={field.name} className="grid gap-3 text-sm text-white/80">
              <span className="flex items-center justify-between gap-3">
                {field.label}
                {field.hint ? <span className="text-xs font-normal text-white/35">{field.hint}</span> : null}
              </span>
              {urls.length ? (
                <div className={`grid gap-3 ${field.type === "media-list" ? "sm:grid-cols-2" : ""}`}>
                  {urls.map((url) => (
                    <div key={url} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                      <div className="aspect-[4/3] bg-black/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="flex items-center justify-between gap-2 p-3">
                        <p className="truncate text-[0.65rem] text-white/40">{url}</p>
                        {!field.readOnly ? (
                          <button
                            type="button"
                            className="shrink-0 text-[0.65rem] uppercase tracking-[0.12em] text-red-200"
                            onClick={() => {
                              if (field.type === "media") {
                                setValues((v) => ({ ...v, [field.name]: "" }));
                              } else {
                                setValues((v) => ({
                                  ...v,
                                  [field.name]: urls.filter((u) => u !== url).join("\n"),
                                }));
                              }
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/40">No image selected.</p>
              )}
              {!field.readOnly ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="admin-btn" onClick={() => setPickerField(field.name)}>
                    {field.type === "media-list" ? "Add from library" : urls.length ? "Change image" : "Choose from library"}
                  </button>
                  {field.type === "media" && urls.length ? (
                    <button
                      type="button"
                      className="rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.12em] text-white/60"
                      onClick={() => setValues((v) => ({ ...v, [field.name]: "" }))}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              ) : null}
              {/* Keep a hidden-ish editable URL fallback for power users */}
              <details className="text-xs text-white/40">
                <summary className="cursor-pointer hover:text-white/70">Advanced: edit URL{field.type === "media-list" ? "s" : ""}</summary>
                {field.type === "media-list" ? (
                  <textarea
                    rows={field.rows || 5}
                    className="admin-input mt-2 font-mono text-xs"
                    value={values[field.name] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                    placeholder="One image URL per line"
                  />
                ) : (
                  <input
                    className="admin-input mt-2 font-mono text-xs"
                    value={values[field.name] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                    placeholder="https://..."
                  />
                )}
              </details>
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

        if (field.type === "service-variants") {
          return (
            <div key={field.name} className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white/80">{field.label}</p>
                  {field.hint ? <p className="mt-1 text-xs text-white/35">{field.hint}</p> : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 text-xs uppercase tracking-[0.14em] text-[#c6a75e]"
                  onClick={() => {
                    const nextIndex = variantItems.length;
                    setVariantItems((items) => [...items, emptyVariant(nextIndex + 1)]);
                    setVariantMoney((m) => ({ ...m, [String(nextIndex)]: { price: "", deposit: "" } }));
                  }}
                >
                  + Add variant
                </button>
              </div>
              {variantItems.map((item, index) => {
                const money = variantMoney[String(index)] || { price: "", deposit: "" };
                return (
                  <div key={item.id || index} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.14em] text-white/40">Variant {index + 1}</p>
                      <button
                        type="button"
                        className="text-xs text-red-300"
                        onClick={() => {
                          setVariantItems((items) => items.filter((_, i) => i !== index));
                          setVariantMoney((m) => {
                            const next: typeof m = {};
                            Object.entries(m).forEach(([key, val]) => {
                              const i = Number(key);
                              if (i < index) next[key] = val;
                              else if (i > index) next[String(i - 1)] = val;
                            });
                            return next;
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        className="admin-input sm:col-span-2"
                        placeholder="Title (e.g. Upper Lip)"
                        value={item.title}
                        onChange={(e) =>
                          setVariantItems((items) =>
                            items.map((row, i) => (i === index ? { ...row, title: e.target.value } : row)),
                          )
                        }
                      />
                      <input
                        className="admin-input"
                        placeholder="Slug"
                        value={item.slug}
                        onChange={(e) =>
                          setVariantItems((items) =>
                            items.map((row, i) => (i === index ? { ...row, slug: e.target.value } : row)),
                          )
                        }
                      />
                      <input
                        type="number"
                        min={1}
                        className="admin-input"
                        placeholder="Duration (min)"
                        value={item.durationMinutes}
                        onChange={(e) =>
                          setVariantItems((items) =>
                            items.map((row, i) =>
                              i === index ? { ...row, durationMinutes: Number(e.target.value) || 0 } : row,
                            ),
                          )
                        }
                      />
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        inputMode="decimal"
                        className="admin-input"
                        placeholder="Price (CAD)"
                        value={money.price}
                        onChange={(e) =>
                          setVariantMoney((m) => ({
                            ...m,
                            [String(index)]: { ...money, price: e.target.value },
                          }))
                        }
                      />
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        inputMode="decimal"
                        className="admin-input"
                        placeholder="Deposit (CAD)"
                        value={money.deposit}
                        onChange={(e) =>
                          setVariantMoney((m) => ({
                            ...m,
                            [String(index)]: { ...money, deposit: e.target.value },
                          }))
                        }
                      />
                      <select
                        className="admin-input"
                        value={item.paymentMode}
                        onChange={(e) =>
                          setVariantItems((items) =>
                            items.map((row, i) => (i === index ? { ...row, paymentMode: e.target.value } : row)),
                          )
                        }
                      >
                        {["deposit", "full", "none"].map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <select
                        className="admin-input"
                        value={item.status}
                        onChange={(e) =>
                          setVariantItems((items) =>
                            items.map((row, i) => (i === index ? { ...row, status: e.target.value } : row)),
                          )
                        }
                      >
                        {["draft", "published"].map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <select
                        className="admin-input"
                        value={item.bookable ? "true" : "false"}
                        onChange={(e) =>
                          setVariantItems((items) =>
                            items.map((row, i) =>
                              i === index ? { ...row, bookable: e.target.value === "true" } : row,
                            ),
                          )
                        }
                      >
                        <option value="true">Bookable online: Yes</option>
                        <option value="false">Bookable online: No</option>
                      </select>
                      <input
                        type="number"
                        className="admin-input"
                        placeholder="Sort order"
                        value={item.sortOrder}
                        onChange={(e) =>
                          setVariantItems((items) =>
                            items.map((row, i) =>
                              i === index ? { ...row, sortOrder: Number(e.target.value) || 0 } : row,
                            ),
                          )
                        }
                      />
                      <textarea
                        className="admin-input sm:col-span-2"
                        rows={2}
                        placeholder="Summary (optional)"
                        value={item.summary}
                        onChange={(e) =>
                          setVariantItems((items) =>
                            items.map((row, i) => (i === index ? { ...row, summary: e.target.value } : row)),
                          )
                        }
                      />
                    </div>
                  </div>
                );
              })}
              {!variantItems.length ? (
                <p className="text-sm text-white/40">No variants — booking uses the service price above.</p>
              ) : null}
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
                type={field.type === "number" || field.type === "money" ? "number" : "text"}
                step={field.type === "money" ? "0.01" : undefined}
                min={field.type === "money" || field.type === "number" ? "0" : undefined}
                inputMode={field.type === "money" ? "decimal" : undefined}
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
    <MediaPicker
      open={Boolean(pickerField)}
      title={pickerMeta?.label || "Media library"}
      multiple={pickerMeta?.type === "media-list"}
      onClose={() => setPickerField(null)}
      onSelect={(items) => {
        if (!pickerField) return;
        applyMediaSelection(pickerField, items, pickerMeta?.type === "media-list");
      }}
    />
    </>
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
