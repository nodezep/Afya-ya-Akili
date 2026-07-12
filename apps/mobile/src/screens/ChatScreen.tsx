import { useMutation } from '@tanstack/react-query';
import React, { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Input, Muted } from '../components';
import { api } from '../lib/api';
import { colors, spacing } from '../theme';

interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
}

interface SendResult {
  conversationId: string;
  assistantMessage: { id: string; content: string };
}

export function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const send = useMutation({
    mutationFn: (content: string) =>
      api<SendResult>('/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ content, conversationId: conversationId ?? undefined }),
      }),
    onMutate: (content) => {
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, role: 'USER', content },
        { id: 'pending', role: 'ASSISTANT', content: '…' },
      ]);
      setInput('');
    },
    onSuccess: (result) => {
      setConversationId(result.conversationId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === 'pending'
            ? { id: result.assistantMessage.id, role: 'ASSISTANT', content: result.assistantMessage.content }
            : m,
        ),
      );
    },
    onError: (err) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === 'pending'
            ? { id: `err-${Date.now()}`, role: 'ASSISTANT', content: `Sorry — ${(err as Error).message}` }
            : m,
        ),
      );
    },
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing(4), gap: spacing(2), flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing(2) }}>
            <Text style={{ fontSize: 40 }}>💬</Text>
            <Text style={{ fontWeight: '700', fontSize: 18, color: colors.text }}>Hi, I&apos;m Akili</Text>
            <Muted>Share what&apos;s on your mind — I&apos;m here to listen.</Muted>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={{
              alignSelf: item.role === 'USER' ? 'flex-end' : 'flex-start',
              backgroundColor: item.role === 'USER' ? colors.brand : colors.card,
              borderRadius: 16,
              borderWidth: item.role === 'USER' ? 0 : 1,
              borderColor: colors.border,
              padding: spacing(3),
              maxWidth: '82%',
            }}
          >
            <Text style={{ color: item.role === 'USER' ? '#fff' : colors.text, fontSize: 15 }}>
              {item.content}
            </Text>
          </View>
        )}
      />
      <View
        style={{
          flexDirection: 'row',
          gap: spacing(2),
          padding: spacing(3),
          borderTopWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <Input
          style={{ flex: 1 }}
          placeholder="Share what's on your mind…"
          value={input}
          onChangeText={setInput}
        />
        <Pressable
          onPress={() => input.trim() && send.mutate(input.trim())}
          disabled={send.isPending || !input.trim()}
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: send.isPending || !input.trim() ? 0.5 : 1,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 18 }}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
