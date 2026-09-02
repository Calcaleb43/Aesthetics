import Link from "next/link";
import type { SiteSettings } from "@/lib/content/seed";

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="border-t border-white/10 bg-black text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 md:grid-cols-[1.3fr_1fr_1fr] lg:px-8">
        <div>
          <p className="display text-3xl tracking-tight text-[var(--gold)] md:text-4xl">{settings.siteName}</p>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/65">{settings.tagline}</p>
          <a href={settings.bookingUrl} target="_blank" rel="noreferrer" className="btn btn-gold mt-8">
            Book Now
          </a>
        </div>
        <div>
          <p className="text-[0.68rem] tracking-[0.24em] uppercase text-[var(--gold)]">Visit</p>
          <p className="mt-4 text-sm leading-7 text-white/75">{settings.address}</p>
          <a className="mt-4 block text-sm text-white/75 transition hover:text-[var(--gold)]" href={`mailto:${settings.email}`}>
            {settings.email}
          </a>
          <a className="mt-1 block text-sm text-white/75 transition hover:text-[var(--gold)]" href={`tel:${settings.phone}`}>
            {settings.phone}
          </a>
        </div>
        <div>
          <p className="text-[0.68rem] tracking-[0.24em] uppercase text-[var(--gold)]">Explore</p>
          <div className="mt-4 flex flex-col gap-3 text-sm text-white/75">
            <Link href="/services" className="transition hover:text-[var(--gold)]">
              Services
            </Link>
            <Link href="/book-now" className="transition hover:text-[var(--gold)]">
              Book Now
            </Link>
            <Link href="/contact" className="transition hover:text-[var(--gold)]">
              Contact
            </Link>
            <Link href="/policies" className="transition hover:text-[var(--gold)]">
              Policies
            </Link>
            <a
              href={settings.instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 transition hover:text-[var(--gold)]"
            >
              <InstagramIcon /> Instagram
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-[0.65rem] tracking-[0.22em] uppercase text-[var(--gold)]/60">
        © {new Date().getFullYear()} Aniekanvas Aesthetics · Crafted with intention
      </div>
    </footer>
  );
}
