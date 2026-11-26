import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#F6F5F2',
  card: '#FFFFFF',
  text: '#1C1B19',
  sub: '#6B6862',
  faint: '#A8A49C',
  line: '#E6E3DD',
  accent: '#1C1B19',
  danger: '#C2410C',
  dangerSoft: '#FCEBDD',
  ok: '#3F6212',
  selected: '#2563EB',
};

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };

export const type = StyleSheet.create({
  big: { fontSize: 34, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, color: colors.text, lineHeight: 22 },
  sub: { fontSize: 14, color: colors.sub, lineHeight: 20 },
  small: { fontSize: 12, color: colors.sub },
  label: { fontSize: 13, fontWeight: '600', color: colors.sub, textTransform: 'uppercase', letterSpacing: 0.4 },
});

export const card = {
  backgroundColor: colors.card,
  borderRadius: 14,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: colors.line,
} as const;
