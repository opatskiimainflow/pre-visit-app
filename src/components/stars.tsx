/** Read-only 1–5 star rating. */
export function Stars({ value, size = "text-lg" }: { value: number; size?: string }) {
  return (
    <span className={`${size} tracking-tight`} role="img" aria-label={`${value} out of 5 stars`}>
      <span className="text-amber-500">{"★".repeat(value)}</span>
      <span className="text-line">{"★".repeat(5 - value)}</span>
    </span>
  );
}
