/**
 * Espejo en TypeScript de los pocos tokens que hacen falta fuera de CSS
 * (manifest, viewport, gráficas). La fuente de verdad es `@theme` en app/globals.css.
 */
export const tokens = {
  color: {
    background: "#121110",
    backgroundDeep: "#0c0b0a",
    surface: "#1a1815",
    surfaceRaised: "#211e1b",
    border: "#2a2622",
    textPrimary: "#f2efe9",
    textMuted: "#98928a",
    textSubtle: "#6e6862",
    textDisabled: "#4a453f",
    borderSubtle: "rgba(255, 255, 255, 0.08)",
    accent: "oklch(0.68 0.21 30)",
    accentSoft: "oklch(0.68 0.21 30 / 0.14)",
    success: "oklch(0.72 0.13 155)",
    danger: "oklch(0.72 0.19 25)",
  },
  /** Series de las gráficas de la demo: acento para la principal, neutros para las demás. */
  chart: {
    series: ["oklch(0.68 0.21 30)", "oklch(0.72 0.19 25 / 0.7)", "#98928a", "#6e6862"],
  },
  font: {
    ui: "var(--font-inter-tight), Inter Tight, sans-serif",
  },
} as const;
