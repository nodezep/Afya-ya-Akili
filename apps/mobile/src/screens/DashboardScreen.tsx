import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Card, Loading, Muted, Title } from '../components';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';
import { colors, spacing } from '../theme';

interface DashboardData {
  mood: { average: number | null; checkIns: number };
  journalEntries: number;
  meditation: { sessions: number; minutes: number };
  conversations: number;
  nextAppointment: {
    startsAt: string;
    therapist: { title: string; user: { profile: { firstName: string; lastName: string } } };
  } | null;
}

const MOOD_EMOJI = ['😞', '😞', '😕', '😕', '😐', '😐', '🙂', '🙂', '😄', '😄'];

export function DashboardScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardData>('/analytics/dashboard'),
  });

  const logMood = useMutation({
    mutationFn: (score: number) => api('/mood', { method: 'POST', body: JSON.stringify({ score }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  if (isLoading) return <Loading />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <Title>Hi, {user?.profile?.firstName ?? 'friend'} 👋</Title>
      <Muted>How are you feeling today?</Muted>

      <Card>
        <Text style={{ fontWeight: '600', marginBottom: spacing(2), color: colors.text }}>
          Quick mood check-in
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
            <Pressable
              key={score}
              onPress={() => logMood.mutate(score)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 20 }}>{MOOD_EMOJI[score - 1]}</Text>
            </Pressable>
          ))}
        </View>
        {logMood.isSuccess && (
          <Text style={{ color: colors.success, marginTop: spacing(2) }}>
            Logged — thank you for checking in.
          </Text>
        )}
      </Card>

      <View style={{ flexDirection: 'row', gap: spacing(3) }}>
        <Card style={{ flex: 1 }}>
          <Muted>Avg mood (30d)</Muted>
          <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text }}>
            {data?.mood.average ? `${data.mood.average.toFixed(1)}/10` : '—'}
          </Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Muted>Mindful minutes</Muted>
          <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text }}>
            {data?.meditation.minutes ?? 0}
          </Text>
        </Card>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing(3) }}>
        <Card style={{ flex: 1 }}>
          <Muted>Journal entries</Muted>
          <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text }}>
            {data?.journalEntries ?? 0}
          </Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Muted>Conversations</Muted>
          <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text }}>
            {data?.conversations ?? 0}
          </Text>
        </Card>
      </View>

      <Card>
        <Text style={{ fontWeight: '600', color: colors.text }}>Next session</Text>
        {data?.nextAppointment ? (
          <View style={{ marginTop: spacing(1) }}>
            <Text style={{ color: colors.text }}>
              {data.nextAppointment.therapist.user.profile.firstName}{' '}
              {data.nextAppointment.therapist.user.profile.lastName} ·{' '}
              {data.nextAppointment.therapist.title}
            </Text>
            <Muted>{new Date(data.nextAppointment.startsAt).toLocaleString()}</Muted>
          </View>
        ) : (
          <Muted>No upcoming sessions. Browse therapists in Explore.</Muted>
        )}
      </Card>
    </ScrollView>
  );
}
