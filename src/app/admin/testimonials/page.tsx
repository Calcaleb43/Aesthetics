import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionWorkspace } from "@/components/admin/CollectionWorkspace";
import { GoogleReviewsPanel } from "@/components/admin/GoogleReviewsPanel";
import { getAdminTestimonials } from "@/lib/content/queries";

export default async function AdminTestimonialsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const testimonials = await getAdminTestimonials();

  return (
    <AdminShell
      title="Testimonials"
      description="Google Places powers the homepage when configured. Curated quotes are the fallback."
    >
      <GoogleReviewsPanel />
      <CollectionWorkspace
        items={testimonials.map((t) => ({
          key: t.id,
          label: t.authorName,
          status: t.status,
          previewHref: "/",
          data: {
            ...t,
            sourceUrl: t.sourceUrl || "",
          } as unknown as Record<string, unknown>,
        }))}
        selectedKey={id}
        basePath="/admin/testimonials"
        param="id"
        endpoint="/api/admin/testimonials"
        deleteEndpoint="/api/admin/testimonials"
        deleteKey="id"
        lockIdentityFields={["id"]}
        createLabel="New curated testimonial"
        emptyTitle="No curated testimonials"
        emptyBody="Optional fallback quotes if Google Places is offline or not configured."
        createTemplate={{
          id: "",
          quote: "",
          authorName: "",
          rating: 5,
          source: "google",
          sourceUrl: "",
          sortOrder: testimonials.length,
          status: "draft",
        }}
        fields={[
          {
            name: "id",
            label: "ID",
            hint: "Leave blank on create — assigned automatically",
          },
          { name: "authorName", label: "Author name" },
          { name: "quote", label: "Review quote", type: "textarea", rows: 5 },
          { name: "rating", label: "Star rating (1–5)", type: "number" },
          {
            name: "source",
            label: "Source",
            type: "select",
            options: ["google", "other"],
          },
          {
            name: "sourceUrl",
            label: "Review / Maps URL",
            hint: "Optional link back to the review",
          },
          { name: "sortOrder", label: "Sort order", type: "number" },
          { name: "status", label: "Status", type: "select", options: ["draft", "published"] },
        ]}
      />
    </AdminShell>
  );
}
