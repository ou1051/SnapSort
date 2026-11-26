import { categoryFromFilename } from './appHints';
import { estimateBytes } from './format';
import type { ShotRecord } from './types';

/** The subset of media-library metadata SnapSort needs. */
export type LibraryItem = {
  id: string;
  filename: string | null;
  width: number | null;
  height: number | null;
  creationTime: number | null;
  modificationTime: number | null;
  isFavorite: boolean;
};

export function newRecord(item: LibraryItem): ShotRecord {
  const hint = categoryFromFilename(item.filename);
  const width = item.width ?? 0;
  const height = item.height ?? 0;
  return {
    id: item.id,
    filename: item.filename,
    width,
    height,
    createdAt: item.creationTime ?? item.modificationTime ?? Date.now(),
    bytes: estimateBytes(width, height, item.filename),
    bytesEstimated: true,
    isFavorite: item.isFavorite,
    category: hint ?? 'unsorted',
    categorySource: hint ? 'local' : 'none',
    title: null,
    keywords: null,
    expiresOn: null,
    important: false,
    hasCode: false,
    dhash: null,
    pinned: false,
    lastViewedAt: null,
    localDone: false,
    aiDone: false,
    aiError: null,
  };
}

/**
 * Brings the saved records in line with what is in the photo library:
 * new screenshots are added, deleted ones dropped, favourites refreshed.
 * Analysis results of existing screenshots are kept.
 */
export function mergeLibrary(
  existing: Record<string, ShotRecord>,
  items: LibraryItem[],
): { records: Record<string, ShotRecord>; order: string[]; added: number; removed: number } {
  const records: Record<string, ShotRecord> = {};
  let added = 0;
  for (const item of items) {
    const prev = existing[item.id];
    if (prev) {
      records[item.id] =
        prev.isFavorite === item.isFavorite && prev.filename === item.filename
          ? prev
          : { ...prev, isFavorite: item.isFavorite, filename: item.filename };
    } else {
      records[item.id] = newRecord(item);
      added++;
    }
  }
  const removed = Object.keys(existing).filter((id) => !(id in records)).length;
  const order = Object.values(records)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((r) => r.id);
  return { records, order, added, removed };
}

/** Case- and width-insensitive search over title, keywords, category label and file name. */
export function matchesQuery(r: ShotRecord, query: string, categoryLabel: string): boolean {
  const q = normaliseForSearch(query);
  if (!q) return true;
  const haystack = normaliseForSearch(
    [r.title, r.keywords, categoryLabel, r.filename].filter(Boolean).join(' '),
  );
  return q.split(' ').every((part) => haystack.includes(part));
}

function normaliseForSearch(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}
