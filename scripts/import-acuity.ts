import "dotenv/config";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { fromZonedTime } from "date-fns-tz";
import { getPrisma } from "../src/lib/db";

const TZ = "America/Toronto";

type Args = { clients?: string; schedule?: string };

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--clients") out.clients = argv[++i];
    if (argv[i] === "--schedule") out.schedule = argv[++i];
  }
  return out;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function digits(phone: string | null | undefined) {
  return (phone || "").replace(/\D/g, "");
}

function normalizePhone(phone: string | null | undefined) {
  const d = digits(phone);
  if (!d) return null;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (d.length === 10) return `+1${d}`;
  return phone?.trim() || null;
}

function normalizeEmail(raw: string | null | undefined, name: string, phone: string | null) {
  const email = (raw || "").trim().toLowerCase();
  if (email && email.includes("@")) return email;
  const base = slugify(name) || "client";
  const p = digits(phone) || "0";
  return `import+${base}-${p}@noemail.local`;
}

function moneyToCents(raw: string | null | undefined) {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  return Math.round(Number(cleaned) * 100);
}

function normalizeType(type: string) {
  return type
    .toLowerCase()
    .replace(/[❌⭐️💎]/g, " ")
    .replace(/\$[0-9,.]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function parseAcuityDate(raw: string) {
  // e.g. "December 21, 2021 5:45 pm"
  const m = raw
    .trim()
    .match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (month === undefined) return null;
  let hour = Number(m[4]);
  const minute = Number(m[5]);
  const ap = m[6].toLowerCase();
  if (ap === "pm" && hour < 12) hour += 12;
  if (ap === "am" && hour === 12) hour = 0;
  const y = m[3];
  const d = String(Number(m[2])).padStart(2, "0");
  const mo = String(month + 1).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return fromZonedTime(`${y}-${mo}-${d}T${hh}:${mm}:00`, TZ);
}

function mapStatus(row: Record<string, string>) {
  const canceled = (row["Canceled"] || "").trim().toLowerCase();
  if (canceled === "canceled" || canceled === "cancelled") return "cancelled";
  if (canceled === "no-show" || canceled === "no_show") return "no_show";
  const label = (row["Label"] || "").trim().toLowerCase();
  if (label === "completed") return "completed";
  if (label === "awaiting deposit") return "pending_payment";
  if (label === "confirmed" || label === "giveaway" || label.includes("paid")) return "confirmed";
  return "confirmed";
}

function mapServiceSlug(type: string): string | null {
  const n = normalizeType(type);
  if (!n) return null;
  if (n.includes("dpn") || n.includes("skin tag") || n.includes("wart")) return "dpn-skin-tag-removal";
  if (n.includes("dark lip") || n.includes("lip blush") || n.includes("lip neutralization")) {
    return "dark-lip-neutralization";
  }
  if (
    n.includes("laser") ||
    n.includes("underarm") ||
    n.includes("brazilian") ||
    n.includes("full body") ||
    n.includes("small area") ||
    n.includes("medium area") ||
    n.includes("smedium") ||
    n.includes("x small") ||
    n.includes("bikini") ||
    n.includes("full legs") ||
    n.includes("full arms")
  ) {
    return "laser-hair-removal";
  }
  if (n.includes("ombre") || n.includes("ombr") || n.includes("brow") || n.includes("henna")) {
    return "ombre-brows";
  }
  if (n.includes("stretch") || n.includes("scar") || n.includes("inkless")) {
    return "inkless-stretch-marks-and-scar-revision";
  }
  if (n.includes("cold plasma")) return "cold-plasma";
  if (n.includes("consult")) return "imported-acuity";
  if (n.includes("training") || n.includes("class") || n.includes("course") || n.includes("1on1")) {
    return "imported-acuity";
  }
  return null;
}

function mergeNotes(existing: string, incoming: string) {
  const a = (existing || "").trim();
  const b = (incoming || "").trim();
  if (!b) return a;
  if (!a) return b;
  if (a.includes(b)) return a;
  return `${a}\n---\n${b}`.slice(0, 8000);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const clientsPath = args.clients || "/home/spec/Downloads/list 3.csv";
  const schedulePath = args.schedule || "/home/spec/Downloads/schedule2026-09-09.csv.html";

  const db = getPrisma();

  const owner =
    (await db.admin.findFirst({ where: { role: "owner", active: true }, orderBy: { createdAt: "asc" } })) ||
    (await db.admin.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } }));

  const services = await db.service.findMany({ select: { id: true, slug: true, title: true } });
  const bySlug = new Map(services.map((s) => [s.slug, s]));

  let importedService = bySlug.get("imported-acuity");
  if (!importedService) {
    importedService = await db.service.create({
      data: {
        slug: "imported-acuity",
        title: "Imported (Acuity)",
        shortTitle: "Imported",
        tagline: "Legacy Acuity booking type",
        summary: "Placeholder for services imported from Acuity that are not mapped 1:1.",
        content: "",
        status: "published",
        featured: false,
        bookable: false,
        durationMinutes: 60,
        priceCents: 0,
        paymentMode: "none",
        sortOrder: 999,
      },
      select: { id: true, slug: true, title: true },
    });
    bySlug.set(importedService.slug, importedService);
  }

  const clientCsv = readFileSync(clientsPath, "utf8");
  const clientRows = parse(clientCsv, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  let clientsCreated = 0;
  let clientsUpdated = 0;

  for (const row of clientRows) {
    const name = `${row["First Name"] || ""} ${row["Last Name"] || ""}`.replace(/\s+/g, " ").trim() || "Client";
    const phone = normalizePhone(row["Phone"]);
    const email = normalizeEmail(row["Email"], name, phone);
    const notes = (row["Notes"] || "").trim();
    const banned = (row["Banned"] || "").trim().toUpperCase() === "Y";

    const existing = await db.client.findUnique({ where: { email } });
    if (!existing) {
      await db.client.create({
        data: { email, name: name.slice(0, 160), phone, notes, banned },
      });
      clientsCreated++;
    } else {
      await db.client.update({
        where: { id: existing.id },
        data: {
          name: name.slice(0, 160),
          phone: phone || existing.phone,
          notes: mergeNotes(existing.notes, notes),
          banned: banned || existing.banned,
        },
      });
      clientsUpdated++;
    }
  }

  const scheduleCsv = readFileSync(schedulePath, "utf8");
  const scheduleRows = parse(scheduleCsv, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  let apptsCreated = 0;
  let apptsUpdated = 0;
  const unmatchedTypes = new Map<string, number>();

  for (const row of scheduleRows) {
    const acuityId = (row["Appointment ID"] || "").trim();
    if (!acuityId) continue;
    const externalId = `acuity:${acuityId}`;

    const first = (row["First Name"] || "").trim();
    const last = (row["Last Name"] || "").trim();
    const name = `${first} ${last}`.replace(/\s+/g, " ").trim() || "Client";
    const phone = normalizePhone(row["Phone"]);
    const email = normalizeEmail(row["Email"], name, phone);
    const type = (row["Type"] || "").trim() || "Imported appointment";
    const notes = (row["Notes"] || "").trim();

    let client = await db.client.findUnique({ where: { email } });
    if (!client) {
      client = await db.client.create({
        data: { email, name: name.slice(0, 160), phone, notes: "" },
      });
      clientsCreated++;
    }

    const mappedSlug = mapServiceSlug(type);
    if (!mappedSlug || mappedSlug === "imported-acuity") {
      unmatchedTypes.set(type, (unmatchedTypes.get(type) || 0) + 1);
    }
    const service = bySlug.get(mappedSlug || "imported-acuity") || importedService;

    const startsAt = parseAcuityDate(row["Start Time"] || "");
    const endsAt = parseAcuityDate(row["End Time"] || "");
    if (!startsAt || !endsAt) {
      console.warn("skip bad dates", externalId, row["Start Time"]);
      continue;
    }

    const priceCents = moneyToCents(row["Appointment Price"]);
    const amountChargedCents = moneyToCents(row["Amount Paid Online"]);
    const status = mapStatus(row);
    const noteBody = notes ? `[Acuity: ${type}]\n${notes}` : `[Acuity: ${type}]`;

    const data = {
      serviceId: service.id,
      staffId: owner?.id || null,
      clientId: client.id,
      externalId,
      serviceLabel: type.slice(0, 255),
      startsAt,
      endsAt,
      clientName: name.slice(0, 160),
      clientEmail: email,
      clientPhone: phone,
      status,
      priceCents,
      depositCents: null,
      taxCents: 0,
      amountChargedCents,
      paymentMode: "imported",
      notes: noteBody.slice(0, 8000),
      policyAcceptedAt: startsAt,
    };

    const existing = await db.appointment.findUnique({ where: { externalId } });
    if (existing) {
      await db.appointment.update({ where: { id: existing.id }, data });
      apptsUpdated++;
    } else {
      await db.appointment.create({ data });
      apptsCreated++;
    }
  }

  console.log(
    JSON.stringify(
      {
        clientsCreated,
        clientsUpdated,
        apptsCreated,
        apptsUpdated,
        unmatchedTop: [...unmatchedTypes.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 25)
          .map(([type, count]) => ({ type, count })),
      },
      null,
      2,
    ),
  );

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
