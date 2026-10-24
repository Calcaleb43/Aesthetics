"use client";

import type { MouseEvent } from "react";

/** Digits only; North American 10-digit numbers get a leading 1 for dial/SMS links. */
function phoneDigits(phone: string | null | undefined) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

function telHref(phone: string | null | undefined) {
  const digits = phoneDigits(phone);
  return digits ? `tel:+${digits}` : null;
}

function smsHref(phone: string | null | undefined, body?: string) {
  const digits = phoneDigits(phone);
  if (!digits) return null;
  const base = `sms:+${digits}`;
  if (!body?.trim()) return base;
  return `${base}?body=${encodeURIComponent(body.trim())}`;
}

const actionClass =
  "inline-flex items-center rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70 transition hover:border-[#c6a75e]/50 hover:text-[#c6a75e]";

type ContactActionsProps = {
  name: string;
  email?: string | null;
  phone?: string | null;
  /** Optional SMS draft, e.g. appointment reminder text. */
  smsBody?: string;
  /** Prefill email subject when present. */
  emailSubject?: string;
  className?: string;
  /** Stop click bubbling (list cards that open the drawer). */
  stopPropagation?: boolean;
};

export function ContactActions({
  name,
  email,
  phone,
  smsBody,
  emailSubject,
  className = "",
  stopPropagation = false,
}: ContactActionsProps) {
  const mail = email?.trim() || "";
  const call = telHref(phone);
  const text = smsHref(phone, smsBody);
  if (!mail && !call && !text) return null;

  const onClick = stopPropagation
    ? (e: MouseEvent) => {
        e.stopPropagation();
      }
    : undefined;

  const mailHref = mail
    ? emailSubject
      ? `mailto:${mail}?subject=${encodeURIComponent(emailSubject)}`
      : `mailto:${mail}`
    : null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`} onClick={onClick}>
      {mailHref ? (
        <a href={mailHref} className={actionClass} title={`Email ${name}`}>
          Email
        </a>
      ) : null}
      {call ? (
        <a href={call} className={actionClass} title={`Call ${name}`}>
          Call
        </a>
      ) : null}
      {text ? (
        <a href={text} className={actionClass} title={`Text ${name}`}>
          Text
        </a>
      ) : null}
    </div>
  );
}

export function appointmentSmsBody(opts: {
  clientName: string;
  serviceTitle: string;
  whenLabel: string;
}) {
  const first = opts.clientName.trim().split(/\s+/)[0] || "there";
  return `Hi ${first}, reminder from Aniekanvas: your ${opts.serviceTitle} is on ${opts.whenLabel}. Reply if you need to reschedule.`;
}
