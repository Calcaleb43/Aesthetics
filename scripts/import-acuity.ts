import "dotenv/config";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { fromZonedTime } from "date-fns-tz";
import { getPrisma } from "../src/lib/db";

const TZ = "America/Toronto";

type Args = { clients?: string; schedule?: string; replace?: boolean };

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--clients") out.clients = argv[++i];
    if (argv[i] === "--schedule") out.schedule = argv[++i];
    if (argv[i] === "--replace") out.replace = true;
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
  if (n.includes("dpn") || n.includes("skin tag") || n.includes("wart")) {
    return "dpn-skin-tag-removal-session";
  }
  if (n.includes("dark lip") || n.includes("lip blush") || n.includes("lip neutralization")) {
    return "dark-lip-neutralization-session";
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
    return "laser-hair-removal-session";
  }
  if (n.includes("ombre") || n.includes("ombr") || n.includes("brow") || n.includes("henna")) {
    return "ombre-brows-session";
  }
  if (n.includes("stretch") || n.includes("scar") || n.includes("inkless")) {
    return "inkless-stretch-marks-and-scar-revision-session";
  }
  if (n.includes("cold plasma")) return "cold-plasma-session";
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
  const clientsPath = args.clients || "/home/spec/Downloads/list 4.csv";
  const schedulePath = args.schedule || "/home/spec/Downloads/schedule2026-09-16.csv 3.html";

  const db = getPrisma();

  if (args.replace) {
    console.log("Replacing existing appointments and clients…");
    // Clear appointment package links, then wipe schedule + CRM imports.
    await db.appointment.updateMany({ data: { clientPackageId: null } });
    const deletedAppts = await db.appointment.deleteMany({});
    const deletedPackages = await db.clientPackage.deleteMany({});
    const deletedClients = await db.client.deleteMany({});
    console.log(
      JSON.stringify({
        deletedAppointments: deletedAppts.count,
        deletedClientPackages: deletedPackages.count,
        deletedClients: deletedClients.count,
      }),
    );
  }

  const owner =
    (await db.admin.findFirst({ where: { role: "owner", active: true }, orderBy: { createdAt: "asc" } })) ||
    (await db.admin.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } }));

  const services = await db.service.findMany({
    select: { id: true, slug: true, title: true, categoryId: true },
  });
  const bySlug = new Map(services.map((s) => [s.slug, s]));

  let importedCategory = await db.serviceCategory.findUnique({ where: { slug: "imported-acuity" } });
  if (!importedCategory) {
    importedCategory = await db.serviceCategory.create({
      data: {
        slug: "imported-acuity",
        title: "Imported (Acuity)",
        shortTitle: "IMPORTED",
        tagline: "Legacy Acuity booking type",
        summary: "Placeholder category for services imported from Acuity.",
        content: "",
        status: "draft",
        featured: false,
        sortOrder: 999,
      },
    });
  }

  let importedService = bySlug.get("imported-acuity");
  if (!importedService) {
    importedService = await db.service.create({
      data: {
        categoryId: importedCategory.id,
        slug: "imported-acuity",
        title: "Imported (Acuity)",
        summary: "Placeholder for services imported from Acuity that are not mapped 1:1.",
        status: "draft",
        bookable: false,
        durationMinutes: 60,
        priceCents: 0,
        paymentMode: "none",
        sortOrder: 999,
      },
      select: { id: true, slug: true, title: true, categoryId: true },
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

  type ClientRow = { id: string; email: string; name: string; phone: string | null; notes: string; banned: boolean };
  const clientByEmail = new Map<string, ClientRow>();
  for (const c of await db.client.findMany()) {
    clientByEmail.set(c.email, c);
  }

  let clientsCreated = 0;
  let clientsUpdated = 0;
  const clientsToCreate: {
    email: string;
    name: string;
    phone: string | null;
    notes: string;
    banned: boolean;
  }[] = [];

  for (const row of clientRows) {
    const name = `${row["First Name"] || ""} ${row["Last Name"] || ""}`.replace(/\s+/g, " ").trim() || "Client";
    const phone = normalizePhone(row["Phone"]);
    const email = normalizeEmail(row["Email"], name, phone);
    const notes = (row["Notes"] || "").trim();
    const banned = (row["Banned"] || "").trim().toUpperCase() === "Y";
    const existing = clientByEmail.get(email);
    if (!existing) {
      if (!clientsToCreate.some((c) => c.email === email)) {
        clientsToCreate.push({ email, name: name.slice(0, 160), phone, notes, banned });
      }
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

  for (let i = 0; i < clientsToCreate.length; i += 100) {
    const chunk = clientsToCreate.slice(i, i + 100);
    await db.client.createMany({ data: chunk, skipDuplicates: true });
    clientsCreated += chunk.length;
  }

  clientByEmail.clear();
  for (const c of await db.client.findMany()) {
    clientByEmail.set(c.email, c);
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
  let apptsSkipped = 0;
  const unmatchedTypes = new Map<string, number>();
  const existingExternal = new Set(
    (
      await db.appointment.findMany({
        where: { externalId: { not: null } },
        select: { externalId: true },
      })
    )
      .map((a) => a.externalId)
      .filter(Boolean) as string[],
  );

  const apptsToCreate: {
    categoryId: string;
    serviceId: string;
    staffId: string | null;
    clientId: string;
    externalId: string;
    serviceLabel: string;
    startsAt: Date;
    endsAt: Date;
    clientName: string;
    clientEmail: string;
    clientPhone: string | null;
    status: string;
    priceCents: number;
    depositCents: null;
    taxCents: number;
    amountChargedCents: number;
    paymentMode: string;
    notes: string;
    policyAcceptedAt: Date;
  }[] = [];

  const pendingClientCreates = new Map<
    string,
    { email: string; name: string; phone: string | null; notes: string; banned: boolean }
  >();

  for (const row of scheduleRows) {
    const acuityId = (row["Appointment ID"] || "").trim();
    if (!acuityId) continue;
    const externalId = `acuity:${acuityId}`;
    if (existingExternal.has(externalId)) {
      apptsSkipped++;
      continue;
    }

    const first = (row["First Name"] || "").trim();
    const last = (row["Last Name"] || "").trim();
    const name = `${first} ${last}`.replace(/\s+/g, " ").trim() || "Client";
    const phone = normalizePhone(row["Phone"]);
    const email = normalizeEmail(row["Email"], name, phone);
    const type = (row["Type"] || "").trim() || "Imported appointment";
    const notes = (row["Notes"] || "").trim();

    if (!clientByEmail.has(email) && !pendingClientCreates.has(email)) {
      pendingClientCreates.set(email, {
        email,
        name: name.slice(0, 160),
        phone,
        notes: "",
        banned: false,
      });
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

    apptsToCreate.push({
      categoryId: service.categoryId || importedCategory.id,
      serviceId: service.id,
      staffId: owner?.id || null,
      clientId: "", // filled after client create
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
    });
    existingExternal.add(externalId);
  }

  if (pendingClientCreates.size) {
    const pending = [...pendingClientCreates.values()];
    for (let i = 0; i < pending.length; i += 100) {
      const chunk = pending.slice(i, i + 100);
      await db.client.createMany({ data: chunk, skipDuplicates: true });
      clientsCreated += chunk.length;
    }
    for (const c of await db.client.findMany()) {
      clientByEmail.set(c.email, c);
    }
  }

  for (const appt of apptsToCreate) {
    const client = clientByEmail.get(appt.clientEmail);
    if (!client) {
      console.warn("skip missing client", appt.externalId, appt.clientEmail);
      continue;
    }
    appt.clientId = client.id;
  }

  const ready = apptsToCreate.filter((a) => a.clientId);
  for (let i = 0; i < ready.length; i += 50) {
    const chunk = ready.slice(i, i + 50);
    await db.appointment.createMany({ data: chunk, skipDuplicates: true });
    apptsCreated += chunk.length;
    if ((i / 50) % 5 === 0) {
      console.log(`appointments… ${Math.min(i + chunk.length, ready.length)}/${ready.length}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        clientsCreated,
        clientsUpdated,
        apptsCreated,
        apptsUpdated,
        apptsSkipped,
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
