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
  /** Studio mode: always custom hours (no inherit toggle). */
  mode?: "staff" | "studio";
};

function defaultWindow() {
  return { start: "10:00", end: "18:00" };
}

function defaultWeek(): WeeklyHours {
  return {
    mon: [defaultWindow()],
    tue: [defaultWindow()],
    wed: [defaultWindow()],
    thu: [defaultWindow()],
    fri: [defaultWindow()],
  };
}

export function WeeklyHoursEditor({
  value,
  onChange,
  label = "Weekly hours",
  mode = "staff",
}: Props) {
  const studio = mode === "studio";
  const custom = studio || value !== null;
  const hours = studio ? value || {} : value;

  function setDay(key: DayKey, enabled: boolean) {
    const next: WeeklyHours = { ...(hours || {}) };
    if (enabled) {
      next[key] = next[key]?.length ? next[key] : [defaultWindow()];
    } else {
      delete next[key];
    }
    onChange(studio ? next : Object.keys(next).length ? next : {});
  }

  function setWindow(key: DayKey, index: number, field: "start" | "end", hm: string) {
    const next: WeeklyHours = { ...(hours || {}) };
    const windows = [...(next[key] || [defaultWindow()])];
    windows[index] = { ...(windows[index] || defaultWindow()), [field]: hm };
    next[key] = windows;
    onChange(next);
  }

  function addWindow(key: DayKey) {
    const next: WeeklyHours = { ...(hours || {}) };
    const windows = [...(next[key] || [defaultWindow()])];
    windows.push({ start: "14:00", end: "18:00" });
    next[key] = windows;
    onChange(next);
  }

  function removeWindow(key: DayKey, index: number) {
    const next: WeeklyHours = { ...(hours || {}) };
    const windows = [...(next[key] || [])];
    windows.splice(index, 1);
    if (!windows.length) delete next[key];
    else next[key] = windows;
    onChange(studio ? next : Object.keys(next).length ? next : {});
  }

  return (
    <fieldset className="md:col-span-2">
      <legend className="mb-2 text-sm text-white/70">{label}</legend>
      {!studio ? (
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
            onClick={() => onChange(value && Object.keys(value).length ? value : defaultWeek())}
            className={`rounded-full px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] transition ${
              custom ? "admin-chip-active" : "bg-white/10 text-white/70"
            }`}
          >
            Custom hours
          </button>
        </div>
      ) : null}

      {custom ? (
        <div className="space-y-3">
          {DAY_KEYS.map((key) => {
            const windows = hours?.[key] || [];
            const on = windows.length > 0;
            return (
              <div key={key} className="rounded-xl border border-white/10 px-3 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex w-28 items-center gap-2 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => setDay(key, e.target.checked)}
                    />
                    {DAY_LABELS[key].slice(0, 3)}
                  </label>
                  {!on ? <span className="text-sm text-white/35">Off</span> : null}
                </div>
                {on
                  ? windows.map((win, index) => (
                      <div key={`${key}-${index}`} className="mt-2 flex flex-wrap items-center gap-2 pl-1">
                        <input
                          type="time"
                          className="admin-input !w-auto !py-1.5"
                          value={win.start}
                          onChange={(e) => setWindow(key, index, "start", e.target.value)}
                        />
                        <span className="text-white/40">–</span>
                        <input
                          type="time"
                          className="admin-input !w-auto !py-1.5"
                          value={win.end}
                          onChange={(e) => setWindow(key, index, "end", e.target.value)}
                        />
                        {windows.length > 1 ? (
                          <button
                            type="button"
                            className="text-[0.65rem] uppercase tracking-[0.12em] text-white/40 hover:text-white"
                            onClick={() => removeWindow(key, index)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    ))
                  : null}
                {on ? (
                  <button
                    type="button"
                    className="mt-2 text-[0.65rem] uppercase tracking-[0.12em] text-[#c6a75e] hover:underline"
                    onClick={() => addWindow(key)}
                  >
                    + Add time window
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-white/45">Inherits studio weekly hours.</p>
      )}
    </fieldset>
  );
}
