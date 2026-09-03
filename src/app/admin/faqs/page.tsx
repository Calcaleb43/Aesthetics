import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionWorkspace } from "@/components/admin/CollectionWorkspace";
import { getAdminFaqs } from "@/lib/content/queries";

export default async function AdminFaqsPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const faqs = await getAdminFaqs();

  return (
    <AdminShell title="FAQs" description="Structured Q&A sets linked to each service.">
      <CollectionWorkspace
        items={faqs.map((faq) => ({
          key: faq.serviceSlug,
          label: faq.title,
          status: faq.status,
          previewHref: `/faqs/${faq.serviceSlug}`,
          data: faq as unknown as Record<string, unknown>,
        }))}
        selectedKey={slug}
        basePath="/admin/faqs"
        endpoint="/api/admin/faqs"
        deleteEndpoint="/api/admin/faqs"
        deleteKey="serviceSlug"
        lockIdentityFields={["serviceSlug"]}
        createLabel="New FAQ set"
        emptyTitle="No FAQ sets yet"
        emptyBody="Create an FAQ set for a service slug to power the FAQs section."
        createTemplate={{
          serviceSlug: "new-service",
          title: "New FAQ set",
          intro: "",
          status: "draft",
          items: [{ question: "", answer: "" }],
        }}
        fields={[
          { name: "serviceSlug", label: "Service slug", hint: "Must match a service slug" },
          { name: "title", label: "Title" },
          { name: "intro", label: "Intro", type: "textarea", rows: 3 },
          { name: "status", label: "Status", type: "select", options: ["draft", "published"] },
          { name: "items", label: "Questions & answers", type: "faq-items" },
        ]}
      />
    </AdminShell>
  );
}
