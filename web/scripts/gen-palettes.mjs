// Generates `web/src/lib/palettes.ts` from Material Design 3 source colours.
//
// The scheme is generated here, at build time, so the app ships static CSS
// variables instead of a colour-science runtime dependency. Re-run with:
//   cd web && bun run gen:palettes
//
// Every palette uses `SchemeTonalSpot`, the scheme M3 produces from a source
// colour when the caller asks for no contrast boost, so switching palettes
// changes the hue family without changing the surface/outline relationships.
import { Hct, SchemeTonalSpot, argbFromHex, hexFromArgb } from "@material/material-color-utilities";
import { writeFileSync } from "node:fs";

/** Roles exported to CSS. Names match `--m3-<role>`. */
const ROLES = {
  primary: (s) => s.primaryPalette,
  secondary: (s) => s.secondaryPalette,
  tertiary: (s) => s.tertiaryPalette,
  neutral: (s) => s.neutralPalette,
  "neutral-variant": (s) => s.neutralVariantPalette,
  error: (s) => s.errorPalette,
};

/**
 * Tone per role, taken from the M3 colour-role spec. `light` and `dark` pick
 * different tones from the same palettes, which is how M3 keeps a single hue
 * family legible in both modes.
 */
const TONES = {
  light: {
    primary: 40,
    "on-primary": 100,
    "primary-container": 90,
    "on-primary-container": 10,
    secondary: 40,
    "on-secondary": 100,
    "secondary-container": 90,
    "on-secondary-container": 10,
    tertiary: 40,
    "on-tertiary": 100,
    "tertiary-container": 90,
    "on-tertiary-container": 10,
    error: 40,
    "on-error": 100,
    "error-container": 90,
    "on-error-container": 10,
    background: 98,
    "on-background": 10,
    surface: 98,
    "on-surface": 10,
    "surface-variant": 90,
    "on-surface-variant": 30,
    outline: 50,
    "outline-variant": 80,
    "surface-dim": 87,
    "surface-bright": 98,
    "surface-container-lowest": 100,
    "surface-container-low": 96,
    "surface-container": 94,
    "surface-container-high": 92,
    "surface-container-highest": 90,
    "inverse-surface": 20,
    "on-inverse-surface": 95,
    "inverse-primary": 80,
  },
  dark: {
    primary: 80,
    "on-primary": 20,
    "primary-container": 30,
    "on-primary-container": 90,
    secondary: 80,
    "on-secondary": 20,
    "secondary-container": 30,
    "on-secondary-container": 90,
    tertiary: 80,
    "on-tertiary": 20,
    "tertiary-container": 30,
    "on-tertiary-container": 90,
    error: 80,
    "on-error": 20,
    "error-container": 30,
    "on-error-container": 90,
    background: 6,
    "on-background": 90,
    surface: 6,
    "on-surface": 90,
    "surface-variant": 30,
    "on-surface-variant": 80,
    outline: 60,
    "outline-variant": 30,
    "surface-dim": 6,
    "surface-bright": 24,
    "surface-container-lowest": 4,
    "surface-container-low": 10,
    "surface-container": 12,
    "surface-container-high": 17,
    "surface-container-highest": 22,
    "inverse-surface": 90,
    "on-inverse-surface": 20,
    "inverse-primary": 40,
  },
};

/** Which palette a role's tone is taken from. */
const ROLE_PALETTE = {
  primary: "primary",
  "on-primary": "primary",
  "primary-container": "primary",
  "on-primary-container": "primary",
  secondary: "secondary",
  "on-secondary": "secondary",
  "secondary-container": "secondary",
  "on-secondary-container": "secondary",
  tertiary: "tertiary",
  "on-tertiary": "tertiary",
  "tertiary-container": "tertiary",
  "on-tertiary-container": "tertiary",
  error: "error",
  "on-error": "error",
  "error-container": "error",
  "on-error-container": "error",
  background: "neutral",
  "on-background": "neutral",
  surface: "neutral",
  "on-surface": "neutral",
  "surface-variant": "neutral-variant",
  "on-surface-variant": "neutral-variant",
  outline: "neutral-variant",
  "outline-variant": "neutral-variant",
  "surface-dim": "neutral",
  "surface-bright": "neutral",
  "surface-container-lowest": "neutral",
  "surface-container-low": "neutral",
  "surface-container": "neutral",
  "surface-container-high": "neutral",
  "surface-container-highest": "neutral",
  "inverse-surface": "neutral",
  "on-inverse-surface": "neutral",
  "inverse-primary": "primary",
};

const PALETTES = [
  { id: "indigo", zh: "靛蓝", en: "Indigo", source: "#6366f1" },
  { id: "violet", zh: "紫罗兰", en: "Violet", source: "#8b5cf6" },
  { id: "cyan", zh: "青蓝", en: "Cyan", source: "#06b6d4" },
  { id: "teal", zh: "青绿", en: "Teal", source: "#14b8a6" },
  { id: "green", zh: "苔绿", en: "Green", source: "#22c55e" },
  { id: "amber", zh: "琥珀", en: "Amber", source: "#f59e0b" },
  { id: "orange", zh: "橘橙", en: "Orange", source: "#f97316" },
  { id: "rose", zh: "玫瑰", en: "Rose", source: "#f43f5e" },
  { id: "magenta", zh: "品红", en: "Magenta", source: "#d946ef" },
  { id: "slate", zh: "石墨", en: "Slate", source: "#64748b" },
];

function schemeFor(source, dark) {
  const hct = Hct.fromInt(argbFromHex(source));
  const scheme = new SchemeTonalSpot(hct, dark, 0.0);
  const out = {};
  for (const [role, tone] of Object.entries(TONES[dark ? "dark" : "light"])) {
    const paletteKey = ROLE_PALETTE[role];
    const palette = ROLES[paletteKey](scheme);
    out[role] = hexFromArgb(palette.tone(tone));
  }
  return out;
}

const lines = [
  "// Generated by scripts/gen-palettes.mjs — do not edit by hand.",
  "// Material Design 3 tonal-spot schemes, one light and one dark block per palette.",
  "",
  "export interface Palette {",
  "  id: string;",
  "  zh: string;",
  "  en: string;",
  "  source: string;",
  "  light: Record<string, string>;",
  "  dark: Record<string, string>;",
  "}",
  "",
  "export const PALETTES: Palette[] = [",
];

for (const p of PALETTES) {
  const light = schemeFor(p.source, false);
  const dark = schemeFor(p.source, true);
  lines.push("  {");
  lines.push(`    id: ${JSON.stringify(p.id)},`);
  lines.push(`    zh: ${JSON.stringify(p.zh)},`);
  lines.push(`    en: ${JSON.stringify(p.en)},`);
  lines.push(`    source: ${JSON.stringify(p.source)},`);
  lines.push(`    light: ${JSON.stringify(light, null, 0).replace(/"/g, '"')},`);
  lines.push(`    dark: ${JSON.stringify(dark, null, 0)},`);
  lines.push("  },");
}

lines.push("];", "", "/** Palette used when nothing has been chosen yet. */", 'export const DEFAULT_PALETTE = "teal";', "");

writeFileSync(new URL("../src/lib/palettes.ts", import.meta.url), lines.join("\n"));
console.log(`wrote ${PALETTES.length} palettes`);

// Static CSS so the pre-hydration script only has to set two data attributes;
// doing colour math before first paint would either flash or need a bundle.
const css = [
  "/* Generated by scripts/gen-palettes.mjs — do not edit by hand. */",
  "/* Each palette exposes M3 colour roles as --m3-<role> for both tones. */",
  "",
];
for (const p of PALETTES) {
  const light = schemeFor(p.source, false);
  const dark = schemeFor(p.source, true);
  for (const [tone, roles] of [
    ["light", light],
    ["dark", dark],
  ]) {
    css.push(`:root[data-palette="${p.id}"][data-tone="${tone}"] {`);
    for (const [role, value] of Object.entries(roles)) css.push(`  --m3-${role}: ${value};`);
    css.push("}", "");
  }
}
writeFileSync(new URL("../src/styles/palettes.css", import.meta.url), css.join("\n"));
console.log("wrote palettes.css");
