import type { EditorSection } from "@/components/admin/AdminEditor";

export type SettingsSectionId = "brand" | "booking" | "reviews" | "media" | "copy" | "promo";

export type SettingsSectionDef = {
  id: SettingsSectionId;
  title: string;
  summary: string;
  href: string;
  fields: EditorSection["fields"];
  description?: string;
};

const brandFields: EditorSection["fields"] = [
  { name: "siteName", label: "Site name" },
  { name: "tagline", label: "Tagline" },
  { name: "subtitle", label: "Subtitle" },
  { name: "email", label: "Email" },
  { name: "phone", label: "Phone" },
  { name: "address", label: "Address", type: "textarea", rows: 3 },
  { name: "instagramUrl", label: "Instagram URL" },
];

const bookingFields: EditorSection["fields"] = [
  { name: "bookingEnabled", label: "Native online booking enabled", type: "boolean" },
  {
    name: "paymentProvider",
    label: "Booking payment platform",
    type: "select",
    options: ["stripe", "none"],
    hint: "stripe = Stripe Checkout; none = confirm with no online charge",
  },
  { name: "bookingUrl", label: "External booking URL (fallback)" },
  { name: "timezone", label: "Timezone", hint: "e.g. America/Toronto" },
  {
    name: "weeklyHours",
    label: "Weekly hours (JSON)",
    type: "json",
    rows: 10,
    hint: 'Prefer Admin → Availability for visual editing. Keys: mon–sun. Example: {"mon":[{"start":"10:00","end":"18:00"}]}',
  },
  {
    name: "slotIntervalMinutes",
    label: "Slot interval (minutes)",
    type: "number",
    hint: "Also editable under Admin → Availability → Booking rules",
  },
  {
    name: "bufferMinutes",
    label: "Buffer between appointments (minutes)",
    type: "number",
    hint: "Also editable under Admin → Availability → Booking rules",
  },
  {
    name: "minLeadHours",
    label: "Minimum lead time (hours)",
    type: "number",
    hint: "Also editable under Admin → Availability → Booking rules",
  },
  {
    name: "maxAdvanceDays",
    label: "Max days ahead to book",
    type: "number",
    hint: "Also editable under Admin → Availability → Booking rules",
  },
  { name: "hstRateBps", label: "HST rate (basis points)", type: "number", hint: "1300 = 13%" },
];

const reviewsFields: EditorSection["fields"] = [
  {
    name: "googleReviewsUrl",
    label: "Google reviews URL",
    hint: "Public Maps / Business Profile link for “See all reviews”",
  },
  {
    name: "googlePlaceId",
    label: "Google Place ID",
    hint: "From Google Maps / Place ID finder",
  },
];

const mediaFields: EditorSection["fields"] = [
  { name: "heroImage", label: "Hero image", type: "media", hint: "Choose from Media Library" },
  { name: "aboutImage", label: "About image", type: "media", hint: "Choose from Media Library" },
  {
    name: "galleryImages",
    label: "Gallery images",
    type: "media-list",
    hint: "Pick from Media Library (or edit URLs under Advanced)",
    rows: 8,
  },
];

const copyFields: EditorSection["fields"] = [
  { name: "homeIntro", label: "Home intro", type: "richtext", rows: 5 },
  { name: "whyHeadline", label: "Why headline" },
  { name: "whyBody", label: "Why body", type: "richtext", rows: 4 },
  { name: "values", label: "Studio values", type: "value-list" },
  { name: "meetAnie", label: "Meet Anie", type: "richtext", rows: 8 },
];

const promoFields: EditorSection["fields"] = [
  { name: "promoBannerEnabled", label: "Show promo banner", type: "boolean" },
  {
    name: "promoBannerText",
    label: "Banner text",
    hint: 'Default: "Klarna Available at Checkout"',
  },
  {
    name: "promoBannerHref",
    label: "Banner link (optional)",
    hint: "Leave blank for text-only. Example: /book-now",
  },
];

export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  {
    id: "brand",
    title: "Brand & contact",
    summary: "Studio identity and how clients reach you.",
    description: "Studio identity and how clients reach you.",
    href: "/admin/settings/brand",
    fields: brandFields,
  },
  {
    id: "booking",
    title: "Booking & payments",
    summary: "Online booking, hours, tax, and payment platform.",
    href: "/admin/settings/booking",
    fields: bookingFields,
  },
  {
    id: "promo",
    title: "Promo banner",
    summary: "Site-wide announcement bar above the header.",
    description: "Shown on every public page when enabled. Klarna must still be enabled in Stripe Dashboard.",
    href: "/admin/settings/promo",
    fields: promoFields,
  },
  {
    id: "reviews",
    title: "Google reviews",
    summary: "Homepage reviews widget and Place ID.",
    description: "Homepage reviews widget. Place ID requires GOOGLE_PLACES_API_KEY in env.",
    href: "/admin/settings/reviews",
    fields: reviewsFields,
  },
  {
    id: "media",
    title: "Homepage media",
    summary: "Hero, about, and gallery images.",
    description: "Hero, about, and gallery images from the Media Library.",
    href: "/admin/settings/media",
    fields: mediaFields,
  },
  {
    id: "copy",
    title: "Homepage copy",
    summary: "Intro, values, and Meet Anie.",
    description: "Intro, values, and Meet Anie content on the home page.",
    href: "/admin/settings/copy",
    fields: copyFields,
  },
];

export function getSettingsSection(id: string): SettingsSectionDef | undefined {
  return SETTINGS_SECTIONS.find((s) => s.id === id);
}
