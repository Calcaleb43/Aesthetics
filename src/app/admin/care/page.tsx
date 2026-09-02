import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminEditor } from "@/components/admin/AdminEditor";
import { getAllCare } from "@/lib/content/queries";

export default async function AdminCarePage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const guides = await getAllCare();
  const selected = guides.find((g) => g.serviceSlug === slug) || guides[0];

  return (
    <AdminShell title="Care Guides">
      <div className="mb-6 flex flex-wrap gap-2">
        {guides.map((guide) => (
          <Link
            key={guide.serviceSlug}
            href={`/admin/care?slug=${guide.serviceSlug}`}
            className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.12em] ${
              selected?.serviceSlug === guide.serviceSlug ? "bg-white text-black" : "bg-white/10"
            }`}
          >
            {guide.title}
          </Link>
        ))}
      </div>
      {selected && (
        <AdminEditor
          endpoint="/api/admin/care"
          initial={selected}
          fields={[
            { name: "serviceSlug", label: "Service slug" },
            { name: "title", label: "Title" },
            { name: "coverImage", label: "Cover image URL" },
            { name: "status", label: "Status", type: "select", options: ["draft", "published"] },
            { name: "content", label: "Content", type: "textarea", rows: 20 },
          ]}
        />
      )}
    </AdminShell>
  );
}
