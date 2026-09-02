import { LoginForm } from "@/components/admin/LoginForm";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session) redirect("/admin");

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-xs uppercase tracking-[0.22em] text-white/50">Aniekanvas CMS</p>
      <h1 className="mt-3 text-4xl">Admin sign in</h1>
      <p className="mt-3 text-sm text-white/60">
        Manage pages, services, FAQs, care guides, media, and inquiries.
      </p>
      <LoginForm />
    </div>
  );
}
