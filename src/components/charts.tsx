/**
 * Small server-rendered charts in plain HTML/CSS (no chart library, works on Workers).
 * Follows the dataviz rules used across the app: one hue for a single series, thin
 * columns with a rounded data-end, hairline grid, values in text colours, a hover/focus
 * readout on every mark, and a table view so no value depends on hovering.
 */

import { getT } from "@/lib/i18n/server";

export type Column = { key: string; label: string; value: number; note?: string };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * pow >= v / 4)! * pow;
  return Math.ceil(v / step) * step;
}

export async function ColumnChart({
  columns,
  format = (n) => String(n),
  max,
  caption,
  emphasize,
}: {
  columns: Column[];
  format?: (n: number) => string;
  /** Fixed top of the scale (e.g. 100 for percentages); otherwise a rounded max. */
  max?: number;
  caption: string;
  /** Keys whose value is printed above the column even without hover. */
  emphasize?: string[];
}) {
  const top = max ?? niceMax(Math.max(...columns.map((c) => c.value), 0));
  const c_ = (await getT()).t.admin.charts;
  const ticks = [0, 0.5, 1].map((f) => Math.round(top * f));

  return (
    <figure className="min-w-0">
      <div className="flex gap-3">
        {/* y-axis ticks */}
        <div className="relative h-48 w-8 shrink-0 text-right text-xs text-muted" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 leading-none" style={{ bottom: `calc(${(t / top) * 100}% - 0.4em)` }}>
              {format(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {/* gridlines */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-48" aria-hidden>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${(t / top) * 100}%` }} />
            ))}
          </div>
          <ol className="relative flex h-48 items-end">
            {columns.map((c) => {
              const pct = top ? Math.min(100, (c.value / top) * 100) : 0;
              const shown = emphasize?.includes(c.key);
              return (
                <li key={c.key} className="group relative flex h-full flex-1 items-end justify-center outline-none" tabIndex={0}>
                  {/* readout: value first, label second */}
                  <span
                    className={`pointer-events-none absolute z-10 mb-1.5 -translate-x-1/2 rounded-lg px-2 py-1 text-center whitespace-nowrap transition-opacity left-1/2 ${
                      shown
                        ? "text-xs font-semibold text-ink group-hover:bg-ink group-hover:text-white group-focus-visible:bg-ink group-focus-visible:text-white"
                        : "bg-ink text-xs text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                    }`}
                    style={{ bottom: `${pct}%` }}
                  >
                    <span className="font-semibold">{format(c.value)}</span>
                    <span className="hidden font-normal opacity-80 group-hover:inline group-focus-visible:inline">
                      {" "}
                      · {c.label}
                      {c.note ? ` (${c.note})` : ""}
                    </span>
                  </span>
                  <span
                    className="w-full max-w-6 rounded-t-[4px] bg-brand transition-[filter] group-hover:brightness-110 group-focus-visible:brightness-110"
                    style={{ height: `${pct}%`, minHeight: c.value > 0 ? 2 : 0 }}
                    aria-hidden
                  />
                </li>
              );
            })}
          </ol>
          {/* x labels */}
          <ol className="mt-2 flex text-xs text-muted" aria-hidden>
            {columns.map((c, i) => (
              <li
                key={c.key}
                className={`min-w-0 flex-1 truncate px-0.5 text-center max-sm:overflow-visible ${(columns.length - 1 - i) % 2 ? "max-sm:invisible" : ""} ${i === columns.length - 1 ? "max-sm:flex max-sm:justify-end" : ""}`}
              >
                {c.label}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      <DataTable
        head={[c_.week, c_.value]}
        showData={c_.showData}
        rows={columns.map((c) => [`${c.label}${c.note ? ` (${c.note})` : ""}`, format(c.value)])}
      />
    </figure>
  );
}

export type Meter = { key: string; name: string; sub?: string; value: number; total: number };

/** Name, bar and figure per row; each bar is the share of that row's own total. */
export async function MeterList({ rows }: { rows: Meter[] }) {
  const c_ = (await getT()).t.admin.charts;
  return (
    <figure>
      <ul className="grid gap-5">
        {rows.map((r) => {
          const pct = r.total ? Math.round((r.value / r.total) * 100) : 0;
          return (
            <li key={r.key} className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_1fr_auto] sm:items-center sm:gap-4">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{r.name}</p>
                {r.sub && <p className="truncate text-sm text-muted">{r.sub}</p>}
              </div>
              <div
                className="h-3 overflow-hidden rounded-full bg-soft"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={r.total}
                aria-valuenow={r.value}
                aria-label={c_.slotsBooked(r.name, r.value, r.total)}
              >
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%`, minWidth: r.value > 0 ? 6 : 0 }} />
              </div>
              <p className="text-sm whitespace-nowrap text-muted sm:text-right">
                <span className="font-semibold text-ink">{pct}%</span> · {c_.slots(r.value, r.total)}
              </p>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

function DataTable({ head, rows, showData }: { head: string[]; rows: string[][]; showData: string }) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-muted hover:text-ink">{showData}</summary>
      <table className="mt-2 w-full max-w-sm text-left">
        <thead className="text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="py-1 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-ink">
          {rows.map((r) => (
            <tr key={r[0]} className="border-t border-line">
              {r.map((c, i) => (
                <td key={i} className="py-1">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
