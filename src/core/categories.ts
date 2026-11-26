/**
 * The fixed set of categories every screenshot is sorted into.
 *
 * Each category also carries a default "shelf life": how many days a
 * screenshot of that kind is usually still useful. The cleanup engine
 * (see cleanup.ts) uses it to decide what to suggest for deletion.
 */

export const CATEGORY_IDS = [
  'ticket',
  'coupon',
  'shopping',
  'receipt',
  'chat',
  'map',
  'info',
  'tech',
  'other',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

/** 'unsorted' = not analysed yet, or nothing could be recognised. */
export type CategoryOrUnsorted = CategoryId | 'unsorted';

export type CategoryDef = {
  id: CategoryId;
  /** Days until a screenshot of this kind is suggested for cleanup (standard mode). */
  shelfLifeDays: number;
  /** Accent colour used for the dot / chip in the UI. */
  color: string;
};

export const CATEGORIES: Record<CategoryId, CategoryDef> = {
  // Boarding passes, event tickets, reservations. Expiry date wins when known.
  ticket: { id: 'ticket', shelfLifeDays: 30, color: '#C2410C' },
  // Coupons, loyalty / payment barcodes, vouchers.
  coupon: { id: 'coupon', shelfLifeDays: 60, color: '#B45309' },
  // Product pages, price comparisons, wish lists.
  shopping: { id: 'shopping', shelfLifeDays: 30, color: '#0F766E' },
  // Order confirmations, receipts, payment / transfer confirmations.
  // Kept longer because of returns and warranty.
  receipt: { id: 'receipt', shelfLifeDays: 120, color: '#4D7C0F' },
  // Chats and social media posts.
  chat: { id: 'chat', shelfLifeDays: 60, color: '#1D4ED8' },
  // Maps, directions, timetables.
  map: { id: 'map', shelfLifeDays: 14, color: '#7C3AED' },
  // Articles, recipes, schedules, notes, "read later".
  info: { id: 'info', shelfLifeDays: 180, color: '#BE185D' },
  // Error messages, settings screens, code.
  tech: { id: 'tech', shelfLifeDays: 30, color: '#475569' },
  // Memes, photos of people, anything unclear.
  other: { id: 'other', shelfLifeDays: 90, color: '#78716C' },
};

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value);
}
