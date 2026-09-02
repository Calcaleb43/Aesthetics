"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

type NavProps = {
  siteName: string;
  bookingUrl: string;
  instagramUrl: string;
  services: { slug: string; title: string }[];
};

export function SiteHeader({ siteName, bookingUrl, instagramUrl, services }: NavProps) {
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 lg:gap-4 lg:px-8">
        <Link
          href="/"
          className="min-w-0 truncate text-[0.72rem] font-semibold tracking-[0.14em] transition hover:text-[var(--gold-deep)] sm:text-[0.82rem] sm:tracking-[0.22em]"
        >
          {siteName}
        </Link>

        <nav className="hidden items-center gap-6 text-[0.72rem] tracking-[0.12em] uppercase lg:flex">
          <Link href="/" className="nav-link">
            Home
          </Link>
          <Link href="/book-now" className="nav-link">
            Book Now
          </Link>
          <div
            className="relative"
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <button className="nav-link" type="button" aria-expanded={servicesOpen}>
              Services
            </button>
            {servicesOpen && (
              <div className="absolute left-0 top-full z-50 pt-3">
                <div className="min-w-72 border border-black/10 bg-white py-2 shadow-[var(--shadow)]">
                  <Link
                    href="/services"
                    className="block px-4 py-2.5 text-[0.68rem] tracking-[0.14em] text-[var(--gold-deep)] transition hover:bg-[var(--bg-deep)]"
                    onClick={() => setServicesOpen(false)}
                  >
                    All services
                  </Link>
                  {services.map((service) => (
                    <Link
                      key={service.slug}
                      href={`/services/${service.slug}`}
                      className="block px-4 py-2.5 text-[0.78rem] normal-case tracking-normal text-[var(--ink)] transition hover:bg-[var(--bg-deep)] hover:text-[var(--gold-deep)]"
                      onClick={() => setServicesOpen(false)}
                    >
                      {service.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Link href="/faqs" className="nav-link">
            FAQs
          </Link>
          <Link href="/policies" className="nav-link">
            Policies
          </Link>
          <Link href="/care" className="nav-link">
            Care
          </Link>
          <Link href="/about" className="nav-link">
            About
          </Link>
          <a
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
            className="transition hover:text-[var(--gold-deep)]"
          >
            <InstagramIcon />
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <a href={bookingUrl} target="_blank" rel="noreferrer" className="btn btn-gold hidden sm:inline-flex">
            Book Now
          </a>
          <button
            type="button"
            className="inline-flex rounded-full border border-black/15 p-2.5 transition hover:border-[var(--gold)] hover:text-[var(--gold-deep)] lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-black/5 bg-white px-5 py-6 lg:hidden">
          <div className="flex flex-col gap-4 text-sm uppercase tracking-[0.14em]">
            <Link href="/" onClick={() => setOpen(false)}>
              Home
            </Link>
            <Link href="/book-now" onClick={() => setOpen(false)}>
              Book Now
            </Link>
            <p className="pt-1 text-[0.65rem] text-[var(--gold-deep)]">Services</p>
            {services.map((service) => (
              <Link
                key={service.slug}
                href={`/services/${service.slug}`}
                onClick={() => setOpen(false)}
                className="pl-2 normal-case tracking-normal text-[var(--ink-soft)]"
              >
                {service.title}
              </Link>
            ))}
            <Link href="/faqs" onClick={() => setOpen(false)}>
              FAQs
            </Link>
            <Link href="/policies" onClick={() => setOpen(false)}>
              Policies
            </Link>
            <Link href="/care" onClick={() => setOpen(false)}>
              Care
            </Link>
            <Link href="/about" onClick={() => setOpen(false)}>
              About
            </Link>
            <a
              href={instagramUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 normal-case tracking-normal"
            >
              <InstagramIcon />
              Instagram
            </a>
            <a href={bookingUrl} target="_blank" rel="noreferrer" className="btn btn-gold mt-2 w-fit">
              Book Now
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
