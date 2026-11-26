import { Link, Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CATEGORIES, CATEGORY_IDS, type CategoryOrUnsorted } from '../core/categories';
import { formatBytes } from '../core/format';
import { matchesQuery } from '../core/merge';
import type { ShotRecord } from '../core/types';
import { categoryLabel, t } from '../i18n';
import { presentLimitedPicker } from '../services/library';
import { getSummary, useAppState } from '../services/store';
import { Button } from '../ui/Button';
import { Onboarding } from '../ui/Onboarding';
import { EmptyNote, ShotGrid } from '../ui/ShotGrid';
import { card, colors, space, type } from '../ui/theme';

type Group = { id: CategoryOrUnsorted | 'code'; label: string; color: string; count: number; bytes: number };

export default function Home() {
  const s = useAppState();
  const [query, setQuery] = useState('');

  const all = useMemo(() => s.order.map((id) => s.records[id]).filter(Boolean), [s.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const summary = useMemo(() => getSummary(s), [s.version, s.settings.strength]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalBytes = useMemo(() => all.reduce((n, r) => n + r.bytes, 0), [all]);
  const anyEstimated = useMemo(() => all.some((r) => r.bytesEstimated), [all]);

  const groups = useMemo<Group[]>(() => {
    const acc = new Map<string, Group>();
    const add = (id: Group['id'], r: ShotRecord, color: string, label: string) => {
      const g = acc.get(id) ?? { id, label, color, count: 0, bytes: 0 };
      g.count++;
      g.bytes += r.bytes;
      acc.set(id, g);
    };
    for (const r of all) {
      const color = r.category === 'unsorted' ? colors.faint : CATEGORIES[r.category].color;
      add(r.category, r, color, categoryLabel(r.category));
      if (r.hasCode) add('code', r, colors.text, t.withCode);
    }
    const order: Group['id'][] = ['code', ...CATEGORY_IDS, 'unsorted'];
    return order.map((id) => acc.get(id)).filter((g): g is Group => !!g);
  }, [all]);

  const results = useMemo(
    () => (query.trim() ? all.filter((r) => matchesQuery(r, query, categoryLabel(r.category))) : []),
    [all, query],
  );

  if (!s.loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (s.access === 'undetermined' || s.access === 'denied') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Onboarding access={s.access} />
      </>
    );
  }

  const settingsButton = (
    <Link href="/settings" asChild>
      <Pressable hitSlop={12} accessibilityRole="button">
        <Text style={styles.headerLink}>{t.settings}</Text>
      </Pressable>
    </Link>
  );

  const search = (
    <TextInput
      value={query}
      onChangeText={setQuery}
      placeholder={t.searchPlaceholder}
      placeholderTextColor={colors.faint}
      style={styles.search}
      clearButtonMode="while-editing"
      returnKeyType="search"
      autoCorrect={false}
    />
  );

  if (query.trim()) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, headerRight: () => settingsButton }} />
        <ShotGrid
          records={results}
          onPress={(id) => router.push(`/shot/${encodeURIComponent(id)}`)}
          header={<View style={styles.pad}>{search}</View>}
          empty={<EmptyNote text={t.noResults} />}
        />
      </>
    );
  }

  const busy = s.phase !== 'idle';
  const progressText =
    s.phase === 'scanning'
      ? t.scanning
      : s.phase === 'local'
        ? t.analyzing(s.progress.done, s.progress.total)
        : s.phase === 'ai'
          ? t.analyzingAi(s.progress.done, s.progress.total)
          : '';

  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerRight: () => settingsButton }} />
      <ScrollView contentContainerStyle={styles.pad} contentInsetAdjustmentBehavior="automatic">
        {search}

        {/* The one thing that matters: how much can go, and one button to review it. */}
        <View style={[card, styles.hero]}>
          <Text style={type.small}>
            {t.screenshots} {t.shotsCount(all.length)} · {anyEstimated ? t.unknownSize : ''}
            {formatBytes(totalBytes)}
          </Text>
          {summary.count > 0 ? (
            <>
              <Text style={[type.sub, styles.heroLabel]}>{t.canFree}</Text>
              <Text style={type.big}>{formatBytes(summary.bytes)}</Text>
              <Button title={t.reviewCta(summary.count)} onPress={() => router.push('/review')} style={styles.heroButton} />
            </>
          ) : (
            <>
              <Text style={[type.title, styles.heroLabel]}>{t.allClean}</Text>
              <Text style={type.sub}>{t.allCleanSub}</Text>
            </>
          )}
          {busy && (
            <View style={styles.progress}>
              <ActivityIndicator size="small" color={colors.sub} />
              <Text style={[type.small, styles.progressText]}>{progressText}</Text>
            </View>
          )}
        </View>

        {s.access === 'limited' && (
          <Notice text={t.limitedNote} action={t.changeAccess} onPress={() => void presentLimitedPicker()} />
        )}
        {s.settings.aiEnabled && s.aiProblem === 'key' && (
          <Notice text={t.aiErrorKey} action={t.fix} onPress={() => router.push('/settings')} />
        )}
        {s.settings.aiEnabled && s.aiProblem === 'other' && <Notice text={t.aiErrorOther} />}
        {(!s.settings.aiEnabled || !s.hasApiKey) && all.length > 0 && (
          <Notice text={t.aiOffHint} action={t.turnOn} onPress={() => router.push('/settings')} />
        )}

        <Text style={[type.label, styles.section]}>{t.categories}</Text>
        <View style={card}>
          {groups.map((g, i) => (
            <Pressable
              key={g.id}
              onPress={() => router.push(`/category/${g.id}`)}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <View style={[styles.dot, { backgroundColor: g.color }]} />
              <Text style={[type.body, styles.rowLabel]}>{g.label}</Text>
              <Text style={type.sub}>
                {g.count} · {formatBytes(g.bytes)}
              </Text>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

function Notice({ text, action, onPress }: { text: string; action?: string; onPress?: () => void }) {
  return (
    <View style={[card, styles.notice]}>
      <Text style={[type.sub, styles.noticeText]}>{text}</Text>
      {action && onPress && (
        <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
          <Text style={styles.noticeAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: space.l, paddingBottom: space.xxl },
  headerLink: { fontSize: 16, color: colors.text, fontWeight: '500' },
  search: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: space.l,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    marginBottom: space.l,
  },
  hero: { padding: space.xl },
  heroLabel: { marginTop: space.l, marginBottom: space.xs },
  heroButton: { marginTop: space.l },
  progress: { flexDirection: 'row', alignItems: 'center', marginTop: space.l },
  progressText: { marginLeft: space.s },
  notice: { flexDirection: 'row', alignItems: 'center', padding: space.l, marginTop: space.m },
  noticeText: { flex: 1, marginRight: space.m },
  noticeAction: { fontSize: 15, fontWeight: '600', color: colors.selected },
  section: { marginTop: space.xl, marginBottom: space.s, marginLeft: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.l, minHeight: 52 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  pressed: { backgroundColor: colors.bg },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: space.m },
  rowLabel: { flex: 1 },
  chev: { fontSize: 22, color: colors.faint, marginLeft: space.s },
});
