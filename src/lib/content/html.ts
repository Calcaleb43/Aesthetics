import sanitizeHtml from "sanitize-html";
import { renderContent } from "@/lib/content/render";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
  "hr",
  "span",
];

/** Shared CMS HTML sanitizer — no jsdom (breaks on Vercel/Node ESM). */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "target", "rel"],
    span: ["class"],
    p: ["class"],
    h2: ["class"],
    h3: ["class"],
    ul: ["class"],
    ol: ["class"],
    li: ["class"],
    blockquote: ["class"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
    }),
  },
};

export function looksLikeHtml(content: string) {
  return /<[a-z][\s\S]*>/i.test(content.trim());
}

export function isEmptyHtml(html: string) {
  const trimmed = html.trim();
  if (!trimmed) return true;
  return /^<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>$/i.test(trimmed);
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convert legacy plain / light-markdown CMS strings into HTML for TipTap. */
export function legacyContentToHtml(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return "";
  if (looksLikeHtml(trimmed)) return trimmed;

  const blocks = renderContent(trimmed);
  return blocks
    .map((block) => {
      if (block.type === "h2") return `<h2>${escapeHtml(block.text)}</h2>`;
      if (block.type === "h3") return `<h3>${escapeHtml(block.text)}</h3>`;
      if (block.type === "ul") {
        const items = block.items.map((item) => `<li><p>${escapeHtml(item)}</p></li>`).join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${escapeHtml(block.text).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

export function toEditorHtml(content: string) {
  return legacyContentToHtml(content || "");
}

export function sanitizeCmsHtml(html: string) {
  if (!html?.trim()) return "";
  return sanitizeHtml(html, SANITIZE_OPTIONS).trim();
}

/** Normalize editor output before saving (empty doc → ""). */
export function normalizeEditorHtml(html: string) {
  if (isEmptyHtml(html)) return "";
  return sanitizeCmsHtml(html);
}

/**
 * Safe HTML for public rendering. Accepts stored HTML or legacy plain/light-markdown.
 */
export function contentToSafeHtml(content: string) {
  if (!content?.trim()) return "";
  if (looksLikeHtml(content)) return sanitizeCmsHtml(content);
  return sanitizeCmsHtml(legacyContentToHtml(content));
}

/** Strip tags for heroes, meta descriptions, and other plain-text surfaces. */
export function htmlToPlainText(content: string) {
  if (!content?.trim()) return "";
  const html = contentToSafeHtml(content);
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[23]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}
