import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { flushSave, sync } from './store';

/**
 * Background refresh: every ~12 hours (when the OS allows it) SnapSort picks
 * up new screenshots, does the cheap on-device checks for a limited batch,
 * and re-schedules the weekly reminder with fresh numbers. The OS gives
 * background tasks about 30 seconds, so the work is capped by a deadline.
 */

export const BACKGROUND_TASK = 'snapsort-background-refresh';

// Must be defined at module scope so the OS can run it without the UI.
TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    await sync({ budget: { maxLocal: 40, maxAi: 10, deadline: Date.now() + 20_000 } });
    await flushSave();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    console.warn('[background] failed', e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundRefresh(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK);
    if (!registered) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_TASK, { minimumInterval: 12 * 60 });
    }
  } catch (e) {
    console.warn('[background] register failed', e);
  }
}
