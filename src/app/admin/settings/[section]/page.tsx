import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminEditor } from "@/components/admin/AdminEditor";
import { getSettingsSection, type SettingsSectionId } from "@/lib/admin/settings-sections";
import { paymentEnvStatus, paymentProviderConfigured, paymentProviderLabel } from "@/lib/booking/payments";
import { getSettings } from "@/lib/content/queries";
import type { PaymentProvider } from "@/lib/content/seed";

export function generateStaticParams() {
  return [
    { section: "brand" },
    { section: "booking" },
    { section: "reviews" },
    { section: "media" },
    { section: "copy" },
  ] satisfies { section: SettingsSectionId }[];
}

export default async function AdminSettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section: sectionId } = await params;
  const section = getSettingsSection(sectionId);
  if (!section) notFound();

  const settings = await getSettings();
  const envStatus = paymentEnvStatus();
  const provider = settings.paymentProvider as PaymentProvider;
  const ready = paymentProviderConfigured(provider);

  const description =
    section.id === "booking"
      ? [
          `Active: ${paymentProviderLabel(provider)} · ${ready ? "Env credentials ready" : "Env credentials missing"}`,
          `API keys stay in server env — never stored here.`,
          `Stripe: STRIPE_SECRET_KEY ${envStatus.stripe.secretKey ? "✓" : "✗"} · STRIPE_WEBHOOK_SECRET ${envStatus.stripe.webhookSecret ? "✓" : "✗"} · NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ${envStatus.stripe.publishableKey ? "✓" : "✗"}`,
        ].join("\n")
      : section.description;

  return (
    <AdminShell title={section.title} description={section.summary}>
      <div className="mb-5">
        <Link
          href="/admin/settings"
          className="text-xs uppercase tracking-[0.14em] text-white/45 transition hover:text-[#c6a75e]"
        >
          ← All settings
        </Link>
      </div>

      <nav className="mb-6 flex flex-wrap gap-2">
        {[
          { id: "brand", href: "/admin/settings/brand", label: "Brand" },
          { id: "booking", href: "/admin/settings/booking", label: "Booking" },
          { id: "reviews", href: "/admin/settings/reviews", label: "Reviews" },
          { id: "media", href: "/admin/settings/media", label: "Media" },
          { id: "copy", href: "/admin/settings/copy", label: "Copy" },
        ].map((item) => {
          const active = item.id === section.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`rounded-full border px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] transition ${
                active
                  ? "border-[#c6a75e] bg-[#c6a75e]/15 text-[#c6a75e]"
                  : "border-white/15 text-white/55 hover:border-white/30 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="admin-card p-6 md:p-8">
        {description ? (
          <p className="mb-6 whitespace-pre-wrap text-xs leading-5 text-white/45">{description}</p>
        ) : null}
        <AdminEditor
          identityKey={`settings-${section.id}`}
          endpoint="/api/admin/settings"
          initial={settings as unknown as Record<string, unknown>}
          fields={section.fields}
        />
      </div>
    </AdminShell>
  );
}
