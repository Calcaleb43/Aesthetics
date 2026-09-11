import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionWorkspace } from "@/components/admin/CollectionWorkspace";
import { getAdminCategories } from "@/lib/content/queries";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const categories = await getAdminCategories();

  return (
    <AdminShell
      title="Categories"
      description="Treatment categories shown on the public services pages. Bookable services live under each category."
    >
      <CollectionWorkspace
        items={categories.map((category) => ({
          key: category.slug,
          label: category.title,
          status: category.status,
          previewHref: `/services/${category.slug}`,
          data: category as unknown as Record<string, unknown>,
        }))}
        selectedKey={slug}
        basePath="/admin/categories"
        endpoint="/api/admin/categories"
        deleteEndpoint="/api/admin/categories"
        deleteKey="slug"
        lockIdentityFields={["slug"]}
        createLabel="New category"
        emptyTitle="No categories yet"
        emptyBody="Add a category to populate the treatments menu and service pages."
        createTemplate={{
          slug: "new-category",
          title: "New category",
          shortTitle: "NEW CATEGORY",
          tagline: "",
          summary: "",
          coverImage: "",
          bookingUrl: "",
          sortOrder: categories.length + 1,
          featured: true,
          status: "draft",
          content: "",
        }}
        fields={[
          { name: "slug", label: "Slug" },
          { name: "title", label: "Title" },
          { name: "shortTitle", label: "Short title" },
          { name: "tagline", label: "Tagline" },
          { name: "summary", label: "Summary", type: "textarea", rows: 4 },
          { name: "coverImage", label: "Cover image URL" },
          { name: "bookingUrl", label: "External booking URL (optional fallback)" },
          { name: "sortOrder", label: "Sort order", type: "number" },
          { name: "featured", label: "Featured on homepage", type: "boolean" },
          { name: "status", label: "Status", type: "select", options: ["draft", "published"] },
          { name: "content", label: "Content", type: "textarea", rows: 18 },
        ]}
      />
    </AdminShell>
  );
}
