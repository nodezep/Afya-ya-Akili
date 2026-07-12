import { useMutation, useQuery } from '@tanstack/react-query';
import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Card, Loading, Muted } from '../components';
import { api } from '../lib/api';
import { colors, spacing } from '../theme';

interface Meditation {
  id: string;
  title: string;
  description: string;
  category: string;
  durationSec: number;
  audioUrl: string;
}

export function MeditationsScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['meditations'],
    queryFn: () => api<{ items: Meditation[] }>('/meditations?limit=50').then((r) => r.items),
  });

  const startSession = useMutation({
    mutationFn: (meditationId: string) =>
      api('/meditations/sessions', { method: 'POST', body: JSON.stringify({ meditationId }) }),
  });

  if (isLoading) return <Loading />;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}
      data={data ?? []}
      keyExtractor={(m) => m.id}
      ListEmptyComponent={<Muted>No meditations available.</Muted>}
      renderItem={({ item }) => (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, paddingRight: spacing(3) }}>
              <Text style={{ fontWeight: '600', color: colors.text }}>{item.title}</Text>
              <Muted>
                {item.category} · {Math.round(item.durationSec / 60)} min
              </Muted>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }} numberOfLines={2}>
                {item.description}
              </Text>
            </View>
            <Pressable
              onPress={() => startSession.mutate(item.id)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.brand,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16 }}>▶</Text>
            </Pressable>
          </View>
          {startSession.isSuccess && startSession.variables === item.id && (
            <Text style={{ color: colors.success, marginTop: spacing(2), fontSize: 13 }}>
              Session started — audio streams from your library.
            </Text>
          )}
        </Card>
      )}
    />
  );
}
