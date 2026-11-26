import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { colors } from './theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'quiet';
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', disabled, busy, style }: Props) {
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'danger' && styles.danger,
        variant === 'quiet' && styles.quiet,
        off && styles.off,
        pressed && !off && styles.pressed,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'quiet' ? colors.text : '#fff'} />
      ) : (
        <Text style={[styles.text, variant === 'quiet' && styles.quietText]} numberOfLines={1}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.accent },
  danger: { backgroundColor: colors.danger },
  quiet: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  off: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  text: { color: '#fff', fontSize: 17, fontWeight: '600' },
  quietText: { color: colors.text },
});
