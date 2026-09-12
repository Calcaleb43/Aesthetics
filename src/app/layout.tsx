import type { Metadata } from "next";
import { Figtree, Syne } from "next/font/google";
import { absoluteUrl, defaultOgImage } from "@/lib/seo";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

const siteDescription =
  "Brows, PMU, laser hair removal, ink-less scar and stretch mark revision, and cold plasma in Toronto.";

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl("/")),
  title: {
    default: "ANIEKANVAS AESTHETICS",
    template: "%s — ANIEKANVAS AESTHETICS",
  },
  description: siteDescription,
  applicationName: "ANIEKANVAS AESTHETICS",
  authors: [{ name: "Aniekanvas Aesthetics" }],
  creator: "Aniekanvas Aesthetics",
  keywords: [
    "Aniekanvas Aesthetics",
    "Toronto aesthetics",
    "ombre brows",
    "PMU",
    "laser hair removal",
    "dark lip neutralization",
    "stretch mark revision",
    "cold plasma",
  ],
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: absoluteUrl("/"),
    siteName: "ANIEKANVAS AESTHETICS",
    title: "ANIEKANVAS AESTHETICS",
    description: siteDescription,
    images: [{ url: defaultOgImage() }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ANIEKANVAS AESTHETICS",
    description: siteDescription,
    images: [defaultOgImage()],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: absoluteUrl("/"),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${syne.variable} ${figtree.variable} antialiased`}>
        <style>{`:root{--font-display:var(--font-syne),Syne,sans-serif;--font-body:var(--font-figtree),Figtree,sans-serif}`}</style>
        {children}
      </body>
    </html>
  );
}
