import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionWorkspace } from "@/components/admin/CollectionWorkspace";
import { getAdminAddons, getAdminCategories } from "@/lib/content/queries";

export default async function AdminAddonsPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const [addons, categories] = await Promise.all([getAdminAddons(), getAdminCategories()]);
  const categorySlugs = categories.map((c) => c.slug).filter((s) => s !== "imported-acuity");

  return (
    <AdminShell
      title="Add-ons"
      description="Optional extras clients can add during booking. Leave category scope empty to offer with any service, or limit to specific treatment categories."
    >
      <CollectionWorkspace
        items={addons.map((addon) => ({
          key: addon.slug,
          label: addon.title,
          status: addon.status,
          previewHref: "/book-now",
          data: addon as unknown as Record<string, unknown>,
        }))}
        selectedKey={slug}
        basePath="/admin/addons"
        endpoint="/api/admin/addons"
        deleteEndpoint="/api/admin/addons"
        deleteKey="slug"
        lockIdentityFields={["slug"]}
        createLabel="New add-on"
        emptyTitle="No add-ons yet"
        emptyBody="Create optional extras (numbing, aftercare kits, etc.) that clients can add when booking."
        createTemplate={{
          slug: "new-addon",
          title: "New add-on",
          summary: "",
          sortOrder: addons.length + 1,
          durationMinutes: 0,
          priceCents: 0,
          depositCents: null,
          paymentMode: "full",
          bookable: true,
          status: "draft",
          categorySlugs: [] as string[],
        }}
        fields={[
          { name: "slug", label: "Slug" },
          { name: "title", label: "Title" },
          { name: "summary", label: "Summary", type: "textarea", rows: 3 },
          {
            name: "categorySlugs",
            label: "Limit to categories (optional)",
            type: "url-list",
            hint: "One category slug per line. Leave blank to offer with any selected service.",
            rows: 4,
          },
          { name: "durationMinutes", label: "Extra duration (minutes)", type: "number" },
          {
            name: "priceCents",
            label: "Price (CAD, before tax)",
            type: "money",
            hint: "Enter dollars — e.g. 25 for $25.00",
          },
          {
            name: "depositCents",
            label: "Deposit (CAD, before tax)",
            type: "money",
            hint: "Optional. Enter dollars, or leave blank.",
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
      {categorySlugs.length ? (
        <p className="mt-4 text-sm text-white/45">
          Available category slugs: {categorySlugs.join(", ")}
        </p>
      ) : null}
    </AdminShell>
  );
}
