import { addWeeks } from "date-fns";

export type RecurrenceFrequency = "none" | "weekly" | "biweekly";

export function buildOccurrenceStarts(options: {
  firstStartsAt: Date;
  frequency: RecurrenceFrequency;
  count?: number;
  until?: Date | null;
}): Date[] {
  const { firstStartsAt, frequency } = options;
  if (frequency === "none") return [firstStartsAt];

  const weekStep = frequency === "biweekly" ? 2 : 1;
  const maxCount = Math.min(Math.max(options.count || 1, 1), 26);
  const until = options.until || null;
  const starts: Date[] = [];

  for (let i = 0; i < maxCount; i++) {
    const at = addWeeks(firstStartsAt, i * weekStep);
    if (until && at > until) break;
    starts.push(at);
  }

  return starts.length ? starts : [firstStartsAt];
}
