import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { SETTINGS_SECTIONS } from "@/lib/admin/settings-sections";
import { paymentProviderConfigured, paymentProviderLabel } from "@/lib/booking/payments";
import { getSettings } from "@/lib/content/queries";
import type { PaymentProvider } from "@/lib/content/seed";

export default async function AdminSettingsIndexPage() {
  const settings = await getSettings();
  const provider = settings.paymentProvider as PaymentProvider;
  const paymentReady = paymentProviderConfigured(provider);

  return (
    <AdminShell
      title="Site Settings"
      description="Choose a section to edit. Each section saves on its own."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SETTINGS_SECTIONS.map((section) => {
          const meta =
            section.id === "booking"
              ? `${paymentProviderLabel(provider)} · ${paymentReady ? "env ready" : "env missing"}`
              : null;
          return (
            <Link
              key={section.id}
              href={section.href}
              className="admin-card block p-5 transition hover:bg-white/[0.07]"
            >
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-white/40">Section</p>
              <h2 className="mt-2 text-lg font-semibold text-white">{section.title}</h2>
              <p className="mt-2 text-sm text-white/55">{section.summary}</p>
              {meta ? <p className="mt-3 text-xs text-[#c6a75e]">{meta}</p> : null}
              <p className="mt-4 text-xs uppercase tracking-[0.12em] text-white/40">Open →</p>
            </Link>
          );
        })}
      </div>
    </AdminShell>
  );
}
