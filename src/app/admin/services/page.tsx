import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionWorkspace } from "@/components/admin/CollectionWorkspace";
import { getAdminServices } from "@/lib/content/queries";

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const services = await getAdminServices();

  return (
    <AdminShell title="Services" description="Manage treatment pages, booking links, and publish status.">
      <CollectionWorkspace
        items={services.map((service) => ({
          key: service.slug,
          label: service.title,
          status: service.status,
          previewHref: `/services/${service.slug}`,
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
        emptyBody="Add a service to populate the treatments menu and service pages."
        createTemplate={{
          slug: "new-service",
          title: "New service",
          shortTitle: "NEW SERVICE",
          tagline: "",
          summary: "",
          coverImage: "",
          bookingUrl: "",
          sortOrder: services.length + 1,
          featured: true,
          durationMinutes: 60,
          priceCents: 0,
          depositCents: 5000,
          paymentMode: "deposit",
          bookable: true,
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
          { name: "durationMinutes", label: "Duration (minutes)", type: "number" },
          { name: "priceCents", label: "Price (cents, before tax)", type: "number", hint: "e.g. 50000 = $500.00" },
          { name: "depositCents", label: "Deposit (cents, before tax)", type: "number" },
          {
            name: "paymentMode",
            label: "Payment at booking",
            type: "select",
            options: ["deposit", "full", "none"],
          },
          { name: "bookable", label: "Bookable online", type: "boolean" },
          { name: "sortOrder", label: "Sort order", type: "number" },
          { name: "featured", label: "Featured on homepage", type: "boolean" },
          { name: "status", label: "Status", type: "select", options: ["draft", "published"] },
          { name: "content", label: "Content", type: "textarea", rows: 18 },
        ]}
      />
    </AdminShell>
  );
}
