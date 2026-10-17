export type ColorFamily = 'Red' | 'Orange' | 'Yellow' | 'Green' | 'Blue' | 'Purple' | 'Pink' | 'Brown' | 'Black' | 'Grey' | 'White';

export const COLOR_FAMILIES: { name: ColorFamily; swatch: string }[] = [
  { name: 'Red', swatch: '#dc2626' },
  { name: 'Orange', swatch: '#f97316' },
  { name: 'Yellow', swatch: '#facc15' },
  { name: 'Green', swatch: '#16a34a' },
  { name: 'Blue', swatch: '#2563eb' },
  { name: 'Purple', swatch: '#7c3aed' },
  { name: 'Pink', swatch: '#ec4899' },
  { name: 'Brown', swatch: '#92400e' },
  { name: 'Black', swatch: '#111827' },
  { name: 'Grey', swatch: '#9ca3af' },
  { name: 'White', swatch: '#f9fafb' },
];

const hexToHsl = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, s, l];
};

export const colorFamily = (hex: string): ColorFamily | null => {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  const [h, s, l] = hsl;
  if (l < 0.12) return 'Black';
  if (l > 0.92) return 'White';
  if (s < 0.12) return l < 0.3 ? 'Black' : l > 0.85 ? 'White' : 'Grey';
  if (h < 15 || h >= 345) return l < 0.35 ? 'Brown' : 'Red';
  if (h < 40) return l < 0.42 ? 'Brown' : 'Orange';
  if (h < 68) return 'Yellow';
  if (h < 165) return 'Green';
  if (h < 255) return 'Blue';
  if (h < 295) return 'Purple';
  return 'Pink';
};

export const familiesOf = (colors: string[] | undefined): Set<ColorFamily> => {
  const out = new Set<ColorFamily>();
  (colors || []).forEach(c => { const f = colorFamily(c); if (f) out.add(f); });
  return out;
};
