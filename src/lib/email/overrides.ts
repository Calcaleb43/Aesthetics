import { contentToSafeHtml } from "@/lib/content/html";
import type { Database } from "@/lib/db";
import { interpolate, type TemplateVars } from "@/lib/email/custom";

/** Convert plain-text paragraphs (or HTML) into intro HTML for the branded layout. */
export function bodyToIntroHtml(body: string) {
  return contentToSafeHtml(body);
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
    const subject = interpolate(row.subject, vars).trim();
    const introHtml = bodyToIntroHtml(interpolate(row.body, vars));
    if (!subject && !introHtml) return null;
    return {
      subject: subject || undefined,
      introHtml: introHtml || undefined,
    };
  } catch {
    return null;
  }
}
