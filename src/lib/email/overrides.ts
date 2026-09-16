import { contentToSafeHtml } from "@/lib/content/html";
import type { Database } from "@/lib/db";
import { interpolate, type TemplateVars } from "@/lib/email/custom";

/** Convert plain-text paragraphs (or HTML) into intro HTML for the branded layout. */
export function bodyToIntroHtml(body: string) {
  return contentToSafeHtml(body);
}

/** Build a subject/intro override from draft (or saved) copy + sample/live vars. */
export function draftCopyOverride(
  subject: string | null | undefined,
  body: string | null | undefined,
  vars: TemplateVars,
): { subject?: string; introHtml?: string } | null {
  const subj = interpolate(subject || "", vars).trim();
  const introHtml =
    body != null && String(body).trim() ? bodyToIntroHtml(interpolate(String(body), vars)) : "";
  if (!subj && !introHtml) return null;
  return {
    subject: subj || undefined,
    introHtml: introHtml || undefined,
  };
}

/** Published EmailTemplate rows can override subject/intro for automated emails. */
export async function loadTemplateCopyOverride(
  db: Database | null | undefined,
  slug: string,
  vars: TemplateVars,
): Promise<{ subject?: string; introHtml?: string } | null> {
  if (!db) return null;
  try {
    const row = await db.emailTemplate.findUnique({ where: { slug } });
    if (!row || row.status !== "published") return null;
    return draftCopyOverride(row.subject, row.body, vars);
  } catch {
    return null;
  }
}
