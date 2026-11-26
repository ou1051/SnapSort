import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, CATEGORY_IDS, type CategoryOrUnsorted } from '../../core/categories';
import { isExpired } from '../../core/cleanup';
import { formatBytes } from '../../core/format';
import { categoryLabel, formatDate, t } from '../../i18n';
import { imageUri } from '../../services/demo';
import { deleteShots, markViewed, setCategory, setPinned, useAppState } from '../../services/store';
import { Button } from '../../ui/Button';
import { card, colors, space, type } from '../../ui/theme';

export default function ShotScreen() {
  const params = useLocalSearchParams<{ id: string; from?: string }>();
  const id = decodeURIComponentSafe(params.id);
  const s = useAppState();
  const r = s.records[id];
  const insets = useSafeAreaInsets();
  const [picking, setPicking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [now] = useState(() => Date.now());

  // Opening a screenshot counts as "using" it and resets its cleanup clock —
  // except when it is just being checked from the cleanup list.
  const fromReview = params.from === 'review';
  useEffect(() => {
    if (id && !fromReview) markViewed(id);
  }, [id, fromReview]);

  if (!r) {
    return (
      <View style={styles.center}>
        <Text style={type.sub}>{t.noResults}</Text>
      </View>
    );
  }

  const color = r.category === 'unsorted' ? colors.faint : CATEGORIES[r.category].color;
  const expired = isExpired(r.expiresOn, now);

  const onDelete = async () => {
    setDeleting(true);
    try {
      const res = await deleteShots([r.id]);
      if (res.outcome === 'deleted') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      }
    } finally {
      setDeleting(false);
    }
  };

  const choose = (c: CategoryOrUnsorted) => {
    setCategory(r.id, c);
    setPicking(false);
  };

  return (
    <>
      <Stack.Screen options={{ title: r.title ?? '' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}>
        <Image
          source={{ uri: imageUri(r.id) }}
          style={[styles.image, { aspectRatio: r.width && r.height ? r.width / r.height : 9 / 19.5 }]}
          contentFit="contain"
          transition={150}
          accessibilityLabel={r.title ?? undefined}
        />

        <View style={styles.body}>
          {r.title ? <Text style={type.title}>{r.title}</Text> : null}

          <View style={styles.chips}>
            <Pressable
              onPress={() => setPicking(true)}
              style={[styles.chip, { borderColor: color }]}
              accessibilityRole="button"
              accessibilityHint={t.changeCategory}
            >
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={styles.chipText}>{categoryLabel(r.category)}</Text>
              <Text style={styles.chipEdit}> ▾</Text>
            </Pressable>
            {r.hasCode && <Badge text={t.codeBadge} />}
            {r.important && <Badge text={t.importantBadge} />}
          </View>

          <Text style={type.sub}>
            {t.takenOn(formatDate(r.createdAt))} · {r.bytesEstimated ? t.unknownSize : ''}
            {formatBytes(r.bytes)}
          </Text>
          {r.expiresOn && (
            <Text style={[type.sub, expired && { color: colors.danger }]}>
              {expired ? t.expired(formatDate(r.expiresOn)) : t.expires(formatDate(r.expiresOn))}
            </Text>
          )}

          <View style={styles.actions}>
            <Button
              variant={r.pinned ? 'primary' : 'quiet'}
              title={r.pinned ? `✓ ${t.kept}` : t.keep}
              onPress={() => {
                void Haptics.selectionAsync();
                setPinned(r.id, !r.pinned);
              }}
              style={styles.flex}
            />
            <Button variant="danger" title={t.delete} onPress={onDelete} busy={deleting} style={styles.flex} />
          </View>
          <Text style={type.small}>{t.keepHint}</Text>
        </View>
      </ScrollView>

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(false)}>
          <View style={[card, styles.sheet, { marginBottom: insets.bottom + space.l }]}>
            <Text style={[type.label, styles.sheetTitle]}>{t.changeCategory}</Text>
            {[...CATEGORY_IDS].map((c) => (
              <Pressable
                key={c}
                onPress={() => choose(c)}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.bg }]}
                accessibilityRole="button"
                accessibilityState={{ selected: r.category === c }}
              >
                <View style={[styles.dot, { backgroundColor: CATEGORIES[c].color }]} />
                <Text style={[type.body, styles.flex]}>{categoryLabel(c)}</Text>
                {r.category === c && <Text style={styles.tick}>✓</Text>}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

function decodeURIComponentSafe(v: string | undefined): string {
  if (!v) return '';
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', maxHeight: 560, backgroundColor: '#EDEBE6' },
  body: { padding: space.l, gap: space.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginVertical: space.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: 15, fontWeight: '600', color: colors.text },
  chipEdit: { fontSize: 13, color: colors.sub },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.line },
  badgeText: { fontSize: 13, color: colors.text },
  actions: { flexDirection: 'row', gap: space.m, marginTop: space.l },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', padding: space.l },
  sheet: { paddingVertical: space.s },
  sheetTitle: { paddingHorizontal: space.l, paddingVertical: space.m },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.l, minHeight: 50 },
  tick: { fontSize: 17, color: colors.selected, fontWeight: '700' },
});
