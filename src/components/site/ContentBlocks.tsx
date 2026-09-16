import { contentToSafeHtml } from "@/lib/content/html";

export function ContentBlocks({ content }: { content: string }) {
  const html = contentToSafeHtml(content || "");
  if (!html) return null;
  return <div className="prose-block" dangerouslySetInnerHTML={{ __html: html }} />;
}
