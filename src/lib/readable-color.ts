/*
 * Colours that come from the department or the server (status, staffing and priority colours) are drawn as text, dots
 * and borders on the app's own light or dark surface. A department picks them once, usually against a light page, so
 * black or near-black ("#000" for On Scene, dark grey for Standing By) disappears in dark mode and white or pale yellow
 * disappears in light mode. These helpers keep the hue and move the lightness just far enough to read (WCAG 2.x
 * contrast: 4.5:1 for text, 3:1 for marks), and pick black or white for anything drawn on top of such a colour.
 */

export type ColorScheme = 'light' | 'dark';

type Rgb = { r: number; g: number; b: number };

/** The surfaces these colours sit on: rows and cards are white in light mode and gray-800 in dark mode. */
export const THEME_SURFACES: Record<ColorScheme, string> = { light: '#ffffff', dark: '#1f2937' };

/** WCAG minimum contrast for normal text. */
export const TEXT_CONTRAST = 4.5;
/** WCAG minimum contrast for non-text marks (status dots, borders, icons). */
export const MARK_CONTRAST = 3;

const DARK_TEXT = '#111827';
const LIGHT_TEXT = '#ffffff';

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/** Parses #rgb, #rgba, #rrggbb, #rrggbbaa and rgb()/rgba(); null for anything else (names, label classes, empty). */
export const parseColor = (input: string | null | undefined): Rgb | null => {
  if (!input) return null;
  const value = input.trim();

  const hex = value.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex && hex[1]) {
    let digits = hex[1];
    if (digits.length <= 4)
      digits = digits
        .split('')
        .map((d) => d + d)
        .join('');
    return { r: parseInt(digits.slice(0, 2), 16), g: parseInt(digits.slice(2, 4), 16), b: parseInt(digits.slice(4, 6), 16) };
  }

  const rgb = value.match(/^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/i);
  if (rgb && rgb[1] && rgb[2] && rgb[3]) {
    return { r: clamp(Number(rgb[1]), 0, 255), g: clamp(Number(rgb[2]), 0, 255), b: clamp(Number(rgb[3]), 0, 255) };
  }

  return null;
};

const toHex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b]
    .map((c) =>
      Math.round(clamp(c, 0, 255))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;

/** A six-digit hex for a parseable colour (so an alpha suffix can be appended); the input unchanged otherwise. */
export const normalizeColor = (input: string): string => {
  const rgb = parseColor(input);
  return rgb ? toHex(rgb) : input;
};

const channel = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

/** WCAG relative luminance, 0 (black) to 1 (white). */
export const relativeLuminance = ({ r, g, b }: Rgb): number => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG contrast ratio between two colours, 1 to 21; 1 when either cannot be parsed. */
export const contrastRatio = (a: string, b: string): number => {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return 1;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const toHsl = ({ r, g, b }: Rgb): { h: number; s: number; l: number } => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h / 6, s, l };
};

const hueToChannel = (p: number, q: number, t: number): number => {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
};

const fromHsl = (h: number, s: number, l: number): Rgb => {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return { r: hueToChannel(p, q, h + 1 / 3) * 255, g: hueToChannel(p, q, h) * 255, b: hueToChannel(p, q, h - 1 / 3) * 255 };
};

/**
 * The colour itself when it already reads on the scheme's surface; otherwise the same hue made lighter (dark mode) or
 * darker (light mode) until it reaches `minContrast`. Unparseable input comes back unchanged, so a caller's own
 * fallback still applies.
 */
export const readableOnSurface = (color: string | null | undefined, scheme: ColorScheme, minContrast: number = TEXT_CONTRAST, surface: string = THEME_SURFACES[scheme]): string => {
  if (!color) return color ?? '';
  const rgb = parseColor(color);
  if (!rgb || contrastRatio(toHex(rgb), surface) >= minContrast) return color;

  const { h, s, l } = toHsl(rgb);
  const towardLight = scheme === 'dark';
  for (let step = 1; step <= 50; step++) {
    const nextL = towardLight ? l + ((1 - l) * step) / 50 : l - (l * step) / 50;
    const candidate = toHex(fromHsl(h, s, nextL));
    if (contrastRatio(candidate, surface) >= minContrast) return candidate;
  }

  return towardLight ? LIGHT_TEXT : DARK_TEXT;
};

/** Black-ish or white for text, icons or dots drawn on top of a fill in `background`, whichever contrasts more. */
export const contentOnFill = (background: string | null | undefined): string => {
  const bg = background ? normalizeColor(background) : '';
  if (!parseColor(bg)) return LIGHT_TEXT;
  return contrastRatio(DARK_TEXT, bg) >= contrastRatio(LIGHT_TEXT, bg) ? DARK_TEXT : LIGHT_TEXT;
};

/** A translucent wash of the colour (`alphaHex` 00-ff) for a pill or tile behind its own text; transparent if unparseable. */
export const tintOf = (color: string | null | undefined, alphaHex: string = '18'): string => {
  const rgb = parseColor(color);
  return rgb ? `${toHex(rgb)}${alphaHex}` : 'transparent';
};
