import { StyleSheet } from 'react-native';

// Black and white only, after Apple's system palette. No accent hues.
export const colors = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  text: '#1D1D1F',
  sub: '#6E6E73',
  faint: '#AEAEB2',
  line: '#E5E5EA',
  soft: '#F5F5F7',
  accent: '#1D1D1F',
  danger: '#1D1D1F',
  dangerSoft: '#F5F5F7',
  ok: '#1D1D1F',
  selected: '#1D1D1F',
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
