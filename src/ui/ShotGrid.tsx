import { Image } from 'expo-image';
import { memo, type ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { ShotRecord } from '../core/types';
import { t } from '../i18n';
import { colors } from './theme';

const COLUMNS = 3;
const GAP = 2;

type ThumbProps = {
  record: ShotRecord;
  size: number;
  selected?: boolean;
  selectable: boolean;
  onPress: (id: string) => void;
  onLongPress?: (id: string) => void;
};

export const Thumb = memo(function Thumb({ record, size, selected, selectable, onPress, onLongPress }: ThumbProps) {
  const label = record.title ?? record.filename ?? '';
  return (
    <Pressable
      onPress={() => onPress(record.id)}
      onLongPress={onLongPress ? () => onLongPress(record.id) : undefined}
      accessibilityRole={selectable ? 'checkbox' : 'imagebutton'}
      accessibilityState={selectable ? { checked: !!selected } : undefined}
      accessibilityLabel={label}
      style={{ width: size, height: size * 1.6, marginRight: GAP, marginBottom: GAP }}
    >
      <Image
        source={{ uri: record.id }}
        recyclingKey={record.id}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="top"
        transition={120}
      />
      {selectable && !selected && <View style={styles.dim} />}
      {selectable && (
        <View style={[styles.check, selected && styles.checkOn]}>
          {selected && <Text style={styles.checkMark}>✓</Text>}
        </View>
      )}
      {record.hasCode && !selectable && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>QR</Text>
        </View>
      )}
    </Pressable>
  );
});

type GridProps = {
  records: ShotRecord[];
  selected?: Set<string>;
  onPress: (id: string) => void;
  onLongPress?: (id: string) => void;
  header?: ReactElement;
  empty?: ReactElement;
  footerSpace?: number;
};

export function ShotGrid({ records, selected, onPress, onLongPress, header, empty, footerSpace = 0 }: GridProps) {
  const { width } = useWindowDimensions();
  const size = (width - GAP * (COLUMNS - 1)) / COLUMNS;
  return (
    <FlatList
      data={records}
      keyExtractor={(r) => r.id}
      numColumns={COLUMNS}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={<View style={{ height: footerSpace }} />}
      initialNumToRender={18}
      windowSize={7}
      removeClippedSubviews
      extraData={selected}
      renderItem={({ item, index }) => (
        <View style={(index + 1) % COLUMNS === 0 ? styles.lastInRow : undefined}>
          <Thumb
            record={item}
            size={size}
            selectable={!!selected}
            selected={selected?.has(item.id)}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        </View>
      )}
    />
  );
}

export function EmptyNote({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text || t.noResults}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lastInRow: { marginRight: -GAP },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.45)' },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.selected, borderColor: colors.selected },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '800' },
  badge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  empty: { padding: 48, alignItems: 'center' },
  emptyText: { color: colors.sub, fontSize: 15 },
});
