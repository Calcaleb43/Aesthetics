"use client";

import {
  DAY_KEYS,
  DAY_LABELS,
  type DayKey,
} from "@/lib/booking/weekly-hours";
import type { WeeklyHours } from "@/lib/booking/money";

type Props = {
  value: WeeklyHours | null;
  onChange: (next: WeeklyHours | null) => void;
  label?: string;
};

function defaultWindow() {
  return { start: "10:00", end: "18:00" };
}

export function WeeklyHoursEditor({ value, onChange, label = "Weekly hours" }: Props) {
  const custom = value !== null;

  function setDay(key: DayKey, enabled: boolean) {
    const next: WeeklyHours = { ...(value || {}) };
    if (enabled) {
      next[key] = next[key]?.length ? next[key] : [defaultWindow()];
    } else {
      delete next[key];
    }
    onChange(Object.keys(next).length ? next : {});
  }

  function setWindow(key: DayKey, field: "start" | "end", hm: string) {
    const next: WeeklyHours = { ...(value || {}) };
    const windows = [...(next[key] || [defaultWindow()])];
    windows[0] = { ...windows[0], [field]: hm };
    next[key] = windows;
    onChange(next);
  }

  return (
    <fieldset className="md:col-span-2">
      <legend className="mb-2 text-sm text-white/70">{label}</legend>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`rounded-full px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] transition ${
            !custom ? "admin-chip-active" : "bg-white/10 text-white/70"
          }`}
        >
          Use studio hours
        </button>
        <button
          type="button"
          onClick={() =>
            onChange(
              value && Object.keys(value).length
                ? value
                : { mon: [defaultWindow()], tue: [defaultWindow()], wed: [defaultWindow()], thu: [defaultWindow()], fri: [defaultWindow()] },
            )
          }
          className={`rounded-full px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] transition ${
            custom ? "admin-chip-active" : "bg-white/10 text-white/70"
          }`}
        >
          Custom hours
        </button>
      </div>

      {custom ? (
        <div className="space-y-2">
          {DAY_KEYS.map((key) => {
            const windows = value?.[key] || [];
            const on = windows.length > 0;
            const win = windows[0] || defaultWindow();
            return (
              <div key={key} className="flex flex-wrap items-center gap-3">
                <label className="flex w-28 items-center gap-2 text-sm text-white/70">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => setDay(key, e.target.checked)}
                  />
                  {DAY_LABELS[key].slice(0, 3)}
                </label>
                {on ? (
                  <>
                    <input
                      type="time"
                      className="admin-input !w-auto !py-1.5"
                      value={win.start}
                      onChange={(e) => setWindow(key, "start", e.target.value)}
                    />
                    <span className="text-white/40">–</span>
                    <input
                      type="time"
                      className="admin-input !w-auto !py-1.5"
                      value={win.end}
                      onChange={(e) => setWindow(key, "end", e.target.value)}
                    />
                  </>
                ) : (
                  <span className="text-sm text-white/35">Off</span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-white/45">Inherits studio weekly hours from Settings.</p>
      )}
    </fieldset>
  );
}
