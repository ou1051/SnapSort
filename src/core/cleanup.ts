import { CATEGORIES } from './categories';
import { hammingDistance } from './dhash';
import type { CleanupReason, CleanupStrength, ShotRecord, Suggestion } from './types';

/**
 * The cleanup engine. Pure function: records in, suggestions out.
 *
 * A screenshot is suggested for deletion for exactly one reason, checked in
 * this order:
 *   1. expired   – it has a known expiry date (ticket, coupon…) that has passed
 *   2. duplicate – a near-identical screenshot exists; the newest one is kept
 *   3. stale     – it is older than its category's shelf life and was not
 *                  opened in SnapSort since
 *
 * Never suggested: favourites, screenshots the user pinned with "keep", and
 * screenshots the AI marked as important (IDs, contracts, passwords…).
 */

const DAY = 24 * 60 * 60 * 1000;

export const STRENGTH_FACTOR: Record<CleanupStrength, number> = {
  gentle: 2,
  standard: 1,
  tidy: 0.5,
};

/** Shelf life for screenshots that could not be categorised. */
export const UNSORTED_SHELF_LIFE_DAYS = 90;

/** Two shots within this window may be a burst of the same screen. */
export const BURST_WINDOW_MS = 2 * 60 * 1000;
/** Max differing bits (of 64) for shots in a burst to count as the same screen. */
export const BURST_MAX_DISTANCE = 6;
/** Hashes with fewer set or unset bits than this come from near-blank images and are unreliable. */
const MIN_HASH_ENTROPY_BITS = 6;

export function isProtected(r: ShotRecord): boolean {
  return r.pinned || r.isFavorite || r.important;
}

/** Local calendar date (YYYY-MM-DD) for a timestamp. */
export function localDateString(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** true once the whole expiry day is over (the day after expiresOn has started). */
export function isExpired(expiresOn: string | null, now: number): boolean {
  if (!expiresOn) return false;
  return localDateString(now) > expiresOn;
}

export function shelfLifeDays(r: ShotRecord, strength: CleanupStrength): number {
  const base = r.category === 'unsorted' ? UNSORTED_SHELF_LIFE_DAYS : CATEGORIES[r.category].shelfLifeDays;
  return base * STRENGTH_FACTOR[strength];
}

export function isStale(r: ShotRecord, now: number, strength: CleanupStrength): boolean {
  // A known future expiry date is the authority: keep until then.
  if (r.expiresOn && !isExpired(r.expiresOn, now)) return false;
  const lastTouched = Math.max(r.createdAt, r.lastViewedAt ?? 0);
  return now - lastTouched > shelfLifeDays(r, strength) * DAY;
}

function popcountHex(hex: string): number {
  return hammingDistance(hex, '0'.repeat(hex.length));
}

function hashIsInformative(hash: string | null): hash is string {
  if (!hash || hash.length !== 16) return false;
  const ones = popcountHex(hash);
  return ones >= MIN_HASH_ENTROPY_BITS && 64 - ones >= MIN_HASH_ENTROPY_BITS;
}

/** Union-find helper. */
function makeSets(n: number) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  return { find, union };
}

/**
 * Groups near-identical screenshots. Returns a map from every non-kept
 * duplicate id to the id of the screenshot that is kept.
 */
export function findDuplicates(records: ShotRecord[]): Map<string, string> {
  const shots = records
    .filter((r) => hashIsInformative(r.dhash))
    .sort((a, b) => a.createdAt - b.createdAt);
  const sets = makeSets(shots.length);

  // 1) Bursts: shots close in time that look almost the same. Sorted by time,
  //    so the inner loop stops as soon as the window is left (O(n·k), not O(n²)).
  for (let i = 0; i < shots.length; i++) {
    for (let j = i + 1; j < shots.length; j++) {
      const a = shots[i];
      const b = shots[j];
      if (b.createdAt - a.createdAt > BURST_WINDOW_MS) break;
      if (a.width !== b.width || a.height !== b.height) continue;
      if (hammingDistance(a.dhash as string, b.dhash as string) <= BURST_MAX_DISTANCE) {
        sets.union(i, j);
      }
    }
  }

  // 2) Identical screens saved at different times (same size and same hash).
  const firstByKey = new Map<string, number>();
  shots.forEach((s, i) => {
    const key = `${s.width}x${s.height}:${s.dhash}`;
    const first = firstByKey.get(key);
    if (first === undefined) firstByKey.set(key, i);
    else sets.union(first, i);
  });

  const groups = new Map<number, ShotRecord[]>();
  shots.forEach((s, i) => {
    const root = sets.find(i);
    const list = groups.get(root) ?? [];
    list.push(s);
    groups.set(root, list);
  });

  const result = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // Keep: a protected one if any, otherwise the most recently viewed, otherwise the newest.
    const keep = [...group].sort((a, b) => {
      const pa = isProtected(a) ? 1 : 0;
      const pb = isProtected(b) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const va = a.lastViewedAt ?? 0;
      const vb = b.lastViewedAt ?? 0;
      if (va !== vb) return vb - va;
      return b.createdAt - a.createdAt;
    })[0];
    for (const s of group) {
      if (s.id !== keep.id) result.set(s.id, keep.id);
    }
  }
  return result;
}

export function computeSuggestions(
  records: ShotRecord[],
  now: number,
  strength: CleanupStrength,
): Suggestion[] {
  const duplicates = findDuplicates(records);
  const out: Suggestion[] = [];

  for (const r of records) {
    if (isProtected(r)) continue;

    let reason: CleanupReason | null = null;
    let keptId: string | undefined;

    if (isExpired(r.expiresOn, now)) {
      reason = 'expired';
    } else if (duplicates.has(r.id)) {
      reason = 'duplicate';
      keptId = duplicates.get(r.id);
    } else if (isStale(r, now, strength)) {
      reason = 'stale';
    }

    if (reason) out.push({ id: r.id, reason, bytes: r.bytes, ...(keptId ? { keptId } : {}) });
  }

  const order: Record<CleanupReason, number> = { expired: 0, duplicate: 1, stale: 2 };
  const byId = new Map(records.map((r) => [r.id, r]));
  return out.sort(
    (a, b) =>
      order[a.reason] - order[b.reason] ||
      (byId.get(a.id)?.createdAt ?? 0) - (byId.get(b.id)?.createdAt ?? 0),
  );
}

export type CleanupSummary = {
  count: number;
  bytes: number;
  byReason: Record<CleanupReason, { count: number; bytes: number }>;
};

export function summarize(suggestions: Suggestion[]): CleanupSummary {
  const byReason: CleanupSummary['byReason'] = {
    expired: { count: 0, bytes: 0 },
    duplicate: { count: 0, bytes: 0 },
    stale: { count: 0, bytes: 0 },
  };
  let bytes = 0;
  for (const s of suggestions) {
    byReason[s.reason].count++;
    byReason[s.reason].bytes += s.bytes;
    bytes += s.bytes;
  }
  return { count: suggestions.length, bytes, byReason };
}

/** Whether the weekly reminder is worth sending at all. */
export function isWorthNotifying(summary: CleanupSummary): boolean {
  return summary.byReason.expired.count > 0 || summary.count >= 5 || summary.bytes >= 25 * 1024 * 1024;
}
