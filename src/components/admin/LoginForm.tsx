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
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: String(form.get("email") || "").trim(),
          password: form.get("password"),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Invalid email or password");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Could not reach the login server");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-4">
      <label className="grid gap-2 text-sm text-white/75">
        Email
        <input name="email" type="email" required autoComplete="username" className="admin-input" />
      </label>
      <label className="grid gap-2 text-sm text-white/75">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="admin-input"
        />
      </label>
      <button type="submit" disabled={loading} className="admin-btn mt-2">
        {loading ? "Signing in..." : "Sign in"}
      </button>
      {error && <p className="text-sm text-red-300">{error}</p>}
    </form>
  );
}
