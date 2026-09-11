import { LoginForm } from "@/components/admin/LoginForm";
import { SiteLogo } from "@/components/site/SiteLogo";
import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session) redirect("/admin");

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-[#0f0f0f]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-3.5 lg:px-8">
          <Link href="/" className="inline-flex min-w-0 items-center gap-3" aria-label="Aniekanvas Aesthetics">
            <SiteLogo className="h-9 w-auto max-w-[9.5rem]" />
            <span className="text-sm font-semibold tracking-[0.08em] text-white">Content Management</span>
          </Link>
          <Link
            href="/"
            className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/65 transition hover:border-white/30 hover:text-white"
          >
            View site
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-16">
        <p className="text-xs uppercase tracking-[0.22em] text-white/50">Admin access</p>
        <h1 className="mt-3 text-4xl">Sign in</h1>
        <p className="mt-3 text-sm text-white/60">
          Manage pages, services, FAQs, care guides, media, and inquiries.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
