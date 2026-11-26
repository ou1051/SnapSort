import { useSyncExternalStore } from 'react';
import type { CategoryOrUnsorted } from '../core/categories';
import { computeSuggestions, summarize, type CleanupSummary } from '../core/cleanup';
import { mergeLibrary } from '../core/merge';
import type { ShotRecord, Suggestion } from '../core/types';
import { lang } from '../i18n';
import { AiError, analyzeLocally, classifyWithAi } from './analyze';
import {
  deleteAssets,
  fetchScreenshotMetadata,
  getLibraryAccess,
  requestLibraryAccess,
  type DeleteOutcome,
  type LibraryAccess,
} from './library';
import { refreshWeeklyReminder } from './notifications';
import { readJson, writeJson } from './persist';
import { DEFAULT_SETTINGS, getApiKey, loadSettings, saveSettings, setApiKey as storeApiKey, type Settings } from './settings';

/**
 * App state lives here, outside React, so the background task can use the
 * same code. Screens subscribe with useAppState().
 *
 * Flow: sync() reads the screenshot list → mergeLibrary() → the work queue
 * analyses new screenshots on the phone (size, QR code, duplicate hash),
 * then, if enabled, with the AI. After every change the cleanup
 * suggestions and the weekly reminder are refreshed.
 */

export type Phase = 'idle' | 'scanning' | 'local' | 'ai';

export type AppState = {
  loaded: boolean;
  access: LibraryAccess;
  records: Record<string, ShotRecord>;
  /** Ids, newest first. */
  order: string[];
  phase: Phase;
  progress: { done: number; total: number };
  /** 'key' = invalid API key, 'other' = temporary trouble. */
  aiProblem: 'key' | 'other' | null;
  settings: Settings;
  hasApiKey: boolean;
  /** Bumped on every change; use it as a memo dependency. */
  version: number;
};

const RECORDS_FILE = 'records.v1.json';

let state: AppState = {
  loaded: false,
  access: 'undetermined',
  records: {},
  order: [],
  phase: 'idle',
  progress: { done: 0, total: 0 },
  aiProblem: null,
  settings: DEFAULT_SETTINGS,
  hasApiKey: false,
  version: 0,
};

const listeners = new Set<() => void>();
let emitTimer: ReturnType<typeof setTimeout> | null = null;

function emitNow() {
  if (emitTimer) {
    clearTimeout(emitTimer);
    emitTimer = null;
  }
  state = { ...state, version: state.version + 1 };
  listeners.forEach((l) => l());
}

/** Coalesces rapid updates (e.g. during analysis) into ~4 renders per second. */
function emitSoon() {
  if (emitTimer) return;
  emitTimer = setTimeout(emitNow, 250);
}

function set(patch: Partial<AppState>, immediate = true) {
  state = { ...state, ...patch };
  if (immediate) emitNow();
  else emitSoon();
}

export function getState(): AppState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

// ---------------------------------------------------------------- persistence

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void writeJson(RECORDS_FILE, state.records);
  }, 1500);
}

export async function flushSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await writeJson(RECORDS_FILE, state.records);
}

function updateRecord(id: string, patch: Partial<ShotRecord>, immediate = false) {
  const prev = state.records[id];
  if (!prev) return;
  // Mutated in place on purpose: copying thousands of records per update is
  // slow, and consumers re-render on `version`, not on object identity.
  state.records[id] = { ...prev, ...patch };
  set({}, immediate);
  scheduleSave();
}

// ---------------------------------------------------------------- derived data

let suggestionCache: { version: number; strength: string; hour: number; value: Suggestion[] } | null = null;

/** Cleanup suggestions for the current state (memoised per state version). */
export function getSuggestions(s: AppState = state): Suggestion[] {
  const hour = Math.floor(Date.now() / (60 * 60 * 1000)); // recompute at least hourly
  if (
    suggestionCache &&
    suggestionCache.version === s.version &&
    suggestionCache.strength === s.settings.strength &&
    suggestionCache.hour === hour
  ) {
    return suggestionCache.value;
  }
  const value = computeSuggestions(
    s.order.map((id) => s.records[id]),
    Date.now(),
    s.settings.strength,
  );
  suggestionCache = { version: s.version, strength: s.settings.strength, hour, value };
  return value;
}

export function getSummary(s: AppState = state): CleanupSummary {
  return summarize(getSuggestions(s));
}

async function refreshReminder() {
  try {
    await refreshWeeklyReminder(getSummary(), state.settings);
  } catch (e) {
    console.warn('[store] reminder', e);
  }
}

// ---------------------------------------------------------------- lifecycle

let initPromise: Promise<void> | null = null;

export function init(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const [settings, records, key, access] = await Promise.all([
        loadSettings(),
        readJson<Record<string, ShotRecord>>(RECORDS_FILE, {}),
        getApiKey(),
        getLibraryAccess(),
      ]);
      const order = Object.values(records)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((r) => r.id);
      set({ loaded: true, settings, records, order, hasApiKey: !!key, access });
    })();
  }
  return initPromise;
}

export async function askForLibraryAccess(): Promise<LibraryAccess> {
  const access = await requestLibraryAccess();
  set({ access });
  if (access === 'granted' || access === 'limited') void sync();
  return access;
}

export async function refreshAccess(): Promise<LibraryAccess> {
  const access = await getLibraryAccess();
  if (access !== state.access) set({ access });
  return access;
}

let syncing: Promise<void> | null = null;

/** Reads the screenshot list, merges it and starts the analysis queue. */
export function sync(options: { budget?: WorkBudget } = {}): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      await init();
      const access = await refreshAccess();
      if (access !== 'granted' && access !== 'limited') return;
      if (state.order.length === 0) set({ phase: 'scanning' });
      const items = await fetchScreenshotMetadata();
      const merged = mergeLibrary(state.records, items);
      set({ records: merged.records, order: merged.order, phase: state.phase === 'scanning' ? 'idle' : state.phase });
      if (merged.added || merged.removed) scheduleSave();
    } catch (e) {
      console.warn('[store] sync failed', e);
      set({ phase: 'idle' });
    } finally {
      syncing = null;
    }
    await runQueue(options.budget);
  })();
  return syncing;
}

// ---------------------------------------------------------------- work queue

export type WorkBudget = { maxLocal?: number; maxAi?: number; deadline?: number };

let queueRunning: Promise<void> | null = null;
let rerunRequested = false;
let stopRequested = false;

/** Pauses analysis (e.g. when the app goes to the background). */
export function pauseWork() {
  stopRequested = true;
}

async function pool<T>(items: T[], size: number, worker: (item: T) => Promise<'continue' | 'stop'>) {
  let index = 0;
  let stopped = false;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (!stopped && !stopRequested && index < items.length) {
      const item = items[index++];
      if ((await worker(item)) === 'stop') stopped = true;
    }
  });
  await Promise.all(runners);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function runQueue(budget: WorkBudget = {}): Promise<void> {
  if (queueRunning) {
    // New work arrived while busy (new screenshot, settings change): go again afterwards.
    rerunRequested = true;
    return queueRunning;
  }
  stopRequested = false;
  rerunRequested = false;
  queueRunning = (async () => {
    try {
      await runLocalPhase(budget);
      await runAiPhase(budget);
    } finally {
      set({ phase: 'idle', progress: { done: 0, total: 0 } });
      queueRunning = null;
      await flushSave();
      await refreshReminder();
    }
    if (rerunRequested && !stopRequested && budget.deadline === undefined) {
      await runQueue(budget);
    }
  })();
  return queueRunning;
}

const overDeadline = (b: WorkBudget) => b.deadline !== undefined && Date.now() > b.deadline;

async function runLocalPhase(budget: WorkBudget) {
  let todo = state.order.filter((id) => !state.records[id]?.localDone);
  if (budget.maxLocal !== undefined) todo = todo.slice(0, budget.maxLocal);
  if (todo.length === 0) return;
  let done = 0;
  set({ phase: 'local', progress: { done, total: todo.length } });
  await pool(todo, 3, async (id) => {
    if (overDeadline(budget)) return 'stop';
    const rec = state.records[id];
    if (!rec) return 'continue';
    try {
      const res = await analyzeLocally(id, !rec.width || !rec.height);
      const patch: Partial<ShotRecord> = { localDone: true, hasCode: res.hasCode, dhash: res.dhash };
      if (res.shape) {
        patch.width = res.shape.width;
        patch.height = res.shape.height;
      }
      if (res.bytes) {
        patch.bytes = res.bytes;
        patch.bytesEstimated = false;
      }
      updateRecord(id, patch);
    } catch (e) {
      // The asset may have been deleted meanwhile; mark done so we do not loop.
      console.warn('[store] local analysis failed', id, e);
      updateRecord(id, { localDone: true });
    }
    done++;
    set({ progress: { done, total: todo.length } }, false);
    return 'continue';
  });
}

async function runAiPhase(budget: WorkBudget) {
  if (!state.settings.aiEnabled || state.aiProblem === 'key') return;
  const apiKey = await getApiKey();
  if (!apiKey) return;

  let todo = state.order.filter((id) => {
    const r = state.records[id];
    return r && !r.aiDone && r.categorySource !== 'user';
  });
  if (budget.maxAi !== undefined) todo = todo.slice(0, budget.maxAi);
  if (todo.length === 0) {
    if (state.aiProblem) set({ aiProblem: null });
    return;
  }

  let done = 0;
  let transientFailures = 0;
  set({ phase: 'ai', progress: { done, total: todo.length }, aiProblem: null });

  await pool(todo, 2, async (id) => {
    if (overDeadline(budget)) return 'stop';
    const rec = state.records[id];
    if (!rec) return 'continue';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await classifyWithAi({ id, width: rec.width, height: rec.height, apiKey, language: lang });
        const current = state.records[id];
        updateRecord(id, {
          // A category the user picked by hand always wins.
          category: current?.categorySource === 'user' ? current.category : result.category,
          categorySource: current?.categorySource === 'user' ? 'user' : 'ai',
          title: result.title || null,
          keywords: result.keywords || null,
          expiresOn: result.expiresOn,
          important: result.important,
          aiDone: true,
          aiError: null,
        });
        transientFailures = 0;
        break;
      } catch (e) {
        const err = e instanceof AiError ? e : new AiError('unknown');
        if (err.isFatal) {
          set({ aiProblem: 'key' });
          return 'stop';
        }
        if (err.isTransient && attempt < 2) {
          await sleep(2000 * 4 ** attempt);
          continue;
        }
        if (err.isTransient) {
          transientFailures++;
          if (transientFailures >= 3) {
            set({ aiProblem: 'other' });
            return 'stop';
          }
          break; // try this one again on the next sync
        }
        // Image could not be read / unexpected answer: do not retry forever.
        updateRecord(id, { aiDone: true, aiError: err.code });
        break;
      }
    }
    done++;
    set({ progress: { done, total: todo.length } }, false);
    return 'continue';
  });
}

// ---------------------------------------------------------------- user actions

export function markViewed(id: string) {
  updateRecord(id, { lastViewedAt: Date.now() }, true);
}

export function setPinned(id: string, pinned: boolean) {
  updateRecord(id, { pinned }, true);
  void refreshReminder();
}

export function setCategory(id: string, category: CategoryOrUnsorted) {
  updateRecord(id, { category, categorySource: category === 'unsorted' ? 'none' : 'user' }, true);
  void refreshReminder();
}

export type DeleteResult = { outcome: DeleteOutcome; count: number; bytes: number };

/**
 * Asks the OS to delete the given screenshots, then re-reads the library to
 * learn which ones are really gone (the user may cancel the system dialog).
 */
export async function deleteShots(ids: string[]): Promise<DeleteResult> {
  const before = ids.map((id) => state.records[id]).filter(Boolean);
  const { outcome } = await deleteAssets(ids);

  let goneIds: string[] = [];
  try {
    const items = await fetchScreenshotMetadata();
    const merged = mergeLibrary(state.records, items);
    goneIds = ids.filter((id) => !(id in merged.records));
    set({ records: merged.records, order: merged.order });
  } catch {
    if (outcome === 'deleted') {
      const records = { ...state.records };
      ids.forEach((id) => delete records[id]);
      goneIds = ids;
      set({ records, order: state.order.filter((id) => id in records) });
    }
  }
  await flushSave();
  await refreshReminder();
  void runQueue();

  const gone = new Set(goneIds);
  const freed = before.filter((r) => gone.has(r.id));
  return {
    outcome: freed.length > 0 ? 'deleted' : outcome === 'deleted' ? 'failed' : outcome,
    count: freed.length,
    bytes: freed.reduce((sum, r) => sum + r.bytes, 0),
  };
}

export async function updateSettings(patch: Partial<Settings>) {
  const settings = { ...state.settings, ...patch };
  set({ settings });
  await saveSettings(settings);
  await refreshReminder();
  if (patch.aiEnabled) void runQueue();
}

export async function saveApiKey(key: string | null) {
  await storeApiKey(key);
  const hasApiKey = !!(key && key.trim());
  set({ hasApiKey, aiProblem: null });
  if (hasApiKey && state.settings.aiEnabled) void runQueue();
}

/** Clears AI results (not the user's own choices) so everything is sorted again. */
export function reanalyzeAll() {
  const records: Record<string, ShotRecord> = {};
  for (const [id, r] of Object.entries(state.records)) {
    records[id] = r.categorySource === 'user' ? r : { ...r, aiDone: false, aiError: null };
  }
  set({ records, aiProblem: null });
  scheduleSave();
  void runQueue();
}

/** Resumes analysis after the app comes back to the foreground. */
export function resumeWork() {
  // Lift a pause from going to the background; a queue that is still winding
  // down then keeps going (or reruns) instead of stalling.
  stopRequested = false;
  void sync();
}

export function getQueueRunning(): Promise<void> | null {
  return queueRunning;
}

export { DEFAULT_SETTINGS };
