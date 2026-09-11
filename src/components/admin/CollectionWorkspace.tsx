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
  const [creating, setCreating] = useState(false);

  const selected = useMemo(() => {
    if (creating) {
      return {
        key: `new-${createLabel}`,
        label: createLabel,
        status: "draft",
        previewHref: null,
        data: createTemplate,
      } satisfies CollectionItem;
    }
    return items.find((item) => item.key === selectedKey) || items[0] || null;
  }, [creating, createLabel, createTemplate, items, selectedKey]);

  const identity = creating ? `new-${createLabel}` : selected?.key || "none";
  const editorFields = useMemo(
    () =>
      fields.map((field) => ({
        ...field,
        readOnly: field.readOnly || (!creating && lockIdentityFields.includes(field.name)),
        hint:
          !creating && lockIdentityFields.includes(field.name)
            ? field.hint || "Locked after create — delete & recreate to change"
            : field.hint,
      })),
    [creating, fields, lockIdentityFields],
  );
  const note = !creating && selected ? systemNotes[selected.key] : undefined;

  return (
    <div>
      <CollectionPills
        items={items}
        selectedKey={creating ? undefined : selected?.key}
        basePath={basePath}
        param={param}
        createLabel={createLabel}
        onCreate={() => setCreating(true)}
      />

      {!selected ? (
        <div className="admin-card p-8">
          <h2 className="text-xl">{emptyTitle}</h2>
          <p className="mt-2 text-sm text-white/55">{emptyBody}</p>
          <button type="button" className="admin-btn mt-6" onClick={() => setCreating(true)}>
            + {createLabel}
          </button>
        </div>
      ) : (
        <div className="admin-card p-6 md:p-8">
          {creating ? (
            <p className="mb-5 text-sm text-[#c6a75e]">
              Creating new {createLabel.toLowerCase()} — set a unique slug and save.
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
            initial={selected.data}
            fields={editorFields}
            previewHref={!creating ? selected.previewHref : null}
            deleteEndpoint={!creating && deleteEndpoint ? deleteEndpoint : undefined}
            deletePayload={
              !creating && deleteEndpoint && deleteKey
                ? { [deleteKey]: selected.key }
                : undefined
            }
            onSaved={(payload) => {
              setCreating(false);
              const nextKey = String(payload[deleteKey || param] || payload.slug || "");
              if (nextKey) router.push(`${basePath}?${param}=${encodeURIComponent(nextKey)}`);
              else router.refresh();
            }}
          />
          {creating ? (
            <button
              type="button"
              className="mt-4 text-sm text-white/45 transition hover:text-white"
              onClick={() => setCreating(false)}
            >
              Cancel create
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
