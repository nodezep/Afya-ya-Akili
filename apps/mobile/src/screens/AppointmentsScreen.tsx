import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { FlatList, Text, View } from 'react-native';
import { Card, Loading, Muted } from '../components';
import { api } from '../lib/api';
import { colors, spacing } from '../theme';

interface Appointment {
  id: string;
  startsAt: string;
  status: string;
  priceCents: number;
  currency: string;
  therapist: {
    title: string;
    user: { profile: { firstName: string; lastName: string } };
  };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#d97706',
  CONFIRMED: '#059669',
  IN_PROGRESS: '#0284c7',
  COMPLETED: '#64748b',
  CANCELLED: '#e11d48',
};

export function AppointmentsScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => api<{ items: Appointment[] }>('/appointments?limit=30').then((r) => r.items),
  });

  if (isLoading) return <Loading />;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}
      data={data ?? []}
      keyExtractor={(a) => a.id}
      ListEmptyComponent={<Muted>No appointments yet. Book from the Therapists tab.</Muted>}
      renderItem={({ item }) => (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', color: colors.text }}>
                {item.therapist.user.profile.firstName} {item.therapist.user.profile.lastName}
              </Text>
              <Muted>{item.therapist.title}</Muted>
              <Muted>{new Date(item.startsAt).toLocaleString()}</Muted>
            </View>
            <Text style={{ color: STATUS_COLORS[item.status] ?? colors.textMuted, fontWeight: '600' }}>
              {item.status}
            </Text>
          </View>
        </Card>
      )}
    />
  );
}
