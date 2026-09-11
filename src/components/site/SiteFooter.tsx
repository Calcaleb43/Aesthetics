import Link from "next/link";
import type { SiteSettings } from "@/lib/content/seed";
import { SiteLogo } from "@/components/site/SiteLogo";

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
  const bookHref = settings.bookingEnabled ? "/book-now" : settings.bookingUrl;
  const bookExternal = !settings.bookingEnabled;

  return (
    <footer className="border-t border-white/10 bg-black text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 md:grid-cols-[1.3fr_1fr_1fr] lg:px-8">
        <div>
          <Link href="/" aria-label={settings.siteName} className="inline-block max-w-[16rem]">
            <SiteLogo className="h-14 w-auto max-w-full md:h-16" />
          </Link>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/65">{settings.tagline}</p>
          {bookExternal ? (
            <a href={bookHref} target="_blank" rel="noreferrer" className="btn btn-gold mt-8">
              Book Now
            </a>
          ) : (
            <Link href={bookHref} className="btn btn-gold mt-8">
              Book Now
            </Link>
          )}
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
            <Link href="/about" className="transition hover:text-[var(--gold)]">
              About
            </Link>
            <Link href="/care" className="transition hover:text-[var(--gold)]">
              Care
            </Link>
            <Link href="/faqs" className="transition hover:text-[var(--gold)]">
              FAQs
            </Link>
            <Link href="/contact" className="transition hover:text-[var(--gold)]">
              Contact
            </Link>
            <Link href="/policies" className="transition hover:text-[var(--gold)]">
              Policies
            </Link>
            <Link href="/book-now" className="transition hover:text-[var(--gold)]">
              Book Now
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
      <div className="border-t border-white/10 px-5 py-5 text-center text-[0.6rem] leading-5 tracking-[0.12em] uppercase text-[var(--gold)]/60 sm:text-[0.65rem] sm:tracking-[0.22em]">
        © {new Date().getFullYear()} Aniekanvas Aesthetics · Crafted with intention
      </div>
    </footer>
  );
}
