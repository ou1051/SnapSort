import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import type { LibraryAccess } from '../services/library';
import { requestNotificationPermission } from '../services/notifications';
import { askForLibraryAccess } from '../services/store';
import { Button } from './Button';
import { colors, space, type } from './theme';

export function Onboarding({ access }: { access: LibraryAccess }) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const denied = access === 'denied';

  const start = async () => {
    setBusy(true);
    try {
      const result = await askForLibraryAccess();
      // Ask for notifications right after, while the user is in "setup" mode.
      if (result === 'granted' || result === 'limited') await requestNotificationPermission();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + space.l }]}>
      <View style={styles.top}>
        <Text style={type.big}>{t.onboardTitle}</Text>
        <Text style={[type.body, styles.lead]}>{t.onboardBody}</Text>
        {[t.onboardPoint1, t.onboardPoint2, t.onboardPoint3].map((p, i) => (
          <View key={p} style={styles.point}>
            <Text style={styles.num}>{i + 1}</Text>
            <Text style={[type.body, styles.pointText]}>{p}</Text>
          </View>
        ))}
      </View>
      {denied ? (
        <View style={{ gap: space.m }}>
          <Text style={type.sub}>{t.deniedBody}</Text>
          <Button title={t.openSettings} onPress={() => void Linking.openSettings()} />
        </View>
      ) : (
        <Button title={t.allowPhotos} onPress={start} busy={busy} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: space.xl, justifyContent: 'space-between', backgroundColor: colors.bg },
  top: { paddingTop: space.xl },
  lead: { marginTop: space.l, marginBottom: space.xl, color: colors.sub },
  point: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.m },
  num: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 13,
    fontWeight: '700',
    marginRight: space.m,
    overflow: 'hidden',
  },
  pointText: { flex: 1 },
});
