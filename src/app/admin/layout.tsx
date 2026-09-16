import type { Metadata, Viewport } from "next";
import { AdminPwaRegister } from "@/components/admin/AdminPwaRegister";

export const metadata: Metadata = {
  applicationName: "Aniekanvas Admin",
  title: {
    default: "Admin",
    template: "%s — Anie Admin",
  },
  description: "Aniekanvas Aesthetics CMS",
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Anie Admin",
  },
  icons: {
    icon: [
      { url: "/admin/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/admin/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/admin/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f0f0f" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0f" },
  ],
  colorScheme: "dark",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="admin-root min-h-screen bg-[#0f0f0f] text-[#f5f1eb]"
      style={{ fontFamily: "var(--font-figtree), sans-serif" }}
    >
      <AdminPwaRegister />
      {children}
    </div>
  );
}
