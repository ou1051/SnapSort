import type { CategoryId, CategoryOrUnsorted } from './categories';

/** Where the current category came from. Higher sources are trusted more. */
export type CategorySource = 'user' | 'ai' | 'local' | 'none';

/** Everything SnapSort knows about one screenshot. Persisted on the device. */
export type ShotRecord = {
  /** Media-library asset id (ph://… on iOS, content://… on Android). */
  id: string;
  filename: string | null;
  width: number;
  height: number;
  /** Milliseconds since epoch. */
  createdAt: number;
  /** File size in bytes. */
  bytes: number;
  /** true when `bytes` is an estimate (the real size could not be read). */
  bytesEstimated: boolean;
  isFavorite: boolean;

  category: CategoryOrUnsorted;
  categorySource: CategorySource;
  /** Short human title, e.g. "Amazon – wireless earbuds". */
  title: string | null;
  /** Keywords / visible text used for search. */
  keywords: string | null;
  /** Date (YYYY-MM-DD) after which the screenshot is no longer useful, if known. */
  expiresOn: string | null;
  /** AI thinks this is worth keeping long-term (IDs, contracts, passwords…). */
  important: boolean;
  /** A QR / barcode was found in the image on the device. */
  hasCode: boolean;
  /** 64-bit difference hash as 16 hex chars, for duplicate detection. */
  dhash: string | null;

  /** User pressed "keep" – never suggest for cleanup. */
  pinned: boolean;
  /** Last time the user opened it inside SnapSort (ms). */
  lastViewedAt: number | null;

  /** Analysis bookkeeping. */
  localDone: boolean;
  aiDone: boolean;
  aiError: string | null;
};

export type CleanupReason = 'expired' | 'duplicate' | 'stale';

export type Suggestion = {
  id: string;
  reason: CleanupReason;
  bytes: number;
  /** For duplicates: the id of the screenshot that is kept instead. */
  keptId?: string;
};

export type CleanupStrength = 'gentle' | 'standard' | 'tidy';

export type AiResult = {
  category: CategoryId;
  title: string;
  keywords: string;
  expiresOn: string | null;
  important: boolean;
};
