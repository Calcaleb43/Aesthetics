import { MotionProvider } from "@/components/site/MotionProvider";
import { JsonLd } from "@/components/site/JsonLd";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getPublishedServices, getSettings } from "@/lib/content/queries";
import { localBusinessJsonLd } from "@/lib/seo";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, services] = await Promise.all([getSettings(), getPublishedServices()]);
  const bookingHref = settings.bookingEnabled ? "/book-now" : settings.bookingUrl;

  return (
    <div className="site-shell" style={{ fontFamily: "var(--font-figtree), var(--font-body)" }}>
      <JsonLd data={localBusinessJsonLd(settings)} />
      <MotionProvider>
        <SiteHeader
          siteName={settings.siteName}
          bookingUrl={bookingHref}
          bookingExternal={!settings.bookingEnabled}
          instagramUrl={settings.instagramUrl}
          services={services.map((s) => ({ slug: s.slug, title: s.title }))}
        />
        <main>{children}</main>
        <SiteFooter settings={settings} />
      </MotionProvider>
    </div>
  );
}
