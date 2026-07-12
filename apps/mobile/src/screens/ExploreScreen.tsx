import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Muted, Title } from '../components';
import { colors, spacing } from '../theme';
import type { ExploreStackParamList } from '../navigation';

type Props = NativeStackScreenProps<ExploreStackParamList, 'ExploreHome'>;

const items: Array<{
  screen: keyof ExploreStackParamList;
  emoji: string;
  title: string;
  description: string;
}> = [
  { screen: 'Journal', emoji: '📓', title: 'Journal', description: 'Write with guided prompts' },
  { screen: 'Meditations', emoji: '🧘', title: 'Meditate', description: 'Guided audio sessions' },
  { screen: 'Therapists', emoji: '🩺', title: 'Therapists', description: 'Browse and book professionals' },
  { screen: 'Appointments', emoji: '📅', title: 'Appointments', description: 'Your upcoming sessions' },
];

export function ExploreScreen({ navigation }: Props) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}
    >
      <Title>Explore</Title>
      <Muted>Tools for every part of your wellbeing.</Muted>
      {items.map((item) => (
        <Pressable
          key={item.screen}
          onPress={() => navigation.navigate(item.screen as never)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing(3),
            backgroundColor: colors.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing(4),
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
          <View>
            <Text style={{ fontWeight: '600', fontSize: 16, color: colors.text }}>{item.title}</Text>
            <Muted>{item.description}</Muted>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
