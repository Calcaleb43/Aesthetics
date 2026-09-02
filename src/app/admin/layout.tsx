export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#111] text-[#f5f1eb]" style={{ fontFamily: "var(--font-figtree), sans-serif" }}>
      {children}
    </div>
  );
}
