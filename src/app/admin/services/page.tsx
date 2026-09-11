import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionWorkspace } from "@/components/admin/CollectionWorkspace";
import { getAdminBookableServices, getAdminCategories } from "@/lib/content/queries";

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const [services, categories] = await Promise.all([
    getAdminBookableServices(),
    getAdminCategories(),
  ]);
  const categorySlugs = categories.map((c) => c.slug);
  const defaultCategory = categorySlugs[0] || "ombre-brows";

  return (
    <AdminShell
      title="Services"
      description="Bookable service kinds under each category. Clients can multi-select across categories during booking."
    >
      <CollectionWorkspace
        items={services.map((service) => ({
          key: service.slug,
          label: `${service.title} (${service.categorySlug})`,
          status: service.status,
          previewHref: `/services/${service.categorySlug}`,
          data: service as unknown as Record<string, unknown>,
        }))}
        selectedKey={slug}
        basePath="/admin/services"
        endpoint="/api/admin/services"
        deleteEndpoint="/api/admin/services"
        deleteKey="slug"
        lockIdentityFields={["slug"]}
        createLabel="New service"
        emptyTitle="No services yet"
        emptyBody="Add priced services under a category for online booking."
        createTemplate={{
          slug: "new-service",
          categorySlug: defaultCategory,
          title: "New service",
          summary: "",
          sortOrder: services.length + 1,
          durationMinutes: 60,
          priceCents: 0,
          depositCents: 5000,
          paymentMode: "deposit",
          bookable: true,
          status: "draft",
        }}
        fields={[
          { name: "slug", label: "Slug" },
          {
            name: "categorySlug",
            label: "Category",
            type: "select",
            options: categorySlugs.length ? categorySlugs : [defaultCategory],
          },
          { name: "title", label: "Title" },
          { name: "summary", label: "Summary", type: "textarea", rows: 3 },
          { name: "durationMinutes", label: "Duration (minutes)", type: "number" },
          {
            name: "priceCents",
            label: "Price (CAD, before tax)",
            type: "money",
            hint: "Enter dollars — e.g. 85 for $85.00",
          },
          {
            name: "depositCents",
            label: "Deposit (CAD, before tax)",
            type: "money",
            hint: "Enter dollars — e.g. 50 for $50.00. Leave blank for none.",
          },
          {
            name: "paymentMode",
            label: "Payment at booking",
            type: "select",
            options: ["deposit", "full", "none"],
          },
          { name: "bookable", label: "Bookable online", type: "boolean" },
          { name: "sortOrder", label: "Sort order", type: "number" },
          { name: "status", label: "Status", type: "select", options: ["draft", "published"] },
        ]}
      />
    </AdminShell>
  );
}
