import { SignJWT, jwtVerify } from "jose";
import { siteUrl } from "@/lib/booking/stripe";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is required in production");
    }
    return new TextEncoder().encode("dev-secret-change-me");
  }
  return new TextEncoder().encode(value);
}

export type ManageTokenPayload = {
  aid: string;
  purpose: "manage";
};

export async function signManageToken(appointmentId: string, expiresIn = "60d") {
  return new SignJWT({ aid: appointmentId, purpose: "manage" } satisfies ManageTokenPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret());
}

export async function verifyManageToken(token: string): Promise<ManageTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose !== "manage" || !payload.aid) return null;
    return { aid: String(payload.aid), purpose: "manage" };
  } catch {
    return null;
  }
}

export async function appointmentManageUrl(appointmentId: string) {
  const token = await signManageToken(appointmentId);
  return `${siteUrl()}/book-now/manage?token=${encodeURIComponent(token)}`;
}
