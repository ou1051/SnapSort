import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, CATEGORY_IDS } from '../core/categories';
import type { CleanupStrength } from '../core/types';
import { categoryLabel, t } from '../i18n';
import { IS_DEMO } from '../services/demo';
import { requestNotificationPermission } from '../services/notifications';
import { reanalyzeAll, saveApiKey, updateSettings, useAppState } from '../services/store';
import { Button } from '../ui/Button';
import { card, colors, space, type } from '../ui/theme';

const STRENGTHS: CleanupStrength[] = ['gentle', 'standard', 'tidy'];

export default function SettingsScreen() {
  const s = useAppState();
  const insets = useSafeAreaInsets();
  const [keyDraft, setKeyDraft] = useState('');
  const [notifBlocked, setNotifBlocked] = useState(false);

  const toggleReminder = async (on: boolean) => {
    if (on) {
      const ok = await requestNotificationPermission();
      setNotifBlocked(!ok);
      if (!ok) return;
    }
    await updateSettings({ weeklyReminder: on });
  };

  const onSaveKey = async () => {
    await saveApiKey(keyDraft);
    setKeyDraft('');
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + space.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cleanup strength */}
        <Text style={[type.label, styles.section]}>{t.sectionCleanup}</Text>
        <View style={card}>
          {STRENGTHS.map((st, i) => (
            <Pressable
              key={st}
              onPress={() => void updateSettings({ strength: st })}
              style={[styles.row, i > 0 && styles.line]}
              accessibilityRole="radio"
              accessibilityState={{ checked: s.settings.strength === st }}
            >
              <View style={styles.flex}>
                <Text style={type.body}>{t.strength[st]}</Text>
                <Text style={type.small}>{t.strengthSub[st]}</Text>
              </View>
              <View style={[styles.radio, s.settings.strength === st && styles.radioOn]} />
            </Pressable>
          ))}
        </View>

        {/* Reminder */}
        <Text style={[type.label, styles.section]}>{t.sectionReminder}</Text>
        <View style={card}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={type.body}>{t.weeklyReminder}</Text>
              <Text style={type.small}>{t.weeklyReminderSub}</Text>
            </View>
            <Switch value={s.settings.weeklyReminder} onValueChange={(v) => void toggleReminder(v)} />
          </View>
          {notifBlocked && (
            <Pressable style={[styles.row, styles.line]} onPress={() => void Linking.openSettings()}>
              <Text style={[type.sub, styles.flex]}>{t.notifDenied}</Text>
              <Text style={styles.link}>{t.openSettings}</Text>
            </Pressable>
          )}
        </View>

        {/* AI */}
        <Text style={[type.label, styles.section]}>{t.sectionAi}</Text>
        <View style={card}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={type.body}>{t.aiToggle}</Text>
            </View>
            <Switch value={s.settings.aiEnabled} onValueChange={(v) => void updateSettings({ aiEnabled: v })} />
          </View>
          <Text style={[type.small, styles.explain]}>{t.aiToggleSub}</Text>

          {IS_DEMO && <Text style={[type.small, styles.explain]}>{t.demoAiNote}</Text>}
          {s.settings.aiEnabled && !IS_DEMO && (
            <View style={[styles.keyBox, styles.line]}>
              <Text style={type.body}>{t.apiKey}</Text>
              {s.hasApiKey && s.aiProblem !== 'key' ? (
                <View style={styles.keyRow}>
                  <Text style={[type.sub, styles.flex]}>✓ {t.apiKeySaved}</Text>
                  <Pressable onPress={() => void saveApiKey(null)} hitSlop={8}>
                    <Text style={styles.link}>{t.remove}</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  {s.aiProblem === 'key' && <Text style={[type.small, { color: colors.danger }]}>{t.aiErrorKey}</Text>}
                  <TextInput
                    value={keyDraft}
                    onChangeText={setKeyDraft}
                    placeholder={t.apiKeyPlaceholder}
                    placeholderTextColor={colors.faint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    style={styles.input}
                    onSubmitEditing={() => void onSaveKey()}
                  />
                  <Button title={t.save} onPress={() => void onSaveKey()} disabled={!keyDraft.trim()} />
                </>
              )}
            </View>
          )}
        </View>

        <Button
          variant="quiet"
          title={t.reanalyze}
          onPress={() => {
            reanalyzeAll();
            Alert.alert(t.reanalyzeDone);
          }}
          style={styles.section}
        />

        {/* Shelf life reference */}
        <Text style={[type.label, styles.section]}>{t.shelfLifeTitle}</Text>
        <View style={card}>
          {CATEGORY_IDS.map((c, i) => (
            <View key={c} style={[styles.row, styles.compact, i > 0 && styles.line]}>
              <View style={[styles.dot, { backgroundColor: CATEGORIES[c].color }]} />
              <Text style={[type.body, styles.flex]}>{categoryLabel(c)}</Text>
              <Text style={type.sub}>{t.days(CATEGORIES[c].shelfLifeDays)}</Text>
            </View>
          ))}
        </View>

        <Text style={[type.label, styles.section]}>{t.privacyTitle}</Text>
        <Text style={type.sub}>{t.privacyBody}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: space.l },
  section: { marginTop: space.xl, marginBottom: space.s, marginLeft: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.l, paddingVertical: space.m, minHeight: 56, gap: space.m },
  compact: { minHeight: 44, paddingVertical: space.s },
  line: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.faint },
  radioOn: { borderColor: colors.text, borderWidth: 7 },
  explain: { paddingHorizontal: space.l, paddingBottom: space.l },
  keyBox: { padding: space.l, gap: space.m },
  keyRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: space.m,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  link: { color: colors.selected, fontSize: 15, fontWeight: '600' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
