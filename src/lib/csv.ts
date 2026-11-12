/** One CSV cell: quoted when needed; formulas neutralised so Excel doesn't run them. */
function cell(v: unknown) {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with a BOM, so Excel opens Ukrainian names and symbols correctly. */
export function toCsv(head: string[], rows: unknown[][]) {
  return "﻿" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
