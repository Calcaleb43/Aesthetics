import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminEditor } from "@/components/admin/AdminEditor";
import { getAllPages } from "@/lib/content/queries";

export default async function AdminPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const pages = await getAllPages();
  const selected = pages.find((p) => p.slug === slug) || pages[0];

  return (
    <AdminShell title="Pages">
      <div className="mb-6 flex flex-wrap gap-2">
        {pages.map((page) => (
          <Link
            key={page.slug}
            href={`/admin/pages?slug=${page.slug}`}
            className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.12em] ${
              selected?.slug === page.slug ? "bg-white text-black" : "bg-white/10"
            }`}
          >
            {page.title}
          </Link>
        ))}
      </div>
      {selected && (
        <AdminEditor
          endpoint="/api/admin/pages"
          initial={selected}
          fields={[
            { name: "slug", label: "Slug" },
            { name: "title", label: "Title" },
            { name: "status", label: "Status", type: "select", options: ["draft", "published"] },
            { name: "seoTitle", label: "SEO title" },
            { name: "coverImage", label: "Cover image URL" },
            { name: "excerpt", label: "Excerpt", type: "textarea", rows: 3 },
            { name: "content", label: "Content", type: "textarea", rows: 18 },
          ]}
        />
      )}
    </AdminShell>
  );
}
