import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { t } from '../i18n';
// Importing this module also defines the background task (must happen at startup).
import { registerBackgroundRefresh } from '../services/background';
import { configureNotifications } from '../services/notifications';
import { watchLibrary } from '../services/library';
import { flushSave, init, pauseWork, resumeWork, sync } from '../services/store';
import { colors } from '../ui/theme';

function openFromNotification(response: Notifications.NotificationResponse | null) {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === 'string' && url.startsWith('/')) {
    // Defer until the navigator has mounted (cold start from a notification).
    setTimeout(() => router.push(url as '/review'), 0);
  }
}

export default function RootLayout() {
  useEffect(() => {
    void configureNotifications();
    void init().then(() => {
      resumeWork();
      void registerBackgroundRefresh();
    });

    // Analyse only while the app is open; save when leaving.
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') resumeWork();
      else if (next === 'background') {
        pauseWork();
        void flushSave();
      }
    });

    // A screenshot taken while SnapSort is open is sorted right away.
    const stopWatching = watchLibrary(() => void sync());

    // Tapping the weekly reminder opens the review screen.
    openFromNotification(Notifications.getLastNotificationResponse());
    const tapSub = Notifications.addNotificationResponseReceivedListener(openFromNotification);

    return () => {
      appState.remove();
      tapSub.remove();
      stopWatching();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="index" options={{ title: t.appName, headerLargeTitle: true }} />
        <Stack.Screen name="review" options={{ title: t.reviewTitle }} />
        <Stack.Screen name="category/[id]" options={{ title: '' }} />
        <Stack.Screen name="shot/[id]" options={{ title: '', presentation: 'card' }} />
        <Stack.Screen name="settings" options={{ title: t.settings, presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
