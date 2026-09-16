/** Twilio SMS helper — skipped when credentials are unset. */

export function hasSmsProvider() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
}

function normalizeE164(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (phone.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

export type SendSmsResult = {
  skipped: boolean;
  status: "sent" | "skipped" | "failed";
  sid?: string | null;
  error?: string;
};

export async function sendSms(input: {
  to: string | null | undefined;
  body: string;
}): Promise<SendSmsResult> {
  const to = normalizeE164(input.to);
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from || !to) {
    console.info("[sms] skipped", { to: input.to, reason: !to ? "bad_phone" : "unset_twilio" });
    return { skipped: true, status: "skipped" };
  }

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({ To: to, From: from, Body: input.body.slice(0, 1500) });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok) {
      console.error("[sms] failed", data);
      return { skipped: false, status: "failed", error: data.message || `HTTP ${res.status}` };
    }
    return { skipped: false, status: "sent", sid: data.sid || null };
  } catch (err) {
    console.error("[sms] error", err);
    return { skipped: false, status: "failed", error: err instanceof Error ? err.message : "send failed" };
  }
}

export async function sendSmsMany(input: {
  phones: (string | null | undefined)[];
  body: string;
}) {
  const seen = new Set<string>();
  const results: SendSmsResult[] = [];
  for (const phone of input.phones) {
    const normalized = normalizeE164(phone);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    results.push(await sendSms({ to: phone, body: input.body }));
  }
  return results;
}
