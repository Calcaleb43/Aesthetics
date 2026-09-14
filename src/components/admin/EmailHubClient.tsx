"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";

type SystemTemplate = {
  key: string;
  label: string;
  description: string;
  audience: string;
};

type CustomTemplate = {
  slug: string;
  name: string;
  description: string;
  subject: string;
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
  campaignId: string | null;
  createdAt: string;
};

type ClientHit = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

type Tab = "compose" | "bulk" | "system" | "log";

function statusClass(status: string) {
  if (status === "sent") return "text-emerald-300";
  if (status === "failed") return "text-red-300";
  return "text-amber-200";
}

export function EmailHubClient() {
  const [tab, setTab] = useState<Tab>("compose");
  const [configured, setConfigured] = useState(false);
  const [from, setFrom] = useState<string | null>(null);
  const [studioEmail, setStudioEmail] = useState("");
  const [clientCount, setClientCount] = useState(0);
  const [systemTemplates, setSystemTemplates] = useState<SystemTemplate[]>([]);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [messages, setMessages] = useState<EmailRow[]>([]);
  const [variables, setVariables] = useState<{ key: string; label: string }[]>([]);

  const [selectedSystemKey, setSelectedSystemKey] = useState("appointment_booked");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");

  const [composeClientQuery, setComposeClientQuery] = useState("");
  const [composeHits, setComposeHits] = useState<ClientHit[]>([]);
  const [composeClient, setComposeClient] = useState<ClientHit | null>(null);
  const [composeTemplate, setComposeTemplate] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  const [bulkQuery, setBulkQuery] = useState("");
  const [bulkHits, setBulkHits] = useState<ClientHit[]>([]);
  const [bulkSelected, setBulkSelected] = useState<Record<string, ClientHit>>({});
  const [bulkAll, setBulkAll] = useState(false);
  const [bulkTemplate, setBulkTemplate] = useState("");
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkBody, setBulkBody] = useState("");

  const [testTo, setTestTo] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  const bulkCount = useMemo(
    () => (bulkAll ? clientCount : Object.keys(bulkSelected).length),
    [bulkAll, bulkSelected, clientCount],
  );

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
      setClientCount(data.clientCount || 0);
      setSystemTemplates(data.systemTemplates || []);
      setCustomTemplates(data.customTemplates || []);
      setMessages(data.messages || []);
      setVariables(data.variables || []);
      if (!testTo && data.studioEmail) setTestTo(data.studioEmail);
      if (!composeTemplate && data.customTemplates?.[0]?.slug) {
        setComposeTemplate(data.customTemplates[0].slug);
      }
      if (!bulkTemplate && data.customTemplates?.[0]?.slug) {
        setBulkTemplate(data.customTemplates[0].slug);
      }
    });
  }

  async function loadSystemPreview(key: string) {
    setSelectedSystemKey(key);
    const res = await fetch(`/api/admin/email?preview=${encodeURIComponent(key)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Preview failed");
      return;
    }
    setPreviewSubject(data.subject || "");
    setPreviewHtml(data.html || "");
  }

  async function searchClients(q: string, setter: (hits: ClientHit[]) => void) {
    if (q.trim().length < 2) {
      setter([]);
      return;
    }
    const res = await fetch(
      `/api/admin/clients?q=${encodeURIComponent(q.trim())}&pageSize=8&page=1`,
    );
    const data = await res.json();
    if (!res.ok) return;
    setter(
      (data.clients || []).map((c: ClientHit) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
      })),
    );
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (systemTemplates.length) void loadSystemPreview(selectedSystemKey || systemTemplates[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemTemplates]);

  useEffect(() => {
    const t = window.setTimeout(() => void searchClients(composeClientQuery, setComposeHits), 250);
    return () => window.clearTimeout(t);
  }, [composeClientQuery]);

  useEffect(() => {
    const t = window.setTimeout(() => void searchClients(bulkQuery, setBulkHits), 250);
    return () => window.clearTimeout(t);
  }, [bulkQuery]);

  function applyTemplate(slug: string, which: "compose" | "bulk") {
    const tpl = customTemplates.find((t) => t.slug === slug);
    if (!tpl) return;
    if (which === "compose") {
      setComposeTemplate(slug);
      setComposeSubject(tpl.subject);
    } else {
      setBulkTemplate(slug);
      setBulkSubject(tpl.subject);
    }
  }

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
    setStatus(`Test email ${data.status}`);
    load();
  }

  async function onCompose(e: FormEvent) {
    e.preventDefault();
    setStatus("");
    setError("");
    if (!composeClient) {
      setError("Select a client");
      return;
    }
    const res = await fetch("/api/admin/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "compose",
        clientId: composeClient.id,
        templateSlug: composeTemplate || null,
        subject: composeSubject || null,
        body: composeBody || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Compose send failed");
      return;
    }
    setStatus(`Sent to ${composeClient.email} · ${data.status}`);
    setComposeBody("");
    load();
  }

  async function onBulk(e: FormEvent) {
    e.preventDefault();
    setStatus("");
    setError("");
    if (!bulkAll && !Object.keys(bulkSelected).length) {
      setError("Select at least one client or choose all active clients");
      return;
    }
    if (
      !window.confirm(
        `Send to ${bulkCount} client${bulkCount === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }
    const res = await fetch("/api/admin/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "bulk",
        allActiveClients: bulkAll || undefined,
        clientIds: bulkAll ? undefined : Object.keys(bulkSelected),
        templateSlug: bulkTemplate || null,
        subject: bulkSubject || null,
        body: bulkBody || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Bulk send failed");
      return;
    }
    setStatus(
      `Bulk campaign ${data.campaignId?.slice(0, 8)}… · ${data.sent} sent · ${data.skipped} skipped · ${data.failed} failed`,
    );
    load();
  }

  async function previewCompose() {
    setError("");
    const res = await fetch("/api/admin/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "preview",
        templateSlug: composeTemplate || null,
        subject: composeSubject || null,
        body: composeBody || null,
        name: composeClient?.name,
        email: composeClient?.email,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Preview failed");
      return;
    }
    setPreviewSubject(data.subject || "");
    setPreviewHtml(data.html || "");
    setTab("system");
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "compose", label: "Compose" },
    { id: "bulk", label: "Bulk" },
    { id: "system", label: "Templates" },
    { id: "log", label: "Log" },
  ];

  return (
    <div className="grid gap-6">
      <div className="admin-card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#c6a75e]">Delivery</p>
            <h2 className="mt-1 text-xl text-white">Email hub</h2>
            <p className="mt-2 text-sm text-white/55">
              {configured
                ? "Resend is configured. Compose, bulk, and transactional sends log here."
                : "RESEND_API_KEY missing — sends are skipped and logged."}
            </p>
            <p className="mt-2 text-xs text-white/40">
              From: {from || "not set"} · Reply-to: {studioEmail || "—"} · Active clients: {clientCount}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Link href="/admin/email/templates" className="admin-btn-secondary">
              Edit templates
            </Link>
            <form onSubmit={onTest} className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-xs text-white/60">
                Test to
                <input
                  className="admin-input min-w-[14rem]"
                  type="email"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                />
              </label>
              <button type="submit" className="admin-btn" disabled={pending || !configured}>
                Send test
              </button>
            </form>
          </div>
        </div>
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        {status ? <p className="mt-4 text-sm text-[#e8d5a3]">{status}</p> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.14em] transition ${
              tab === t.id ? "bg-[#c6a75e] text-black" : "border border-white/15 text-white/60 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "compose" ? (
        <form onSubmit={onCompose} className="admin-card grid gap-4 p-5 md:p-6">
          <div>
            <h3 className="text-lg text-white">Compose to a client</h3>
            <p className="mt-1 text-sm text-white/50">
              Pick a client, optional published template, then send a personalized message.
            </p>
          </div>

          <label className="grid gap-1 text-sm text-white/70">
            Find client
            <input
              className="admin-input"
              value={composeClientQuery}
              onChange={(e) => {
                setComposeClientQuery(e.target.value);
                setComposeClient(null);
              }}
              placeholder="Name, email, or phone"
            />
          </label>
          {composeHits.length ? (
            <ul className="space-y-1 rounded-lg border border-white/10 p-2">
              {composeHits.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
                    onClick={() => {
                      setComposeClient(c);
                      setComposeClientQuery(`${c.name} · ${c.email}`);
                      setComposeHits([]);
                    }}
                  >
                    {c.name} · {c.email}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {composeClient ? (
            <p className="text-sm text-[#e8d5a3]">
              To: {composeClient.name} &lt;{composeClient.email}&gt;
            </p>
          ) : null}

          <label className="grid gap-1 text-sm text-white/70">
            Template
            <select
              className="admin-input"
              value={composeTemplate}
              onChange={(e) => applyTemplate(e.target.value, "compose")}
            >
              <option value="">Custom (use subject/body below)</option>
              {customTemplates.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm text-white/70">
            Subject override (optional)
            <input
              className="admin-input"
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
              placeholder="Leave blank to use template subject"
            />
          </label>

          <label className="grid gap-1 text-sm text-white/70">
            Body override (optional)
            <textarea
              className="admin-input"
              rows={10}
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              placeholder="Leave blank to use template body. Supports {{name}}, {{siteName}}, …"
            />
          </label>

          <p className="text-xs text-white/35">
            Variables: {variables.map((v) => `{{${v.key}}}`).join(" · ")}
          </p>

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="admin-btn" disabled={!configured || !composeClient}>
              Send email
            </button>
            <button type="button" className="admin-btn-secondary" onClick={() => void previewCompose()}>
              Preview
            </button>
          </div>
        </form>
      ) : null}

      {tab === "bulk" ? (
        <form onSubmit={onBulk} className="admin-card grid gap-4 p-5 md:p-6">
          <div>
            <h3 className="text-lg text-white">Bulk send</h3>
            <p className="mt-1 text-sm text-white/50">
              Up to 200 recipients per batch. Banned clients are excluded. Each send is logged.
            </p>
          </div>

          <label className="flex items-center gap-3 text-sm text-white/75">
            <input
              type="checkbox"
              checked={bulkAll}
              onChange={(e) => {
                setBulkAll(e.target.checked);
                if (e.target.checked) setBulkSelected({});
              }}
            />
            All active clients ({Math.min(clientCount, 200)} max)
          </label>

          {!bulkAll ? (
            <>
              <label className="grid gap-1 text-sm text-white/70">
                Add clients
                <input
                  className="admin-input"
                  value={bulkQuery}
                  onChange={(e) => setBulkQuery(e.target.value)}
                  placeholder="Search to add…"
                />
              </label>
              {bulkHits.length ? (
                <ul className="space-y-1 rounded-lg border border-white/10 p-2">
                  {bulkHits.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full rounded-md px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
                        onClick={() => {
                          setBulkSelected((prev) => ({ ...prev, [c.id]: c }));
                          setBulkQuery("");
                          setBulkHits([]);
                        }}
                      >
                        {c.name} · {c.email}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {Object.values(bulkSelected).length ? (
                <ul className="flex flex-wrap gap-2">
                  {Object.values(bulkSelected).map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-white/30"
                        onClick={() =>
                          setBulkSelected((prev) => {
                            const next = { ...prev };
                            delete next[c.id];
                            return next;
                          })
                        }
                      >
                        {c.name} ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}

          <p className="text-sm text-[#e8d5a3]">Recipients: {bulkCount}</p>

          <label className="grid gap-1 text-sm text-white/70">
            Template
            <select
              className="admin-input"
              value={bulkTemplate}
              onChange={(e) => applyTemplate(e.target.value, "bulk")}
            >
              <option value="">Custom (use subject/body below)</option>
              {customTemplates.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm text-white/70">
            Subject override (optional)
            <input
              className="admin-input"
              value={bulkSubject}
              onChange={(e) => setBulkSubject(e.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm text-white/70">
            Body override (optional)
            <textarea
              className="admin-input"
              rows={10}
              value={bulkBody}
              onChange={(e) => setBulkBody(e.target.value)}
            />
          </label>

          <button type="submit" className="admin-btn w-fit" disabled={!configured || bulkCount === 0}>
            Send bulk email
          </button>
        </form>
      ) : null}

      {tab === "system" ? (
        <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="admin-card p-4">
            <p className="mb-3 text-[0.62rem] uppercase tracking-[0.18em] text-white/35">
              System (transactional)
            </p>
            <ul className="space-y-1">
              {systemTemplates.map((t) => (
                <li key={t.key}>
                  <button
                    type="button"
                    onClick={() => void loadSystemPreview(t.key)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      selectedSystemKey === t.key
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
            <Link
              href="/admin/email/templates"
              className="mt-4 inline-block text-xs uppercase tracking-[0.14em] text-[#c6a75e] hover:underline"
            >
              Edit reminder & thank-you copy →
            </Link>
            <p className="mt-3 text-[0.7rem] leading-5 text-white/40">
              Booking / cancel / inquiry layouts are fixed. Reminder and thank-you subject &amp; intro are
              editable under Email templates (keep Published).
            </p>
          </div>

          <div className="admin-card overflow-hidden">
            <div className="border-b border-white/10 px-5 py-4">
              <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#c6a75e]">Preview</p>
              <p className="mt-1 text-sm text-white/80">{previewSubject || "Select a template"}</p>
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
      ) : null}

      {tab === "log" ? (
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
              <thead className="text-[0.62rem] uppercase tracking-[0.14em] text-white/35">
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
                      <td className="px-5 py-3 text-white/70">
                        {row.templateKey}
                        {row.campaignId ? (
                          <span className="mt-1 block text-[0.65rem] text-white/35">
                            campaign {row.campaignId.slice(0, 8)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-white/70">
                        {row.toName ? `${row.toName} · ` : ""}
                        {row.toEmail}
                      </td>
                      <td className="px-5 py-3 text-white/80">
                        {row.subject}
                        {row.error ? (
                          <span className="mt-1 block text-xs text-red-300">{row.error}</span>
                        ) : null}
                      </td>
                      <td
                        className={`px-5 py-3 uppercase tracking-[0.12em] text-[0.65rem] ${statusClass(row.status)}`}
                      >
                        {row.status}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
