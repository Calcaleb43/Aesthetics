import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionWorkspace } from "@/components/admin/CollectionWorkspace";
import { getAdminCare } from "@/lib/content/queries";

export default async function AdminCarePage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const guides = await getAdminCare();

  return (
    <AdminShell title="Care Guides" description="Pre-care and aftercare instructions by category.">
      <CollectionWorkspace
        items={guides.map((guide) => ({
          key: guide.categorySlug,
          label: guide.title,
          status: guide.status,
          previewHref: `/care/${guide.categorySlug}`,
          data: guide as unknown as Record<string, unknown>,
        }))}
        selectedKey={slug}
        basePath="/admin/care"
        endpoint="/api/admin/care"
        deleteEndpoint="/api/admin/care"
        deleteKey="categorySlug"
        lockIdentityFields={["categorySlug"]}
        createLabel="New care guide"
        emptyTitle="No care guides yet"
        emptyBody="Add pre-care and aftercare content linked to a category."
        createTemplate={{
          categorySlug: "new-category",
          title: "New care guide",
          coverImage: "",
          status: "draft",
          content: "",
        }}
        fields={[
          { name: "categorySlug", label: "Category slug" },
          { name: "title", label: "Title" },
          { name: "coverImage", label: "Cover image URL" },
          { name: "status", label: "Status", type: "select", options: ["draft", "published"] },
          { name: "content", label: "Content", type: "textarea", rows: 20 },
        ]}
      />
    </AdminShell>
  );
}
