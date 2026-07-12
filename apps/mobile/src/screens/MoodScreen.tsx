import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, Input, Loading, Muted, Title } from '../components';
import { api } from '../lib/api';
import { colors, spacing } from '../theme';

const EMOTIONS = ['happy', 'calm', 'grateful', 'anxious', 'stressed', 'sad', 'tired', 'hopeful'];

interface MoodStats {
  averageScore: number | null;
  totalEntries: number;
  streakDays: number;
  daily: Array<{ date: string; average: number }>;
}

export function MoodScreen() {
  const queryClient = useQueryClient();
  const [score, setScore] = useState(7);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['mood', 'stats'],
    queryFn: () => api<MoodStats>('/mood/stats?days=30'),
  });

  const save = useMutation({
    mutationFn: () =>
      api('/mood', {
        method: 'POST',
        body: JSON.stringify({ score, emotions, note: note || undefined }),
      }),
    onSuccess: () => {
      setEmotions([]);
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['mood'] });
    },
  });

  const maxBar = Math.max(...(stats?.daily.map((d) => d.average) ?? [1]), 1);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}
    >
      <Title>Mood tracker</Title>
      {stats && stats.streakDays > 0 && <Muted>🔥 {stats.streakDays}-day streak</Muted>}

      <Card>
        <Text style={{ fontWeight: '600', color: colors.text }}>How are you right now?</Text>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: spacing(3),
            flexWrap: 'wrap',
            gap: spacing(1),
          }}
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
            <Pressable
              key={value}
              onPress={() => setScore(value)}
              style={{
                width: 30,
                height: 40,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: value === score ? colors.brand : colors.background,
                borderWidth: 1,
                borderColor: value === score ? colors.brand : colors.border,
              }}
            >
              <Text style={{ color: value === score ? '#fff' : colors.text, fontWeight: '600' }}>
                {value}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(3) }}>
          {EMOTIONS.map((emotion) => {
            const selected = emotions.includes(emotion);
            return (
              <Pressable
                key={emotion}
                onPress={() =>
                  setEmotions((prev) =>
                    selected ? prev.filter((e) => e !== emotion) : [...prev, emotion],
                  )
                }
                style={{
                  paddingHorizontal: spacing(3),
                  paddingVertical: spacing(1.5),
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: selected ? colors.brand : colors.border,
                  backgroundColor: selected ? colors.brand : 'transparent',
                }}
              >
                <Text style={{ color: selected ? '#fff' : colors.textMuted, fontSize: 13 }}>
                  {emotion}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: spacing(3), gap: spacing(2) }}>
          <Input placeholder="Add a note (optional)" value={note} onChangeText={setNote} />
          <Button title="Save check-in" onPress={() => save.mutate()} loading={save.isPending} />
        </View>
      </Card>

      <Card>
        <Text style={{ fontWeight: '600', color: colors.text }}>Last 30 days</Text>
        {isLoading ? (
          <Loading />
        ) : stats && stats.daily.length > 0 ? (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                height: 100,
                gap: 2,
                marginTop: spacing(3),
              }}
            >
              {stats.daily.map((day) => (
                <View
                  key={String(day.date)}
                  style={{
                    flex: 1,
                    height: `${(day.average / maxBar) * 100}%`,
                    backgroundColor: colors.brand,
                    borderTopLeftRadius: 3,
                    borderTopRightRadius: 3,
                    opacity: 0.85,
                  }}
                />
              ))}
            </View>
            <Muted>
              Average {stats.averageScore?.toFixed(1) ?? '—'}/10 · {stats.totalEntries} check-ins
            </Muted>
          </>
        ) : (
          <Muted>Log your first mood to see trends here.</Muted>
        )}
      </Card>
    </ScrollView>
  );
}
