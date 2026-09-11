/** Display title for an appointment from label, lines, service, or category. */
export function appointmentDisplayTitle(row: {
  serviceLabel?: string | null;
  service?: { title: string } | null;
  category?: { title: string } | null;
  lines?: { title: string }[];
}) {
  if (row.serviceLabel) return row.serviceLabel;
  if (row.lines?.length) return row.lines.map((l) => l.title).join(", ");
  if (row.service?.title) return row.service.title;
  if (row.category?.title) return row.category.title;
  return "Appointment";
}
