"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";

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
  bookingExternal?: boolean;
  instagramUrl: string;
  services: { slug: string; title: string }[];
};

const PRIMARY_LINKS = [
  { href: "/about", label: "About" },
  { href: "/care", label: "Care" },
  { href: "/faqs", label: "FAQs" },
  { href: "/contact", label: "Contact" },
] as const;

function linkActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ siteName, bookingUrl, bookingExternal = true, instagramUrl, services }: NavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const servicesMenuId = useId();

  useEffect(() => {
    setOpen(false);
    setServicesOpen(false);
    setMobileServicesOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const servicesActive = pathname.startsWith("/services");

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-3 px-5 py-3.5 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-6 lg:px-8 lg:py-4">
        <Link
          href="/"
          className="min-w-0 justify-self-start truncate text-[0.7rem] font-semibold tracking-[0.14em] transition hover:text-[var(--gold-deep)] sm:text-[0.78rem] sm:tracking-[0.18em]"
        >
          {siteName}
        </Link>

        <nav
          className="hidden items-center justify-center gap-0.5 text-[0.68rem] tracking-[0.14em] uppercase lg:flex"
          aria-label="Primary"
        >
          <div
            className="relative"
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <button
              className={`nav-link inline-flex items-center gap-1 px-3 py-2 ${servicesActive ? "is-active" : ""}`}
              type="button"
              aria-expanded={servicesOpen}
              aria-controls={servicesMenuId}
              onClick={() => setServicesOpen((v) => !v)}
            >
              Services
              <ChevronDown
                size={13}
                className={`transition-transform duration-200 ${servicesOpen ? "rotate-180" : ""}`}
              />
            </button>
            <div
              id={servicesMenuId}
              hidden={!servicesOpen}
              className="absolute left-1/2 top-full z-50 w-72 -translate-x-1/2 pt-3"
            >
              <div className="border border-black/10 bg-white py-2 shadow-[var(--shadow)]">
                <Link
                  href="/services"
                  className="block px-4 py-2.5 text-[0.68rem] tracking-[0.14em] text-[var(--gold-deep)] transition hover:bg-[var(--bg-deep)]"
                >
                  View all services
                </Link>
                <div className="mx-4 my-1 h-px bg-[var(--line)]" />
                {services.map((service) => (
                  <Link
                    key={service.slug}
                    href={`/services/${service.slug}`}
                    className={`block px-4 py-2.5 text-[0.78rem] normal-case tracking-normal transition hover:bg-[var(--bg-deep)] hover:text-[var(--gold-deep)] ${
                      pathname === `/services/${service.slug}`
                        ? "text-[var(--gold-deep)]"
                        : "text-[var(--ink)]"
                    }`}
                  >
                    {service.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {PRIMARY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link px-3 py-2 ${linkActive(pathname, link.href) ? "is-active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-self-end gap-2 sm:gap-3">
          <a
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
            className="hidden text-[var(--ink-soft)] transition hover:text-[var(--gold-deep)] lg:inline-flex"
          >
            <InstagramIcon />
          </a>
          {bookingExternal ? (
            <a href={bookingUrl} target="_blank" rel="noreferrer" className="btn btn-gold !min-h-10 !px-4 !text-[0.62rem] sm:!px-5">
              Book Now
            </a>
          ) : (
            <Link href={bookingUrl} className="btn btn-gold !min-h-10 !px-4 !text-[0.62rem] sm:!px-5">
              Book Now
            </Link>
          )}
          <button
            type="button"
            className="inline-flex rounded-full border border-black/15 p-2.5 transition hover:border-[var(--gold)] hover:text-[var(--gold-deep)] lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-black/5 bg-white lg:hidden">
          <nav className="flex flex-col px-5 py-5" aria-label="Mobile">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className={`mobile-nav-link ${pathname === "/" ? "is-active" : ""}`}
            >
              Home
            </Link>

            <button
              type="button"
              className={`mobile-nav-link flex w-full items-center justify-between ${servicesActive ? "is-active" : ""}`}
              aria-expanded={mobileServicesOpen}
              onClick={() => setMobileServicesOpen((v) => !v)}
            >
              Services
              <ChevronDown
                size={16}
                className={`transition-transform duration-200 ${mobileServicesOpen ? "rotate-180" : ""}`}
              />
            </button>
            {mobileServicesOpen && (
              <div className="mb-2 ml-3 flex flex-col border-l border-[var(--line)] pl-4">
                <Link
                  href="/services"
                  onClick={() => setOpen(false)}
                  className="py-2.5 text-[0.78rem] tracking-[0.08em] text-[var(--gold-deep)]"
                >
                  View all
                </Link>
                {services.map((service) => (
                  <Link
                    key={service.slug}
                    href={`/services/${service.slug}`}
                    onClick={() => setOpen(false)}
                    className={`py-2.5 text-[0.9rem] normal-case tracking-normal ${
                      pathname === `/services/${service.slug}`
                        ? "text-[var(--gold-deep)]"
                        : "text-[var(--ink-soft)]"
                    }`}
                  >
                    {service.title}
                  </Link>
                ))}
              </div>
            )}

            {PRIMARY_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`mobile-nav-link ${linkActive(pathname, link.href) ? "is-active" : ""}`}
              >
                {link.label}
              </Link>
            ))}

            <Link
              href="/policies"
              onClick={() => setOpen(false)}
              className={`mobile-nav-link ${linkActive(pathname, "/policies") ? "is-active" : ""}`}
            >
              Policies
            </Link>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-5">
            {bookingExternal ? (
              <a href={bookingUrl} target="_blank" rel="noreferrer" className="btn btn-gold">
                Book Now
              </a>
            ) : (
              <Link href={bookingUrl} onClick={() => setOpen(false)} className="btn btn-gold">
                Book Now
              </Link>
            )}
              <a
                href={instagramUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 text-sm text-[var(--ink-soft)]"
              >
                <InstagramIcon /> Instagram
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
