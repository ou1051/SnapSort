import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { isWorthNotifying, type CleanupSummary } from '../core/cleanup';
import { formatBytes } from '../core/format';
import { nextWeeklyTime } from '../core/schedule';
import { t } from '../i18n';
import type { Settings } from './settings';

const DIGEST_ID = 'snapsort-weekly-digest';
const CHANNEL_ID = 'cleanup';

let configured = false;

export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t.notifChannel,
      importance: AndroidImportance.DEFAULT,
    });
  }
}

export async function notificationsAllowed(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

/**
 * (Re)schedules the single weekly reminder with up-to-date numbers.
 * Called whenever the suggestions change, from the app and from the
 * background task, so the text is always close to the truth.
 */
export async function refreshWeeklyReminder(summary: CleanupSummary, settings: Settings): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(DIGEST_ID);
  } catch {
    // nothing scheduled yet
  }
  if (!settings.weeklyReminder || !isWorthNotifying(summary)) return;
  if (!(await notificationsAllowed())) return;

  const when = nextWeeklyTime(Date.now(), settings.reminderWeekday, settings.reminderHour);
  await Notifications.scheduleNotificationAsync({
    identifier: DIGEST_ID,
    content: {
      title: t.notifTitle,
      body: t.notifBody(summary.count, formatBytes(summary.bytes), summary.byReason.expired.count),
      data: { url: '/review' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
  });
}
