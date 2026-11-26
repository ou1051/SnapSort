/** Human-readable file size, e.g. 1.2 GB, 48 MB, 820 KB. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = value >= 100 || unit === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

/**
 * Rough size of a screenshot when the real file size cannot be read.
 * Phone screenshots are PNG (iPhone, Pixel) or JPEG (Samsung); measured
 * averages are around 0.35 byte per pixel for UI content.
 */
export function estimateBytes(width: number, height: number, filename: string | null): number {
  const pixels = Math.max(0, width) * Math.max(0, height);
  const isJpeg = !!filename && /\.jpe?g$/i.test(filename);
  const perPixel = isJpeg ? 0.2 : 0.4;
  return Math.round(pixels * perPixel) || 500 * 1024;
}

/** Whole days between two timestamps (floor). */
export function daysBetween(from: number, to: number): number {
  return Math.floor((to - from) / (24 * 60 * 60 * 1000));
}
