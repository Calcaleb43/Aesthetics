"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";

type TemplateMeta = {
  key: string;
  label: string;
  description: string;
  audience: string;
};

type EmailRow = {
  id: string;
  templateKey: string;
  toEmail: string;
  toName: string | null;
  subject: string;
  status: string;
  providerId: string | null;
  error: string | null;
  appointmentId: string | null;
  inquiryId: string | null;
  createdAt: string;
};

function statusClass(status: string) {
  if (status === "sent") return "text-emerald-300";
  if (status === "failed") return "text-red-300";
  return "text-amber-200";
}

export function EmailHubClient() {
  const [configured, setConfigured] = useState(false);
  const [from, setFrom] = useState<string | null>(null);
  const [studioEmail, setStudioEmail] = useState("");
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [messages, setMessages] = useState<EmailRow[]>([]);
  const [selectedKey, setSelectedKey] = useState("appointment_booked");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [testTo, setTestTo] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      setError("");
      const res = await fetch("/api/admin/email");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load email hub");
        return;
      }
      setConfigured(Boolean(data.configured));
      setFrom(data.from);
      setStudioEmail(data.studioEmail || "");
      setTemplates(data.templates || []);
      setMessages(data.messages || []);
      if (!testTo && data.studioEmail) setTestTo(data.studioEmail);
    });
  }

  async function loadPreview(key: string) {
    setSelectedKey(key);
    const res = await fetch(`/api/admin/email?preview=${encodeURIComponent(key)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Preview failed");
      return;
    }
    setPreviewSubject(data.subject || "");
    setPreviewHtml(data.html || "");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (templates.length) void loadPreview(selectedKey || templates[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]);

  async function onTest(e: FormEvent) {
    e.preventDefault();
    setStatus("");
    setError("");
    const res = await fetch("/api/admin/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test", to: testTo || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Test send failed");
      return;
    }
    setStatus(`Test email ${data.status}${data.providerId ? ` · ${data.providerId}` : ""}`);
    load();
  }

  return (
    <div className="grid gap-6">
      <div className="admin-card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#c6a75e]">Delivery</p>
            <h2 className="mt-1 text-xl text-white">Resend status</h2>
            <p className="mt-2 text-sm text-white/55">
              {configured
                ? "Provider key is set. Transactional emails will send and log here."
                : "RESEND_API_KEY is missing — emails are skipped and logged as skipped."}
            </p>
            <p className="mt-2 text-xs text-white/40">
              From: {from || "not set"} · Studio reply-to: {studioEmail || "—"}
            </p>
          </div>
          <form onSubmit={onTest} className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs text-white/60">
              Send test to
              <input
                className="admin-input min-w-[16rem]"
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="you@studio.com"
              />
            </label>
            <button type="submit" className="admin-btn" disabled={pending || !configured}>
              Send test
            </button>
          </form>
        </div>
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        {status ? <p className="mt-4 text-sm text-[#e8d5a3]">{status}</p> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="admin-card p-4">
          <p className="mb-3 text-[0.62rem] uppercase tracking-[0.18em] text-white/35">Templates</p>
          <ul className="space-y-1">
            {templates.map((t) => (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => void loadPreview(t.key)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    selectedKey === t.key
                      ? "bg-white/10 text-white"
                      : "text-white/65 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="block font-medium">{t.label}</span>
                  <span className="mt-0.5 block text-[0.65rem] uppercase tracking-[0.12em] text-white/35">
                    {t.audience}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-card overflow-hidden">
          <div className="border-b border-white/10 px-5 py-4">
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#c6a75e]">Preview</p>
            <p className="mt-1 text-sm text-white/80">{previewSubject || "Select a template"}</p>
            <p className="mt-1 text-xs text-white/40">
              {templates.find((t) => t.key === selectedKey)?.description}
            </p>
          </div>
          <div className="bg-[#f4f1ea] p-3 md:p-5">
            {previewHtml ? (
              <iframe
                title="Email preview"
                className="h-[32rem] w-full rounded-xl border border-black/10 bg-white"
                srcDoc={previewHtml}
              />
            ) : (
              <p className="p-8 text-sm text-black/50">Loading preview…</p>
            )}
          </div>
        </div>
      </div>

      <div className="admin-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#c6a75e]">Message log</p>
            <h2 className="mt-1 text-lg text-white">Recent sends</h2>
          </div>
          <button type="button" className="admin-btn-secondary" onClick={load} disabled={pending}>
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[0.65rem] uppercase tracking-[0.14em] text-white/35">
              <tr>
                <th className="px-5 py-3 font-medium">When</th>
                <th className="px-5 py-3 font-medium">Template</th>
                <th className="px-5 py-3 font-medium">To</th>
                <th className="px-5 py-3 font-medium">Subject</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {messages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-white/45">
                    No email messages logged yet.
                  </td>
                </tr>
              ) : (
                messages.map((row) => (
                  <tr key={row.id} className="border-t border-white/8 align-top">
                    <td className="whitespace-nowrap px-5 py-3 text-white/55">
                      {new Date(row.createdAt).toLocaleString("en-CA")}
                    </td>
                    <td className="px-5 py-3 text-white/70">{row.templateKey}</td>
                    <td className="px-5 py-3 text-white/70">
                      {row.toName ? `${row.toName} · ` : ""}
                      {row.toEmail}
                    </td>
                    <td className="px-5 py-3 text-white/80">
                      {row.subject}
                      {row.error ? <span className="mt-1 block text-xs text-red-300">{row.error}</span> : null}
                    </td>
                    <td className={`px-5 py-3 uppercase tracking-[0.12em] text-[0.65rem] ${statusClass(row.status)}`}>
                      {row.status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
