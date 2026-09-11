import type { Metadata } from "next";
import { Figtree, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  title: {
    default: "ANIEKANVAS AESTHETICS",
    template: "%s — ANIEKANVAS AESTHETICS",
  },
  description:
    "Brows, PMU, laser hair removal, ink-less scar and stretch mark revision, and cold plasma in Toronto.",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
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
