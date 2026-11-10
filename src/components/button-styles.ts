// Plain (non-client) module so both server and client components can use it.

const VARIANTS = {
  primary: "bg-ink text-white hover:bg-brand",
  brand: "bg-brand text-white hover:bg-brand-dark",
  ghost: "border border-line bg-white text-ink hover:border-brand hover:text-brand",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
} as const;

export type Variant = keyof typeof VARIANTS;

export function buttonClass(variant: Variant = "primary", size: "sm" | "md" = "md") {
  const pad = size === "sm" ? "px-3.5 py-1.5 text-sm" : "px-6 py-3";
  return `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:opacity-60 ${pad} ${VARIANTS[variant]}`;
}

