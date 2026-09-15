import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionWorkspace } from "@/components/admin/CollectionWorkspace";
import { getPrisma, hasDatabase } from "@/lib/db";

async function getCoupons() {
  if (!hasDatabase()) return [];
  try {
    return await getPrisma().coupon.findMany({
      orderBy: [{ active: "desc" }, { code: "asc" }],
    });
  } catch {
    return [];
  }
}

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const coupons = await getCoupons();

  return (
    <AdminShell
      title="Coupons"
      description="Discount codes for booking. Percent amounts are basis points (2000 = 20%). Fixed amounts are stored in cents."
    >
      <CollectionWorkspace
        items={coupons.map((c) => ({
          key: c.code,
          label: `${c.name} · ${c.redeemedCount} redeemed`,
          status: c.active ? "active" : "inactive",
          previewHref: null,
          data: {
            id: c.id,
            code: c.code,
            name: c.name,
            type: c.type,
            amount: c.amount,
            active: c.active,
            startsAt: c.startsAt?.toISOString() ?? "",
            endsAt: c.endsAt?.toISOString() ?? "",
            maxRedemptions: c.maxRedemptions ?? "",
            redeemedCount: c.redeemedCount,
            minSubtotalCents: c.minSubtotalCents,
          },
        }))}
        selectedKey={code}
        basePath="/admin/coupons"
        param="code"
        endpoint="/api/admin/coupons"
        deleteEndpoint="/api/admin/coupons"
        deleteKey="code"
        lockIdentityFields={["code"]}
        createLabel="New coupon"
        emptyTitle="No coupons yet"
        emptyBody="Create percent or fixed discount codes clients can apply at booking."
        createTemplate={{
          code: "NEWCODE",
          name: "New coupon",
          type: "percent",
          amount: 1000,
          active: true,
          startsAt: "",
          endsAt: "",
          maxRedemptions: "",
          redeemedCount: 0,
          minSubtotalCents: null,
        }}
        fields={[
          { name: "code", label: "Code", hint: "Stored uppercase without spaces" },
          { name: "name", label: "Name" },
          {
            name: "type",
            label: "Type",
            type: "select",
            options: ["percent", "fixed"],
          },
          {
            name: "amount",
            label: "Amount",
            type: "number",
            hint: "Percent: basis points (2000 = 20%). Fixed: cents off (500 = $5.00).",
          },
          { name: "active", label: "Active", type: "boolean" },
          {
            name: "startsAt",
            label: "Starts at (optional)",
            hint: "ISO datetime, e.g. 2026-04-01T00:00:00.000Z — leave blank for none",
          },
          {
            name: "endsAt",
            label: "Ends at (optional)",
            hint: "ISO datetime — leave blank for none",
          },
          {
            name: "maxRedemptions",
            label: "Max redemptions (optional)",
            type: "number",
            hint: "Leave 0 or blank for unlimited",
          },
          {
            name: "minSubtotalCents",
            label: "Minimum subtotal (CAD)",
            type: "money",
            hint: "Optional. Enter dollars — e.g. 100 for $100.00",
          },
          {
            name: "redeemedCount",
            label: "Redeemed count",
            type: "number",
            readOnly: true,
            hint: "Updated automatically when coupons are used",
          },
        ]}
      />
    </AdminShell>
  );
}
