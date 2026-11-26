import * as SecureStore from 'expo-secure-store';
import type { CleanupStrength } from '../core/types';
import { readJson, writeJson } from './persist';

export type Settings = {
  /** Send screenshots to Claude for sorting (opt-in). */
  aiEnabled: boolean;
  strength: CleanupStrength;
  /** Weekly "you can free up X MB" reminder. */
  weeklyReminder: boolean;
  /** 1 = Sunday … 7 = Saturday (expo-notifications convention). */
  reminderWeekday: number;
  reminderHour: number;
};

export const DEFAULT_SETTINGS: Settings = {
  aiEnabled: false,
  strength: 'standard',
  weeklyReminder: true,
  reminderWeekday: 1,
  reminderHour: 19,
};

const FILE = 'settings.json';
const KEY_NAME = 'anthropic_api_key';

export async function loadSettings(): Promise<Settings> {
  const saved = await readJson<Partial<Settings>>(FILE, {});
  return { ...DEFAULT_SETTINGS, ...saved };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeJson(FILE, settings);
}

export async function getApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY_NAME);
  } catch {
    return null;
  }
}

export async function setApiKey(key: string | null): Promise<void> {
  if (key && key.trim()) {
    await SecureStore.setItemAsync(KEY_NAME, key.trim(), {
      // Readable by the background task after the first unlock.
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  } else {
    await SecureStore.deleteItemAsync(KEY_NAME);
  }
}
