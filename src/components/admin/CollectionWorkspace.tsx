"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminEditor } from "@/components/admin/AdminEditor";

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

export type CollectionItem = {
  key: string;
  label: string;
  status?: string;
  previewHref?: string | null;
  data: Record<string, unknown>;
};

type ModalMode = "create" | "duplicate" | "edit";

function uniqueCopyValue(base: string, existing: Set<string>) {
  const root = `${base}-copy`.replace(/-copy(-copy)+$/, "-copy");
  if (!existing.has(root)) return root;
  let n = 2;
  while (existing.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

function buildDuplicateData(
  source: Record<string, unknown>,
  lockIdentityFields: string[],
  existingKeys: string[],
): Record<string, unknown> {
  const data: Record<string, unknown> = structuredClone(source);
  const used = new Set(existingKeys);

  if ("id" in data) data.id = "";

  for (const field of lockIdentityFields) {
    if (field === "id") {
      data.id = "";
      continue;
    }
    const current = data[field];
    if (typeof current === "string" && current.trim()) {
      data[field] = uniqueCopyValue(current.trim(), used);
      used.add(String(data[field]));
    }
  }

  if (typeof data.title === "string" && data.title.trim()) {
    data.title = `${data.title.trim()} (copy)`;
  }
  if (typeof data.shortTitle === "string" && data.shortTitle.trim()) {
    data.shortTitle = `${data.shortTitle.trim()} (COPY)`;
  }
  if (typeof data.authorName === "string" && data.authorName.trim()) {
    data.authorName = `${data.authorName.trim()} (copy)`;
  }
  if (typeof data.status === "string") {
    data.status = "draft";
  }
  if (typeof data.sortOrder === "number") {
    data.sortOrder = data.sortOrder + 1;
  }

  return data;
}

function statusTone(status?: string) {
  if (status === "published") return "bg-emerald-500/15 text-emerald-300";
  if (status === "draft") return "bg-amber-500/15 text-amber-200";
  return "bg-white/10 text-white/60";
}

export function CollectionWorkspace({
  items,
  selectedKey,
  basePath,
  param = "slug",
  endpoint,
  deleteEndpoint,
  deleteKey,
  fields,
  createTemplate,
  createLabel,
  emptyTitle,
  emptyBody,
  lockIdentityFields = [],
  systemNotes = {},
}: {
  items: CollectionItem[];
  selectedKey?: string;
  basePath: string;
  param?: string;
  endpoint: string;
  deleteEndpoint?: string;
  deleteKey?: string;
  fields: Field[];
  createTemplate: Record<string, unknown>;
  createLabel: string;
  emptyTitle: string;
  emptyBody: string;
  lockIdentityFields?: string[];
  systemNotes?: Record<string, string>;
}) {
  const router = useRouter();
  const skipUrlOpen = useRef(false);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [modalItem, setModalItem] = useState<CollectionItem | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.key.toLowerCase().includes(q) ||
        (item.status || "").toLowerCase().includes(q),
    );
  }, [items, query]);

  const editorFields = useMemo(() => {
    const isDraft = modalMode === "create" || modalMode === "duplicate";
    return fields.map((field) => ({
      ...field,
      readOnly: field.readOnly || (!isDraft && lockIdentityFields.includes(field.name)),
      hint:
        !isDraft && lockIdentityFields.includes(field.name)
          ? field.hint || "Locked after create — duplicate to make a copy with a new identity"
          : field.hint,
    }));
  }, [fields, lockIdentityFields, modalMode]);

  const identity =
    modalMode && modalItem
      ? `${modalMode}-${modalItem.key}-${JSON.stringify(modalItem.data[param] ?? "")}`
      : "closed";

  function closeModal() {
    skipUrlOpen.current = true;
    setModalMode(null);
    setModalItem(null);
    if (selectedKey) router.push(basePath);
    else skipUrlOpen.current = false;
  }

  function openCreate() {
    skipUrlOpen.current = true;
    setModalMode("create");
    setModalItem({
      key: "draft-create",
      label: createLabel,
      status: "draft",
      previewHref: null,
      data: { ...createTemplate },
    });
  }

  function openDuplicate(source: CollectionItem) {
    skipUrlOpen.current = true;
    setModalMode("duplicate");
    setModalItem({
      key: "draft-duplicate",
      label: `Duplicate ${source.label}`,
      status: "draft",
      previewHref: null,
      data: buildDuplicateData(source.data, lockIdentityFields, items.map((item) => item.key)),
    });
  }

  function openEdit(item: CollectionItem) {
    skipUrlOpen.current = false;
    setModalMode("edit");
    setModalItem(item);
    router.push(`${basePath}?${param}=${encodeURIComponent(item.key)}`);
  }

  useEffect(() => {
    if (!selectedKey) {
      skipUrlOpen.current = false;
      return;
    }
    if (skipUrlOpen.current) return;
    if (modalMode === "create" || modalMode === "duplicate") return;
    const match = items.find((item) => item.key === selectedKey);
    if (!match) return;
    setModalMode("edit");
    setModalItem(match);
  }, [selectedKey, items, modalMode]);

  useEffect(() => {
    if (!modalMode) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalMode, selectedKey]);

  const modalTitle =
    modalMode === "create"
      ? createLabel
      : modalMode === "duplicate"
        ? `Duplicate ${createLabel.toLowerCase()}`
        : modalItem?.label || "Edit";

  const note = modalMode === "edit" && modalItem ? systemNotes[modalItem.key] : undefined;

  return (
    <div className="space-y-6">
      <div className="admin-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-5 py-4">
          <input
            className="admin-input max-w-xs"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <p className="text-sm text-white/45">
            {filtered.length} item{filtered.length === 1 ? "" : "s"}
          </p>
          <button type="button" className="admin-btn ml-auto" onClick={openCreate}>
            + {createLabel}
          </button>
        </div>

        {!items.length ? (
          <div className="p-8">
            <h2 className="text-xl">{emptyTitle}</h2>
            <p className="mt-2 text-sm text-white/55">{emptyBody}</p>
            <button type="button" className="admin-btn mt-6" onClick={openCreate}>
              + {createLabel}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/10 text-[0.65rem] uppercase tracking-[0.14em] text-white/40">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Key</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.map((item) => {
                  const active = selectedKey === item.key && modalMode === "edit";
                  return (
                    <tr
                      key={item.key}
                      className={`transition hover:bg-white/[0.04] ${active ? "bg-white/[0.06]" : ""}`}
                    >
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          className="text-left font-medium text-white hover:text-[#c6a75e]"
                          onClick={() => openEdit(item)}
                        >
                          {item.label}
                        </button>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-white/50">{item.key}</td>
                      <td className="px-5 py-4">
                        {item.status ? (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.12em] ${statusTone(item.status)}`}
                          >
                            {item.status}
                          </span>
                        ) : (
                          <span className="text-white/35">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            className="admin-btn-secondary !px-3 !py-1.5 !text-[0.65rem]"
                            onClick={() => openEdit(item)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="admin-btn-secondary !px-3 !py-1.5 !text-[0.65rem]"
                            onClick={() => openDuplicate(item)}
                          >
                            Duplicate
                          </button>
                          {item.previewHref ? (
                            <a
                              href={item.previewHref}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-[#c6a75e]/40 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-[#c6a75e] transition hover:bg-[#c6a75e]/10"
                            >
                              Preview
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-white/45">
                      No matches for “{query.trim()}”.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalMode && modalItem ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-6"
          onClick={closeModal}
        >
          <div
            className="my-4 w-full max-w-3xl rounded-2xl border border-white/10 bg-[#141414] p-5 shadow-2xl sm:my-8 sm:p-7"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="collection-modal-title"
          >
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.16em] text-white/40">
                  {modalMode === "create" ? "Create" : modalMode === "duplicate" ? "Duplicate" : "Edit"}
                </p>
                <h2 id="collection-modal-title" className="mt-1 text-xl font-semibold text-white">
                  {modalTitle}
                </h2>
              </div>
              <button
                type="button"
                className="text-xs uppercase tracking-[0.12em] text-white/50 hover:text-white"
                onClick={closeModal}
              >
                Close
              </button>
            </div>

            {modalMode === "create" ? (
              <p className="mb-5 text-sm text-[#c6a75e]">
                Creating new {createLabel.toLowerCase()} — set a unique identity and save.
              </p>
            ) : null}
            {modalMode === "duplicate" ? (
              <p className="mb-5 text-sm text-[#c6a75e]">
                Duplicating — review the copied fields, set a unique slug/key, then save as a new draft.
              </p>
            ) : null}
            {note ? (
              <p className="mb-5 rounded-lg border border-[#c6a75e]/30 bg-[#c6a75e]/10 px-4 py-3 text-sm text-[#e8d5a3]">
                {note}
              </p>
            ) : null}

            <AdminEditor
              key={identity}
              identityKey={identity}
              endpoint={endpoint}
              initial={modalItem.data}
              fields={editorFields}
              previewHref={modalMode === "edit" ? modalItem.previewHref : null}
              deleteEndpoint={modalMode === "edit" && deleteEndpoint ? deleteEndpoint : undefined}
              deletePayload={
                modalMode === "edit" && deleteEndpoint && deleteKey
                  ? { [deleteKey]: modalItem.key }
                  : undefined
              }
              onSaved={() => {
                skipUrlOpen.current = true;
                setModalMode(null);
                setModalItem(null);
                router.push(basePath);
                router.refresh();
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
