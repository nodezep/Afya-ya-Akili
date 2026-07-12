import React, { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, spacing } from './theme';

export function Button({
  title,
  onPress,
  loading,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
  disabled?: boolean;
}) {
  const backgroundColor =
    variant === 'primary' ? colors.brand : variant === 'danger' ? colors.danger : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: colors.brand,
          opacity: disabled || loading ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.brand : '#fff'} />
      ) : (
        <Text
          style={{
            color: variant === 'outline' ? colors.brand : '#fff',
            fontWeight: '600',
            fontSize: 15,
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Loading() {
  return (
    <View style={{ padding: spacing(10), alignItems: 'center' }}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(5),
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing(4),
    fontSize: 15,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing(4),
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
