import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Button, Card, Input, Loading, Muted } from '../components';
import { api } from '../lib/api';
import { colors, spacing } from '../theme';

interface JournalEntry {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export function JournalScreen() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['journal'],
    queryFn: () => api<{ items: JournalEntry[] }>('/journal?limit=30').then((r) => r.items),
  });

  const { data: prompts } = useQuery({
    queryKey: ['journal', 'prompts'],
    queryFn: () => api<{ promptOfTheDay: string }>('/journal/prompts'),
  });

  const create = useMutation({
    mutationFn: () => api('/journal', { method: 'POST', body: JSON.stringify({ title, content }) }),
    onSuccess: () => {
      setTitle('');
      setContent('');
      void queryClient.invalidateQueries({ queryKey: ['journal'] });
    },
  });

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}
      data={data ?? []}
      keyExtractor={(entry) => entry.id}
      ListHeaderComponent={
        <View style={{ gap: spacing(3), marginBottom: spacing(2) }}>
          {prompts?.promptOfTheDay && (
            <Card style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
              <Text style={{ color: '#92400e', fontSize: 13 }}>
                💡 Today&apos;s prompt: {prompts.promptOfTheDay}
              </Text>
            </Card>
          )}
          <Card>
            <View style={{ gap: spacing(2) }}>
              <Input placeholder="Title" value={title} onChangeText={setTitle} />
              <Input
                placeholder="Write freely. This space is yours."
                value={content}
                onChangeText={setContent}
                multiline
                style={{ height: 100, textAlignVertical: 'top', paddingTop: spacing(3) }}
              />
              <Button
                title="Save entry"
                onPress={() => create.mutate()}
                loading={create.isPending}
                disabled={!title.trim() || !content.trim()}
              />
            </View>
          </Card>
        </View>
      }
      ListEmptyComponent={isLoading ? <Loading /> : <Muted>Your journal is empty. Start above.</Muted>}
      renderItem={({ item }) => (
        <Card>
          <Text style={{ fontWeight: '600', color: colors.text }}>{item.title}</Text>
          <Text style={{ color: colors.textMuted, marginTop: 4 }} numberOfLines={3}>
            {item.content}
          </Text>
          <Muted>{new Date(item.createdAt).toLocaleString()}</Muted>
        </Card>
      )}
    />
  );
}
