import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { FlatList, Text, View } from 'react-native';
import { Card, Loading, Muted } from '../components';
import { api } from '../lib/api';
import { colors, spacing } from '../theme';

interface Therapist {
  id: string;
  title: string;
  specialties: string[];
  hourlyRateCents: number;
  currency: string;
  ratingAvg: number;
  ratingCount: number;
  user: { profile: { firstName: string; lastName: string } };
}

export function TherapistsScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['therapists'],
    queryFn: () => api<{ items: Therapist[] }>('/therapists?limit=30').then((r) => r.items),
  });

  if (isLoading) return <Loading />;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}
      data={data ?? []}
      keyExtractor={(t) => t.id}
      ListEmptyComponent={<Muted>No therapists available right now.</Muted>}
      renderItem={({ item }) => (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>
                {item.user.profile.firstName} {item.user.profile.lastName}
              </Text>
              <Muted>{item.title}</Muted>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
                {item.specialties.join(' · ')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: '#d97706', fontWeight: '600' }}>
                ★ {item.ratingCount > 0 ? item.ratingAvg.toFixed(1) : 'New'}
              </Text>
              <Text style={{ fontWeight: '700', color: colors.text, marginTop: 4 }}>
                {item.currency} {(item.hourlyRateCents / 100).toLocaleString()}
              </Text>
              <Muted>per hour</Muted>
            </View>
          </View>
          <Text style={{ color: colors.brand, marginTop: spacing(2), fontSize: 13 }}>
            Book on the web app or contact support to schedule.
          </Text>
        </Card>
      )}
    />
  );
}
