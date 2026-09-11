"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminEditor, CollectionPills } from "@/components/admin/AdminEditor";

type Field = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select" | "number" | "money" | "json" | "url-list" | "value-list" | "boolean" | "faq-items";
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

  // New records should not reuse database ids
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
  const [draftMode, setDraftMode] = useState<"create" | "duplicate" | null>(null);
  const [draftData, setDraftData] = useState<Record<string, unknown> | null>(null);

  const selectedExisting = useMemo(
    () => items.find((item) => item.key === selectedKey) || items[0] || null,
    [items, selectedKey],
  );

  const selected = useMemo(() => {
    if (draftMode && draftData) {
      return {
        key: `draft-${draftMode}`,
        label: draftMode === "duplicate" ? `Duplicate ${createLabel}` : createLabel,
        status: "draft",
        previewHref: null,
        data: draftData,
      } satisfies CollectionItem;
    }
    return selectedExisting;
  }, [draftMode, draftData, createLabel, selectedExisting]);

  const identity = draftMode ? `draft-${draftMode}-${JSON.stringify(draftData?.[param] ?? "")}` : selected?.key || "none";
  const editorFields = useMemo(
    () =>
      fields.map((field) => ({
        ...field,
        readOnly: field.readOnly || (!draftMode && lockIdentityFields.includes(field.name)),
        hint:
          !draftMode && lockIdentityFields.includes(field.name)
            ? field.hint || "Locked after create — duplicate to make a copy with a new identity"
            : field.hint,
      })),
    [draftMode, fields, lockIdentityFields],
  );
  const note = !draftMode && selectedExisting ? systemNotes[selectedExisting.key] : undefined;

  function startCreate() {
    setDraftMode("create");
    setDraftData({ ...createTemplate });
  }

  function startDuplicate() {
    if (!selectedExisting) return;
    setDraftMode("duplicate");
    setDraftData(
      buildDuplicateData(
        selectedExisting.data,
        lockIdentityFields,
        items.map((item) => item.key),
      ),
    );
  }

  function cancelDraft() {
    setDraftMode(null);
    setDraftData(null);
  }

  return (
    <div>
      <CollectionPills
        items={items}
        selectedKey={draftMode ? undefined : selected?.key}
        basePath={basePath}
        param={param}
        createLabel={createLabel}
        onCreate={startCreate}
      />

      {!selected ? (
        <div className="admin-card p-8">
          <h2 className="text-xl">{emptyTitle}</h2>
          <p className="mt-2 text-sm text-white/55">{emptyBody}</p>
          <button type="button" className="admin-btn mt-6" onClick={startCreate}>
            + {createLabel}
          </button>
        </div>
      ) : (
        <div className="admin-card p-6 md:p-8">
          {draftMode === "create" ? (
            <p className="mb-5 text-sm text-[#c6a75e]">
              Creating new {createLabel.toLowerCase()} — set a unique identity and save.
            </p>
          ) : null}
          {draftMode === "duplicate" ? (
            <p className="mb-5 text-sm text-[#c6a75e]">
              Duplicating — review the copied fields, set a unique slug/key, then save as a new draft.
            </p>
          ) : null}
          {note ? (
            <p className="mb-5 rounded-lg border border-[#c6a75e]/30 bg-[#c6a75e]/10 px-4 py-3 text-sm text-[#e8d5a3]">
              {note}
            </p>
          ) : null}

          {!draftMode && selectedExisting ? (
            <div className="mb-5 flex flex-wrap gap-2">
              <button type="button" className="admin-btn" onClick={startDuplicate}>
                Duplicate
              </button>
              <p className="self-center text-sm text-white/45">
                Copy this item to create a new draft you can edit.
              </p>
            </div>
          ) : null}

          <AdminEditor
            key={identity}
            identityKey={identity}
            endpoint={endpoint}
            initial={selected.data}
            fields={editorFields}
            previewHref={!draftMode ? selected.previewHref : null}
            deleteEndpoint={!draftMode && deleteEndpoint ? deleteEndpoint : undefined}
            deletePayload={
              !draftMode && deleteEndpoint && deleteKey && selectedExisting
                ? { [deleteKey]: selectedExisting.key }
                : undefined
            }
            onSaved={(payload) => {
              cancelDraft();
              const nextKey = String(payload[deleteKey || param] || payload.slug || payload.id || "");
              if (nextKey) router.push(`${basePath}?${param}=${encodeURIComponent(nextKey)}`);
              else router.refresh();
            }}
          />
          {draftMode ? (
            <button
              type="button"
              className="mt-4 text-sm text-white/45 transition hover:text-white"
              onClick={cancelDraft}
            >
              Cancel {draftMode === "duplicate" ? "duplicate" : "create"}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
