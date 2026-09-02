import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminEditor } from "@/components/admin/AdminEditor";
import { getPublishedServices } from "@/lib/content/queries";

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const services = await getPublishedServices();
  const selected = services.find((s) => s.slug === slug) || services[0];

  return (
    <AdminShell title="Services">
      <div className="mb-6 flex flex-wrap gap-2">
        {services.map((service) => (
          <Link
            key={service.slug}
            href={`/admin/services?slug=${service.slug}`}
            className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.12em] ${
              selected?.slug === service.slug ? "bg-white text-black" : "bg-white/10"
            }`}
          >
            {service.title}
          </Link>
        ))}
      </div>
      {selected && (
        <AdminEditor
          endpoint="/api/admin/services"
          initial={selected}
          fields={[
            { name: "slug", label: "Slug" },
            { name: "title", label: "Title" },
            { name: "shortTitle", label: "Short title" },
            { name: "tagline", label: "Tagline" },
            { name: "summary", label: "Summary", type: "textarea", rows: 4 },
            { name: "coverImage", label: "Cover image URL" },
            { name: "bookingUrl", label: "Booking URL" },
            { name: "sortOrder", label: "Sort order", type: "number" },
            { name: "status", label: "Status", type: "select", options: ["draft", "published"] },
            { name: "content", label: "Content", type: "textarea", rows: 18 },
          ]}
        />
      )}
    </AdminShell>
  );
}
