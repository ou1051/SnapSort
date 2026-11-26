import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, SectionList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatBytes } from '../core/format';
import type { CleanupReason, ShotRecord } from '../core/types';
import { t } from '../i18n';
import { deleteShots, getSuggestions, useAppState } from '../services/store';
import { Button } from '../ui/Button';
import { Thumb } from '../ui/ShotGrid';
import { colors, space, type } from '../ui/theme';

const COLUMNS = 3;
const GAP = 2;
const REASONS: CleanupReason[] = ['expired', 'duplicate', 'stale'];

type Section = { reason: CleanupReason; ids: string[]; data: ShotRecord[][] };

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export default function Review() {
  const s = useAppState();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const size = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  // Everything suggested starts selected; we only remember what the user un-ticked.
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [freed, setFreed] = useState<{ count: number; bytes: number } | null>(null);

  const suggestions = useMemo(() => getSuggestions(s), [s.version, s.settings.strength]); // eslint-disable-line react-hooks/exhaustive-deps

  const sections = useMemo<Section[]>(() => {
    return REASONS.map((reason) => {
      const records = suggestions
        .filter((x) => x.reason === reason)
        .map((x) => s.records[x.id])
        .filter(Boolean);
      return { reason, ids: records.map((r) => r.id), data: chunk(records, COLUMNS) };
    }).filter((sec) => sec.ids.length > 0);
  }, [suggestions]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => {
    const set = new Set<string>();
    for (const x of suggestions) if (!deselected.has(x.id)) set.add(x.id);
    return set;
  }, [suggestions, deselected]);

  const selectedBytes = useMemo(
    () => suggestions.reduce((n, x) => (selected.has(x.id) ? n + x.bytes : n), 0),
    [suggestions, selected],
  );

  const toggle = (id: string) => {
    void Haptics.selectionAsync();
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setSection = (ids: string[], on: boolean) => {
    setDeselected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const runDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const result = await deleteShots(ids);
      if (result.outcome === 'deleted') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setFreed({ count: result.count, bytes: result.bytes });
        setDeselected(new Set());
      } else if (result.outcome === 'failed') {
        Alert.alert(t.deleteFailed);
      }
      // 'cancelled': the user said no in the system dialog — nothing to do.
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    // iOS and Android 11+ show their own confirmation dialog. Older Android does not.
    const systemConfirms = Platform.OS === 'ios' || (Platform.OS === 'android' && Number(Platform.Version) >= 30);
    if (systemConfirms) {
      void runDelete();
      return;
    }
    Alert.alert(t.deleteN(selected.size, formatBytes(selectedBytes)), t.androidTrashNote, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: () => void runDelete() },
    ]);
  };

  const openShot = (id: string) => router.push(`/shot/${encodeURIComponent(id)}?from=review`);

  const banner = freed && (
    <View style={styles.freed}>
      <Text style={styles.freedText}>{t.deletedToast(freed.count, formatBytes(freed.bytes))}</Text>
    </View>
  );

  if (sections.length === 0) {
    return (
      <View style={[styles.empty, { paddingBottom: insets.bottom + space.l }]}>
        {banner}
        <View style={styles.emptyBody}>
          <Text style={[type.title, styles.centerText]}>{t.allClean}</Text>
          <Text style={[type.sub, styles.centerText]}>{t.allCleanSub}</Text>
        </View>
        <Button title={t.done} onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <SectionList
        sections={sections}
        keyExtractor={(row) => row[0].id}
        stickySectionHeadersEnabled={false}
        extraData={selected}
        ListHeaderComponent={
          <View>
            {banner}
            <Text style={[type.small, styles.hint]}>{t.tapToView}</Text>
          </View>
        }
        renderSectionHeader={({ section }) => {
          const allOn = section.ids.every((id) => selected.has(id));
          return (
            <View style={styles.sectionHeader}>
              <View style={styles.flex}>
                <Text style={type.title}>
                  {t.reasonTitle[section.reason]} <Text style={type.sub}>{section.ids.length}</Text>
                </Text>
                <Text style={type.sub}>{t.reasonSub[section.reason]}</Text>
              </View>
              <Pressable onPress={() => setSection(section.ids, !allOn)} hitSlop={10} accessibilityRole="button">
                <Text style={styles.link}>{allOn ? t.selectNone : t.selectAll}</Text>
              </Pressable>
            </View>
          );
        }}
        renderItem={({ item: row }) => (
          <View style={styles.row}>
            {row.map((r, i) => (
              <View key={r.id} style={i === COLUMNS - 1 ? styles.lastInRow : undefined}>
                <Thumb
                  record={r}
                  size={size}
                  selectable
                  selected={selected.has(r.id)}
                  onPress={toggle}
                  onLongPress={openShot}
                />
              </View>
            ))}
          </View>
        )}
        ListFooterComponent={
          <Text style={[type.small, styles.note]}>
            {Platform.OS === 'ios' ? t.iosTrashNote : t.androidTrashNote}
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
      />

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.m }]}>
        <Button
          variant="danger"
          title={selected.size > 0 ? t.deleteN(selected.size, formatBytes(selectedBytes)) : t.nothingSelected}
          disabled={selected.size === 0}
          busy={busy}
          onPress={onDelete}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hint: { paddingHorizontal: space.l, paddingTop: space.s },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space.l,
    paddingTop: space.xl,
    paddingBottom: space.m,
  },
  link: { color: colors.selected, fontSize: 15, fontWeight: '600', marginLeft: space.m },
  row: { flexDirection: 'row' },
  lastInRow: { marginRight: -GAP },
  note: { padding: space.l, textAlign: 'center' },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.l,
    paddingTop: space.m,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  freed: { margin: space.l, marginBottom: 0, padding: space.l, borderRadius: 12, backgroundColor: '#E7F0D8' },
  freedText: { color: colors.ok, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  empty: { flex: 1, padding: space.l, justifyContent: 'space-between' },
  emptyBody: { flex: 1, justifyContent: 'center', gap: space.s },
  centerText: { textAlign: 'center' },
});
