import {
  Album,
  Asset,
  addListener,
  AssetField,
  MediaSubtype,
  MediaType,
  Query,
  getPermissionsAsync,
  presentPermissionsPicker,
  requestPermissionsAsync,
  type AssetMetadata,
} from 'expo-media-library';
import { Platform } from 'react-native';
import type { LibraryItem } from '../core/merge';
import { IS_DEMO, demoDelete, demoImageUri, demoLibrary } from './demo';

/** Browser demo: pretend permission, granted once the user taps the button. */
let demoAccess: 'undetermined' | 'granted' = 'undetermined';

export type LibraryAccess = 'granted' | 'limited' | 'denied' | 'undetermined';

function toAccess(res: { granted: boolean; canAskAgain: boolean; accessPrivileges?: string }): LibraryAccess {
  if (res.granted) return res.accessPrivileges === 'limited' ? 'limited' : 'granted';
  return res.canAskAgain ? 'undetermined' : 'denied';
}

export async function getLibraryAccess(): Promise<LibraryAccess> {
  if (IS_DEMO) return demoAccess;
  try {
    return toAccess(await getPermissionsAsync(false, ['photo']));
  } catch {
    return 'undetermined';
  }
}

export async function requestLibraryAccess(): Promise<LibraryAccess> {
  if (IS_DEMO) {
    demoAccess = 'granted';
    return demoAccess;
  }
  return toAccess(await requestPermissionsAsync(false, ['photo']));
}

/** Lets a user with "limited" access pick more photos (iOS 14+, Android 14+). */
export async function presentLimitedPicker(): Promise<void> {
  if (IS_DEMO) return;
  try {
    await presentPermissionsPicker(['photo']);
  } catch (e) {
    console.warn('[library] picker unavailable', e);
  }
}

/** Album names Android vendors use for screenshots (lower-case match). */
const ANDROID_SCREENSHOT_ALBUM = /screenshot|screen shot|スクリーンショット|bildschirmfoto|capture d.écran|captura|截屏|截图|스크린샷/i;

/**
 * Lightweight metadata of every screenshot on the device, newest first.
 * iOS marks screenshots with a media subtype. Android has no such flag,
 * so we read the vendor's "Screenshots" album(s).
 */
export async function fetchScreenshotMetadata(): Promise<LibraryItem[]> {
  if (IS_DEMO) return demoLibrary();
  if (Platform.OS === 'ios') {
    return new Query()
      .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
      .contains(AssetField.MEDIA_SUBTYPES, MediaSubtype.SCREENSHOT)
      .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
      .exeForMetadata();
  }

  if (Platform.OS === 'android') {
    const albums = (await Album.getAlbumsMetadata()).filter((a) => ANDROID_SCREENSHOT_ALBUM.test(a.title));
    const seen = new Set<string>();
    const all: AssetMetadata[] = [];
    for (const album of albums) {
      const items = await new Query()
        .album(new Album(album.id))
        .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
        .exeForMetadata();
      for (const item of items) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          all.push(item);
        }
      }
    }
    return all.sort((a, b) => timeOf(b) - timeOf(a));
  }

  return [];
}

/** Creation time in ms, falling back to modification time. */
export function timeOf(m: Pick<AssetMetadata, 'creationTime' | 'modificationTime'>): number {
  return m.creationTime ?? m.modificationTime ?? 0;
}

export async function getFileUri(id: string): Promise<string> {
  if (IS_DEMO) return demoImageUri(id);
  return new Asset(id).getUri();
}

export type DeleteOutcome = 'deleted' | 'cancelled' | 'failed';

/**
 * Deletes screenshots. The OS always shows its own confirmation dialog
 * (iOS moves them to "Recently Deleted" for 30 days).
 */
export async function deleteAssets(ids: string[]): Promise<{ outcome: DeleteOutcome; error?: string }> {
  if (ids.length === 0) return { outcome: 'deleted' };
  if (IS_DEMO) {
    demoDelete(ids);
    return { outcome: 'deleted' };
  }
  try {
    await Asset.delete(ids.map((id) => new Asset(id)));
    return { outcome: 'deleted' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Both platforms throw when the user taps "Don't allow" / "Cancel".
    // PHPhotosErrorDomain 3072 = user cancelled (iOS).
    if (/cancel|denied|not grant|did not|user|3072/i.test(message)) return { outcome: 'cancelled' };
    return { outcome: 'failed', error: message };
  }
}

export async function setFavorite(id: string, value: boolean): Promise<void> {
  await new Asset(id).setFavorite(value);
}

/** Calls `onChange` (debounced) when photos are added or removed while the app is open. */
export function watchLibrary(onChange: () => void): () => void {
  if (IS_DEMO) return () => {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const sub = addListener(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(onChange, 800);
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  } catch {
    return () => {};
  }
}
