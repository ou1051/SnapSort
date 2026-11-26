import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CATEGORIES, isCategoryId } from '../../core/categories';
import { formatBytes } from '../../core/format';
import { categoryLabel, t } from '../../i18n';
import { useAppState } from '../../services/store';
import { EmptyNote, ShotGrid } from '../../ui/ShotGrid';
import { space, type } from '../../ui/theme';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useAppState();

  const title = id === 'code' ? t.withCode : isCategoryId(id) || id === 'unsorted' ? categoryLabel(id) : '';

  const records = useMemo(
    () =>
      s.order
        .map((rid) => s.records[rid])
        .filter((r) => r && (id === 'code' ? r.hasCode : r.category === id)),
    [s.version, id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const bytes = records.reduce((n, r) => n + r.bytes, 0);
  const shelfLife = isCategoryId(id) ? CATEGORIES[id].shelfLifeDays : null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ShotGrid
        records={records}
        onPress={(rid) => router.push(`/shot/${encodeURIComponent(rid)}`)}
        header={
          <View style={styles.header}>
            <Text style={type.sub}>
              {t.shotsCount(records.length)} · {formatBytes(bytes)}
              {shelfLife ? ` · ${t.shelfLifeTitle}: ${t.days(shelfLife)}` : ''}
            </Text>
          </View>
        }
        empty={<EmptyNote text={t.noResults} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.l, paddingBottom: space.m },
});
