import { File, Paths } from 'expo-file-system';

/**
 * Tiny JSON-file persistence in the app's document folder.
 * Used instead of AsyncStorage because a library of a few thousand
 * screenshots exceeds AsyncStorage's per-entry limit on Android.
 * Writes go to a temp file first and are then moved into place, so a crash
 * mid-write never leaves a half-written file behind.
 */

export async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    const file = new File(Paths.document, name);
    if (!file.exists) return fallback;
    return JSON.parse(await file.text()) as T;
  } catch (e) {
    console.warn(`[persist] could not read ${name}`, e);
    return fallback;
  }
}

export async function writeJson(name: string, value: unknown): Promise<void> {
  const target = new File(Paths.document, name);
  const tmp = new File(Paths.document, `${name}.tmp`);
  try {
    if (!tmp.exists) tmp.create({ overwrite: true });
    await tmp.write(JSON.stringify(value));
    tmp.moveSync(target, { overwrite: true });
  } catch (e) {
    console.warn(`[persist] could not write ${name}`, e);
  }
}
