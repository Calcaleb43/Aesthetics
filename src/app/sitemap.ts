import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import {
  getAllCare,
  getAllFaqs,
  getAllPages,
  getPublishedServices,
} from "@/lib/content/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, faqs, care, pages] = await Promise.all([
    getPublishedServices(),
    getAllFaqs(),
    getAllCare(),
    getAllPages(),
  ]);

  const staticRoutes = [
    "",
    "/about",
    "/services",
    "/faqs",
    "/care",
    "/policies",
    "/contact",
    "/book-now",
  ].map((path) => ({
    url: absoluteUrl(path || "/"),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const categoryRoutes = categories.map((c) => ({
    url: absoluteUrl(`/services/${c.slug}`),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const faqRoutes = faqs.map((f) => ({
    url: absoluteUrl(`/faqs/${f.categorySlug}`),
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const careRoutes = care.map((c) => ({
    url: absoluteUrl(`/care/${c.categorySlug}`),
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const reserved = new Set(["home", "about", "policies", "book-now", "contact"]);
  const cmsPageRoutes = pages
    .filter((p) => p.status === "published" && !reserved.has(p.slug))
    .map((p) => ({
      url: absoluteUrl(`/${p.slug}`),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));

  return [...staticRoutes, ...categoryRoutes, ...faqRoutes, ...careRoutes, ...cmsPageRoutes];
}
