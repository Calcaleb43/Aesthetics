import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionWorkspace } from "@/components/admin/CollectionWorkspace";
import { CUSTOM_TEMPLATE_VAR_HELP, ensureDefaultEmailTemplates } from "@/lib/email/custom";
import { getPrisma, hasDatabase } from "@/lib/db";
import { DEFAULT_CUSTOM_TEMPLATES } from "@/lib/email/custom";

async function getTemplates() {
  if (!hasDatabase()) {
    return DEFAULT_CUSTOM_TEMPLATES.map((t) => ({ ...t }));
  }
  const db = getPrisma();
  await ensureDefaultEmailTemplates(db);
  return db.emailTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export default async function AdminEmailTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const templates = await getTemplates();
  const varHint = CUSTOM_TEMPLATE_VAR_HELP.map((v) => `{{${v.key}}}`).join(" · ");

  return (
    <AdminShell
      title="Email templates"
      description={`Edit compose/bulk templates and automated reminder / thank-you copy. Keep status Published for auto emails to use your tweaks. Variables: ${varHint}`}
    >
      <CollectionWorkspace
        items={templates.map((t) => ({
          key: t.slug,
          label: t.name,
          status: t.status,
          previewHref: null,
          data: t as unknown as Record<string, unknown>,
        }))}
        selectedKey={slug}
        basePath="/admin/email/templates"
        endpoint="/api/admin/email/templates"
        deleteEndpoint="/api/admin/email/templates"
        deleteKey="slug"
        lockIdentityFields={["slug"]}
        createLabel="New template"
        emptyTitle="No custom templates"
        emptyBody="Create reusable subject/body templates for compose and bulk sends."
        createTemplate={{
          slug: "new-template",
          name: "New template",
          description: "",
          subject: "A note from {{siteName}}",
          body: "Hi {{name}},\n\n",
          status: "draft",
          sortOrder: templates.length + 1,
        }}
        fields={[
          { name: "slug", label: "Slug" },
          { name: "name", label: "Name" },
          { name: "description", label: "Description", type: "textarea", rows: 2 },
          { name: "subject", label: "Subject", hint: "Supports {{name}}, {{siteName}}, etc." },
          {
            name: "body",
            label: "Body",
            type: "richtext",
            rows: 16,
            hint: "Supports {{name}}, {{siteName}}, and other variables",
          },
          { name: "sortOrder", label: "Sort order", type: "number" },
          { name: "status", label: "Status", type: "select", options: ["draft", "published"] },
        ]}
      />
    </AdminShell>
  );
}
