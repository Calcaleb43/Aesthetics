import { format } from "date-fns";
import type { Database } from "@/lib/db";
import {
  buildRevenueReport,
  resolveRevenueRange,
  type RevenueRangePreset,
  type RevenueReport,
} from "@/lib/accounting/revenue";
import { formatCad, zonedParts } from "@/lib/booking/money";

export type ReportRangePreset = RevenueRangePreset;

export type CountItem = {
  key: string;
  label: string;
  count: number;
  /** Optional money associated with the bucket */
  totalCents?: number;
};

export type StudioReport = {
  from: string;
  to: string;
  timezone: string;
  generatedAt: string;
  overview: {
    appointmentsTotal: number;
    appointmentsConfirmed: number;
    appointmentsCompleted: number;
    appointmentsCancelled: number;
    appointmentsNoShow: number;
    appointmentsPendingPayment: number;
    noShowRateBps: number;
    cancelRateBps: number;
    clientsNew: number;
    clientsTotal: number;
    inquiriesNew: number;
    inquiriesUnread: number;
    emailsSent: number;
    emailsFailed: number;
    couponRedemptions: number;
    discountCents: number;
    packagePurchases: number;
    groupBookings: number;
    collectedCents: number;
    outstandingCents: number;
    profitCents: number;
  };
  appointments: {
    byStatus: CountItem[];
    byDay: CountItem[];
    byStaff: CountItem[];
    byCategory: CountItem[];
    byService: CountItem[];
    byPaymentMode: CountItem[];
    bookedMinutes: number;
    avgDurationMinutes: number;
    withAddons: number;
    withCoupon: number;
    recurringSeries: number;
    groupParties: number;
  };
  clients: {
    newInRange: number;
    totalActive: number;
    banned: number;
    returningInRange: number;
    firstTimersInRange: number;
    topByVisits: CountItem[];
    topBySpend: CountItem[];
    missingPhone: number;
    missingEmail: number;
  };
  inquiries: {
    totalInRange: number;
    byStatus: CountItem[];
    byDay: CountItem[];
    withPhone: number;
    topInterests: CountItem[];
  };
  marketing: {
    couponsActive: number;
    couponsTotal: number;
    couponUsage: CountItem[];
    discountCents: number;
    promoDaysActive: number;
    packageOffersActive: number;
    packagePurchasesInRange: CountItem[];
    packageSessionsRemaining: number;
  };
  team: {
    membersActive: number;
    byStaff: CountItem[];
    noShowsByStaff: CountItem[];
    completedByStaff: CountItem[];
  };
  catalog: {
    categoriesPublished: number;
    categoriesDraft: number;
    servicesPublished: number;
    servicesDraft: number;
    variantsBookable: number;
    addonsPublished: number;
    pagesPublished: number;
    faqsPublished: number;
    carePublished: number;
    testimonialsPublished: number;
    mediaAssets: number;
    emailTemplates: number;
  };
  communications: {
    emailsInRange: number;
    byStatus: CountItem[];
    byTemplate: CountItem[];
    byDay: CountItem[];
  };
  revenue: Pick<
    RevenueReport,
    "summary" | "byStaff" | "byCategory" | "byPaymentMode" | "byExpenseCategory"
  >;
};

function dateKeyInTz(date: Date, timeZone: string) {
  return zonedParts(date, timeZone).dateKey;
}

function bumpCount(
  map: Map<string, CountItem>,
  key: string,
  label: string,
  count = 1,
  totalCents = 0,
) {
  const cur = map.get(key) || { key, label, count: 0, totalCents: 0 };
  cur.count += count;
  cur.totalCents = (cur.totalCents || 0) + totalCents;
  map.set(key, cur);
}

function sortedCounts(map: Map<string, CountItem>, limit?: number) {
  const rows = [...map.values()].sort((a, b) => {
    if ((b.totalCents || 0) !== (a.totalCents || 0)) return (b.totalCents || 0) - (a.totalCents || 0);
    return b.count - a.count;
  });
  return limit ? rows.slice(0, limit) : rows;
}

function rateBps(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 10_000);
}

export { resolveRevenueRange };

export async function buildStudioReport(
  db: Database,
  opts: {
    from: Date;
    to: Date;
    timezone: string;
  },
): Promise<StudioReport> {
  const { from, to, timezone } = opts;
  const [
    appointments,
    clientsCreated,
    clientTotals,
    inquiries,
    inquiryUnread,
    emails,
    coupons,
    promoDaysActive,
    packageOffers,
    packagePurchases,
    packageSessions,
    admins,
    revenue,
    categories,
    services,
    variantsBookable,
    addonsPublished,
    pagesPublished,
    faqsPublished,
    carePublished,
    testimonialsPublished,
    mediaAssets,
    emailTemplates,
  ] = await Promise.all([
    db.appointment.findMany({
      where: {
        startsAt: { gte: from, lte: to },
        status: { notIn: ["expired"] },
      },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        clientId: true,
        clientEmail: true,
        clientName: true,
        clientPhone: true,
        staffId: true,
        categoryId: true,
        serviceId: true,
        seriesId: true,
        groupId: true,
        paymentMode: true,
        couponCode: true,
        discountCents: true,
        amountChargedCents: true,
        priceCents: true,
        taxCents: true,
        depositCents: true,
        serviceLabel: true,
        staff: { select: { id: true, name: true } },
        category: { select: { id: true, title: true } },
        service: { select: { id: true, title: true } },
        lines: { select: { serviceId: true, title: true, priceCents: true } },
        addons: { select: { id: true } },
        createdAt: true,
      },
    }),
    db.client.count({ where: { createdAt: { gte: from, lte: to } } }),
    db.client.groupBy({
      by: ["banned"],
      _count: { _all: true },
    }),
    db.inquiry.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: {
        id: true,
        status: true,
        createdAt: true,
        phone: true,
        serviceInterest: true,
      },
    }),
    db.inquiry.count({ where: { status: "new" } }),
    db.emailMessage.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { id: true, status: true, templateKey: true, createdAt: true },
    }),
    db.coupon.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        active: true,
        redeemedCount: true,
      },
    }),
    db.promoDay.count({ where: { active: true } }),
    db.packageOffer.findMany({
      select: { id: true, title: true, active: true },
    }),
    db.clientPackage.findMany({
      where: { purchasedAt: { gte: from, lte: to } },
      select: {
        id: true,
        packageId: true,
        sessionsTotal: true,
        package: { select: { title: true, priceCents: true } },
      },
    }),
    db.clientPackage.aggregate({
      where: { status: "active" },
      _sum: { sessionsRemaining: true },
    }),
    db.admin.findMany({
      where: { active: true, role: { in: ["staff", "owner", "manager"] } },
      select: { id: true, name: true },
    }),
    buildRevenueReport(db, { from, to, basis: "cash", timezone, staffId: null }),
    db.serviceCategory.groupBy({ by: ["status"], _count: { _all: true } }),
    db.service.groupBy({ by: ["status"], _count: { _all: true } }),
    db.serviceVariant.count({ where: { bookable: true } }),
    db.addon.count({ where: { status: "published" } }),
    db.page.count({ where: { status: "published" } }),
    db.faq.count({ where: { status: "published" } }),
    db.careGuide.count({ where: { status: "published" } }),
    db.testimonial.count({ where: { status: "published" } }),
    db.mediaAsset.count(),
    db.emailTemplate.count(),
  ]);

  const byStatus = new Map<string, CountItem>();
  const byDay = new Map<string, CountItem>();
  const byStaff = new Map<string, CountItem>();
  const byCategory = new Map<string, CountItem>();
  const byService = new Map<string, CountItem>();
  const byPaymentMode = new Map<string, CountItem>();
  const noShowsByStaff = new Map<string, CountItem>();
  const completedByStaff = new Map<string, CountItem>();
  const clientVisits = new Map<string, CountItem>();
  const clientSpend = new Map<string, CountItem>();
  const couponUsage = new Map<string, CountItem>();
  const groupIds = new Set<string>();
  const seriesIds = new Set<string>();

  let bookedMinutes = 0;
  let withAddons = 0;
  let withCoupon = 0;
  let confirmedLike = 0;
  let cancelled = 0;
  let noShow = 0;
  let completed = 0;
  let pendingPayment = 0;
  let discountCents = 0;

  const clientIdsInRange = new Set<string>();

  for (const a of appointments) {
    const statusLabel = a.status.replace(/_/g, " ");
    bumpCount(byStatus, a.status, statusLabel);
    const day = dateKeyInTz(a.startsAt, timezone);
    bumpCount(byDay, day, day);
    const staffKey = a.staffId || "unassigned";
    const staffLabel = a.staff?.name || "Unassigned";
    bumpCount(byStaff, staffKey, staffLabel, 1, a.amountChargedCents);
    bumpCount(byCategory, a.categoryId, a.category?.title || "Category", 1, a.amountChargedCents);
    bumpCount(byPaymentMode, a.paymentMode || "unknown", a.paymentMode || "unknown", 1, a.amountChargedCents);

    if (a.lines.length) {
      for (const line of a.lines) {
        bumpCount(byService, line.serviceId, line.title, 1, line.priceCents);
      }
    } else if (a.serviceId) {
      bumpCount(byService, a.serviceId, a.service?.title || a.serviceLabel || "Service", 1, a.priceCents);
    }

    const mins = Math.max(0, Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000));
    bookedMinutes += mins;
    if (a.addons.length) withAddons += 1;
    if (a.couponCode) {
      withCoupon += 1;
      bumpCount(couponUsage, a.couponCode, a.couponCode, 1, a.discountCents);
    }
    discountCents += a.discountCents || 0;
    if (a.groupId) groupIds.add(a.groupId);
    if (a.seriesId) seriesIds.add(a.seriesId);

    if (a.status === "cancelled") cancelled += 1;
    else if (a.status === "no_show") {
      noShow += 1;
      bumpCount(noShowsByStaff, staffKey, staffLabel);
    } else if (a.status === "completed") {
      completed += 1;
      bumpCount(completedByStaff, staffKey, staffLabel, 1, a.amountChargedCents);
    } else if (a.status === "pending_payment") pendingPayment += 1;
    else if (a.status === "confirmed") confirmedLike += 1;

    if (a.status !== "cancelled" && a.status !== "expired") {
      const clientKey = a.clientId || a.clientEmail.toLowerCase();
      bumpCount(clientVisits, clientKey, a.clientName);
      bumpCount(clientSpend, clientKey, a.clientName, 1, a.amountChargedCents);
      if (a.clientId) clientIdsInRange.add(a.clientId);
    }
  }

  // Returning vs first-timers: clients with an appointment before `from`.
  let returningInRange = 0;
  let firstTimersInRange = 0;
  if (clientIdsInRange.size) {
    const prior = await db.appointment.findMany({
      where: {
        clientId: { in: [...clientIdsInRange] },
        startsAt: { lt: from },
        status: { notIn: ["cancelled", "expired"] },
      },
      select: { clientId: true },
      distinct: ["clientId"],
    });
    const returningIds = new Set(prior.map((p) => p.clientId).filter(Boolean) as string[]);
    for (const id of clientIdsInRange) {
      if (returningIds.has(id)) returningInRange += 1;
      else firstTimersInRange += 1;
    }
  }

  const inquiryByStatus = new Map<string, CountItem>();
  const inquiryByDay = new Map<string, CountItem>();
  const inquiryInterests = new Map<string, CountItem>();
  let inquiriesWithPhone = 0;
  for (const row of inquiries) {
    bumpCount(inquiryByStatus, row.status, row.status);
    const day = dateKeyInTz(row.createdAt, timezone);
    bumpCount(inquiryByDay, day, day);
    if (row.phone) inquiriesWithPhone += 1;
    if (row.serviceInterest?.trim()) {
      const interest = row.serviceInterest.trim();
      bumpCount(inquiryInterests, interest.toLowerCase(), interest);
    }
  }

  const emailByStatus = new Map<string, CountItem>();
  const emailByTemplate = new Map<string, CountItem>();
  const emailByDay = new Map<string, CountItem>();
  let emailsFailed = 0;
  let emailsSent = 0;
  for (const row of emails) {
    bumpCount(emailByStatus, row.status, row.status);
    bumpCount(emailByTemplate, row.templateKey, row.templateKey);
    const day = dateKeyInTz(row.createdAt, timezone);
    bumpCount(emailByDay, day, day);
    if (row.status === "failed") emailsFailed += 1;
    else emailsSent += 1;
  }

  const packageByOffer = new Map<string, CountItem>();
  for (const p of packagePurchases) {
    bumpCount(
      packageByOffer,
      p.packageId,
      p.package.title,
      1,
      p.package.priceCents,
    );
  }

  let clientsTotal = 0;
  let banned = 0;
  for (const row of clientTotals) {
    clientsTotal += row._count._all;
    if (row.banned) banned = row._count._all;
  }

  const statusCount = (status: string, rows: { status: string; _count: { _all: number } }[]) =>
    rows.find((r) => r.status === status)?._count._all || 0;

  const decided = confirmedLike + completed + cancelled + noShow;
  const avgDurationMinutes = appointments.length
    ? Math.round(bookedMinutes / appointments.length)
    : 0;

  // Clients missing contact info among those who booked in range (by email keys on appointments)
  let missingPhone = 0;
  const phoneSeen = new Set<string>();
  for (const a of appointments) {
    const key = a.clientEmail.toLowerCase();
    if (phoneSeen.has(key)) continue;
    phoneSeen.add(key);
    if (!a.clientPhone?.trim()) missingPhone += 1;
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    timezone,
    generatedAt: new Date().toISOString(),
    overview: {
      appointmentsTotal: appointments.length,
      appointmentsConfirmed: confirmedLike,
      appointmentsCompleted: completed,
      appointmentsCancelled: cancelled,
      appointmentsNoShow: noShow,
      appointmentsPendingPayment: pendingPayment,
      noShowRateBps: rateBps(noShow, decided),
      cancelRateBps: rateBps(cancelled, decided),
      clientsNew: clientsCreated,
      clientsTotal,
      inquiriesNew: inquiries.length,
      inquiriesUnread: inquiryUnread,
      emailsSent,
      emailsFailed,
      couponRedemptions: withCoupon,
      discountCents,
      packagePurchases: packagePurchases.length,
      groupBookings: groupIds.size,
      collectedCents: revenue.summary.collectedCents,
      outstandingCents: revenue.summary.outstandingCents,
      profitCents: revenue.summary.profitCents,
    },
    appointments: {
      byStatus: sortedCounts(byStatus),
      byDay: sortedCounts(byDay).sort((a, b) => a.key.localeCompare(b.key)),
      byStaff: sortedCounts(byStaff),
      byCategory: sortedCounts(byCategory),
      byService: sortedCounts(byService, 25),
      byPaymentMode: sortedCounts(byPaymentMode),
      bookedMinutes,
      avgDurationMinutes,
      withAddons,
      withCoupon,
      recurringSeries: seriesIds.size,
      groupParties: groupIds.size,
    },
    clients: {
      newInRange: clientsCreated,
      totalActive: clientsTotal - banned,
      banned,
      returningInRange,
      firstTimersInRange,
      topByVisits: sortedCounts(clientVisits, 15),
      topBySpend: sortedCounts(clientSpend, 15),
      missingPhone,
      missingEmail: 0,
    },
    inquiries: {
      totalInRange: inquiries.length,
      byStatus: sortedCounts(inquiryByStatus),
      byDay: sortedCounts(inquiryByDay).sort((a, b) => a.key.localeCompare(b.key)),
      withPhone: inquiriesWithPhone,
      topInterests: sortedCounts(inquiryInterests, 12),
    },
    marketing: {
      couponsActive: coupons.filter((c) => c.active).length,
      couponsTotal: coupons.length,
      couponUsage: sortedCounts(couponUsage),
      discountCents,
      promoDaysActive,
      packageOffersActive: packageOffers.filter((p) => p.active).length,
      packagePurchasesInRange: sortedCounts(packageByOffer),
      packageSessionsRemaining: packageSessions._sum.sessionsRemaining || 0,
    },
    team: {
      membersActive: admins.length,
      byStaff: sortedCounts(byStaff),
      noShowsByStaff: sortedCounts(noShowsByStaff),
      completedByStaff: sortedCounts(completedByStaff),
    },
    catalog: {
      categoriesPublished: statusCount("published", categories),
      categoriesDraft: statusCount("draft", categories),
      servicesPublished: statusCount("published", services),
      servicesDraft: statusCount("draft", services),
      variantsBookable,
      addonsPublished,
      pagesPublished,
      faqsPublished,
      carePublished,
      testimonialsPublished,
      mediaAssets,
      emailTemplates,
    },
    communications: {
      emailsInRange: emails.length,
      byStatus: sortedCounts(emailByStatus),
      byTemplate: sortedCounts(emailByTemplate, 20),
      byDay: sortedCounts(emailByDay).sort((a, b) => a.key.localeCompare(b.key)),
    },
    revenue: {
      summary: revenue.summary,
      byStaff: revenue.byStaff,
      byCategory: revenue.byCategory,
      byPaymentMode: revenue.byPaymentMode,
      byExpenseCategory: revenue.byExpenseCategory,
    },
  };
}

function csvEscape(value: string | number) {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function studioReportToCsv(report: StudioReport) {
  const lines: string[] = [];
  lines.push("Studio report");
  lines.push(`From,${csvEscape(report.from)}`);
  lines.push(`To,${csvEscape(report.to)}`);
  lines.push(`Timezone,${csvEscape(report.timezone)}`);
  lines.push(`Generated,${csvEscape(report.generatedAt)}`);
  lines.push("");

  lines.push("Overview");
  lines.push("Metric,Value");
  const o = report.overview;
  const overviewRows: [string, string | number][] = [
    ["Appointments", o.appointmentsTotal],
    ["Confirmed", o.appointmentsConfirmed],
    ["Completed", o.appointmentsCompleted],
    ["Cancelled", o.appointmentsCancelled],
    ["No-shows", o.appointmentsNoShow],
    ["Pending payment", o.appointmentsPendingPayment],
    ["No-show rate %", (o.noShowRateBps / 100).toFixed(1)],
    ["Cancel rate %", (o.cancelRateBps / 100).toFixed(1)],
    ["New clients", o.clientsNew],
    ["Total clients", o.clientsTotal],
    ["Inquiries", o.inquiriesNew],
    ["Unread inquiries", o.inquiriesUnread],
    ["Emails sent", o.emailsSent],
    ["Emails failed", o.emailsFailed],
    ["Coupon redemptions", o.couponRedemptions],
    ["Discounts", formatCad(o.discountCents)],
    ["Package purchases", o.packagePurchases],
    ["Group bookings", o.groupBookings],
    ["Collected", formatCad(o.collectedCents)],
    ["Outstanding", formatCad(o.outstandingCents)],
    ["Profit", formatCad(o.profitCents)],
  ];
  for (const [k, v] of overviewRows) lines.push(`${csvEscape(k)},${csvEscape(v)}`);

  const dumpSection = (title: string, items: CountItem[], money = false) => {
    lines.push("");
    lines.push(title);
    lines.push(money ? "Key,Label,Count,Total" : "Key,Label,Count");
    for (const item of items) {
      if (money) {
        lines.push(
          `${csvEscape(item.key)},${csvEscape(item.label)},${item.count},${csvEscape(formatCad(item.totalCents || 0))}`,
        );
      } else {
        lines.push(`${csvEscape(item.key)},${csvEscape(item.label)},${item.count}`);
      }
    }
  };

  dumpSection("Appointments by status", report.appointments.byStatus);
  dumpSection("Appointments by staff", report.appointments.byStaff, true);
  dumpSection("Appointments by category", report.appointments.byCategory, true);
  dumpSection("Appointments by service", report.appointments.byService, true);
  dumpSection("Clients top by visits", report.clients.topByVisits);
  dumpSection("Clients top by spend", report.clients.topBySpend, true);
  dumpSection("Inquiries by status", report.inquiries.byStatus);
  dumpSection("Coupon usage", report.marketing.couponUsage, true);
  dumpSection("Package purchases", report.marketing.packagePurchasesInRange, true);
  dumpSection("Emails by template", report.communications.byTemplate);
  dumpSection("Revenue by staff", report.revenue.byStaff.map((r) => ({
    key: r.key,
    label: r.label,
    count: r.count,
    totalCents: r.totalCents,
  })), true);

  lines.push("");
  lines.push("Catalog snapshot");
  lines.push("Metric,Value");
  for (const [k, v] of Object.entries(report.catalog)) {
    lines.push(`${csvEscape(k)},${csvEscape(v)}`);
  }

  return lines.join("\n");
}

export function formatReportRangeLabel(from: string, to: string, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${fmt.format(new Date(from))} – ${fmt.format(new Date(to))}`;
}

export function formatPercentBps(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}

/** Unused import guard helpers for callers that want day labels */
export function reportFilename(report: StudioReport) {
  const from = format(new Date(report.from), "yyyy-MM-dd");
  const to = format(new Date(report.to), "yyyy-MM-dd");
  return `studio-report-${from}-${to}.csv`;
}
