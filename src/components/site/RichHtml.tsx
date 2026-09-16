import { contentToSafeHtml } from "@/lib/content/html";

type RichHtmlProps = {
  content: string;
  className?: string;
  as?: "div" | "span";
};

/** Renders CMS body content (HTML or legacy plain/light-markdown) safely. */
export function RichHtml({ content, className = "", as = "div" }: RichHtmlProps) {
  const html = contentToSafeHtml(content || "");
  if (!html) return null;
  const Tag = as;
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
