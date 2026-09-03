import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionWorkspace } from "@/components/admin/CollectionWorkspace";
import { getAllPages } from "@/lib/content/queries";

export default async function AdminPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const pages = await getAllPages();

  return (
    <AdminShell title="Pages" description="Edit static site pages, SEO titles, and long-form content.">
      <CollectionWorkspace
        items={pages.map((page) => ({
          key: page.slug,
          label: page.title,
          status: page.status,
          previewHref: page.slug === "home" ? "/" : `/${page.slug}`,
          data: page as unknown as Record<string, unknown>,
        }))}
        selectedKey={slug}
        basePath="/admin/pages"
        endpoint="/api/admin/pages"
        deleteEndpoint="/api/admin/pages"
        deleteKey="slug"
        lockIdentityFields={["slug"]}
        systemNotes={{
          home: "Homepage content is managed in Site Settings (hero, intro, values, gallery). This page record is unused on the live site.",
          contact:
            "The live Contact page uses Site Settings + the contact form. This page record is not rendered on /contact.",
        }}
        createLabel="New page"
        emptyTitle="No pages yet"
        emptyBody="Create your first page to start managing site content."
        createTemplate={{
          slug: "new-page",
          title: "New page",
          status: "draft",
          seoTitle: "",
          coverImage: "",
          excerpt: "",
          content: "",
        }}
        fields={[
          { name: "slug", label: "Slug", hint: "URL path segment" },
          { name: "title", label: "Title" },
          { name: "status", label: "Status", type: "select", options: ["draft", "published"] },
          { name: "seoTitle", label: "SEO title" },
          { name: "coverImage", label: "Cover image URL" },
          { name: "excerpt", label: "Excerpt", type: "textarea", rows: 3 },
          {
            name: "content",
            label: "Content",
            type: "textarea",
            rows: 18,
            hint: "Use ## headings and blank lines between blocks",
          },
        ]}
      />
    </AdminShell>
  );
}
