import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionWorkspace } from "@/components/admin/CollectionWorkspace";
import { getPrisma, hasDatabase } from "@/lib/db";

async function getPackages() {
  if (!hasDatabase()) return [];
  try {
    return await getPrisma().packageOffer.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      include: { services: { select: { serviceId: true } } },
    });
  } catch {
    return [];
  }
}

async function getServiceHints() {
  if (!hasDatabase()) return [] as { id: string; title: string; slug: string }[];
  try {
    return await getPrisma().service.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: { id: true, title: true, slug: true },
      take: 80,
    });
  } catch {
    return [];
  }
}

export default async function AdminPackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const [packages, services] = await Promise.all([getPackages(), getServiceHints()]);

  return (
    <AdminShell
      title="Packages"
      description="Prepaid session packages sold online. Link service IDs that can redeem sessions from the package."
    >
      <CollectionWorkspace
        items={packages.map((p) => ({
          key: p.slug,
          label: `${p.title} · ${p.sessionCount} sessions`,
          status: p.active ? "active" : "inactive",
          previewHref: "/packages",
          data: {
            id: p.id,
            slug: p.slug,
            title: p.title,
            description: p.description,
            priceCents: p.priceCents,
            sessionCount: p.sessionCount,
            active: p.active,
            sortOrder: p.sortOrder,
            serviceIds: p.services.map((s) => s.serviceId),
          },
        }))}
        selectedKey={slug}
        basePath="/admin/packages"
        endpoint="/api/admin/packages"
        deleteEndpoint="/api/admin/packages"
        deleteKey="slug"
        lockIdentityFields={["slug"]}
        createLabel="New package"
        emptyTitle="No packages yet"
        emptyBody="Create prepaid multi-session packages clients can buy and redeem at booking."
        createTemplate={{
          slug: "new-package",
          title: "New package",
          description: "",
          priceCents: 0,
          sessionCount: 5,
          active: true,
          sortOrder: packages.length + 1,
          serviceIds: [] as string[],
        }}
        fields={[
          { name: "slug", label: "Slug" },
          { name: "title", label: "Title" },
          { name: "description", label: "Description", type: "textarea", rows: 4 },
          {
            name: "priceCents",
            label: "Price (CAD, before tax)",
            type: "money",
            hint: "Enter dollars — e.g. 450 for $450.00",
          },
          { name: "sessionCount", label: "Sessions included", type: "number" },
          {
            name: "serviceIds",
            label: "Redeemable service IDs",
            type: "url-list",
            rows: 5,
            hint: "One service UUID per line. Clients can redeem package sessions against these services.",
          },
          { name: "active", label: "Active (listed publicly)", type: "boolean" },
          { name: "sortOrder", label: "Sort order", type: "number" },
        ]}
      />
      {services.length ? (
        <p className="mt-4 text-sm text-white/45">
          Service IDs:{" "}
          {services.map((s) => `${s.title} (${s.id})`).join(" · ")}
        </p>
      ) : null}
    </AdminShell>
  );
}
