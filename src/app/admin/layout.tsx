export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-root min-h-screen bg-[#0f0f0f] text-[#f5f1eb]" style={{ fontFamily: "var(--font-figtree), sans-serif" }}>
      {children}
    </div>
  );
}
