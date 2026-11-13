/** Read-only 1–5 star rating. */
export function Stars({ value, size = "text-lg", label }: { value: number; size?: string; label?: string }) {
  return (
    <span className={`${size} tracking-tight`} role="img" aria-label={label ?? `${value} / 5`}>
      <span className="text-amber-500">{"★".repeat(value)}</span>
      <span className="text-line">{"★".repeat(5 - value)}</span>
    </span>
  );
}
