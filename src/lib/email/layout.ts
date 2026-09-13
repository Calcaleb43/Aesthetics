import { siteUrl } from "@/lib/booking/stripe";

export type StudioEmailContext = {
  siteName: string;
  email: string;
  phone: string;
  address: string;
  instagramUrl?: string;
  bookingUrl?: string;
};

export const DEFAULT_STUDIO: StudioEmailContext = {
  siteName: "Aniekanvas Aesthetics",
  email: "Aniekanvas@gmail.com",
  phone: "(647) 901-8817",
  address: "146 Thirtieth Street, Suite 218, Toronto, Ontario, M8W 3C4",
  instagramUrl: "https://www.instagram.com/aniekanvas_aesthetics/",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailButton(label: string, href: string, variant: "gold" | "ghost" = "gold") {
  const styles =
    variant === "gold"
      ? "background:#c6a75e;color:#111111;border:1px solid #c6a75e;"
      : "background:transparent;color:#111111;border:1px solid #d6d0c4;";
  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;margin:0 8px 8px 0;border-radius:999px;text-decoration:none;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;${styles}">${escapeHtml(label)}</a>`;
}

export function emailDetailRows(rows: { label: string; value: string }[]) {
  return rows
    .filter((r) => r.value.trim())
    .map(
      (r) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #ece7de;width:34%;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#9a7a32;vertical-align:top">${escapeHtml(r.label)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #ece7de;font-size:15px;color:#1a1a1a;vertical-align:top">${escapeHtml(r.value)}</td>
      </tr>`,
    )
    .join("");
}

/** Branded transactional email shell — table-based for client compatibility. */
export function renderEmailLayout(input: {
  studio?: StudioEmailContext;
  preheader?: string;
  eyebrow?: string;
  title: string;
  introHtml: string;
  detailRows?: { label: string; value: string }[];
  bodyHtml?: string;
  ctaHtml?: string;
}) {
  const studio = input.studio || DEFAULT_STUDIO;
  const base = siteUrl();
  const preheader = input.preheader || "";
  const details = input.detailRows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;border-collapse:collapse">${emailDetailRows(input.detailRows)}</table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ea;color:#111111;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid #e7e1d5;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#c6a75e,#e8d5a3,#c6a75e);"></td>
          </tr>
          <tr>
            <td style="padding:32px 28px 8px;font-family:Georgia,'Times New Roman',serif;">
              <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#9a7a32;">${escapeHtml(studio.siteName)}</p>
              ${input.eyebrow ? `<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#9a7a32;">${escapeHtml(input.eyebrow)}</p>` : ""}
              <h1 style="margin:0 0 16px;font-size:28px;line-height:1.25;font-weight:normal;color:#111111;">${escapeHtml(input.title)}</h1>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#333333;">${input.introHtml}</div>
              ${details}
              ${input.bodyHtml ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#333333;margin-top:16px;">${input.bodyHtml}</div>` : ""}
              ${input.ctaHtml ? `<div style="margin-top:28px;font-family:Arial,Helvetica,sans-serif;">${input.ctaHtml}</div>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#777777;border-top:1px solid #ece7de;">
              <p style="margin:0 0 6px;color:#9a7a32;letter-spacing:0.14em;text-transform:uppercase;font-size:10px;">Studio</p>
              <p style="margin:0;">${escapeHtml(studio.address)}</p>
              <p style="margin:6px 0 0;">
                <a href="tel:${escapeHtml(studio.phone.replace(/[^\d+]/g, ""))}" style="color:#777777;text-decoration:none;">${escapeHtml(studio.phone)}</a>
                ·
                <a href="mailto:${escapeHtml(studio.email)}" style="color:#777777;text-decoration:none;">${escapeHtml(studio.email)}</a>
              </p>
              <p style="margin:14px 0 0;">
                <a href="${escapeHtml(base)}/policies" style="color:#9a7a32;text-decoration:none;margin-right:12px;">Policies</a>
                <a href="${escapeHtml(base)}/care" style="color:#9a7a32;text-decoration:none;margin-right:12px;">Pre &amp; aftercare</a>
                <a href="${escapeHtml(base)}/book-now" style="color:#9a7a32;text-decoration:none;">Book</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export { escapeHtml };
