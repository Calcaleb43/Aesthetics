import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminEditor } from "@/components/admin/AdminEditor";
import { getAllFaqs } from "@/lib/content/queries";

export default async function AdminFaqsPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const faqs = await getAllFaqs();
  const selected = faqs.find((f) => f.serviceSlug === slug) || faqs[0];

  return (
    <AdminShell title="FAQs">
      <div className="mb-6 flex flex-wrap gap-2">
        {faqs.map((faq) => (
          <Link
            key={faq.serviceSlug}
            href={`/admin/faqs?slug=${faq.serviceSlug}`}
            className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.12em] ${
              selected?.serviceSlug === faq.serviceSlug ? "bg-white text-black" : "bg-white/10"
            }`}
          >
            {faq.title}
          </Link>
        ))}
      </div>
      {selected && (
        <AdminEditor
          endpoint="/api/admin/faqs"
          initial={selected}
          fields={[
            { name: "serviceSlug", label: "Service slug" },
            { name: "title", label: "Title" },
            { name: "intro", label: "Intro", type: "textarea", rows: 3 },
            { name: "status", label: "Status", type: "select", options: ["draft", "published"] },
            { name: "items", label: "FAQ items (JSON array)", type: "json", rows: 22 },
          ]}
        />
      )}
    </AdminShell>
  );
}
