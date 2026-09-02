"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Invalid credentials");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-4">
      <label className="grid gap-2 text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          defaultValue="admin@aniekanvas.com"
          className="rounded border border-white/15 bg-black/30 px-4 py-3"
        />
      </label>
      <label className="grid gap-2 text-sm">
        Password
        <input
          name="password"
          type="password"
          required
          className="rounded border border-white/15 bg-black/30 px-4 py-3"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-[#f5f1eb] px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-black"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
      {error && <p className="text-sm text-red-300">{error}</p>}
    </form>
  );
}
