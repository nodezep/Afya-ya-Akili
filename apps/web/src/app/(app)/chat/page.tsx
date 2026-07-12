'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Send, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, streamChat } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useLocale } from '@/providers/app-providers';
import { Button, Spinner, Textarea } from '@/components/ui';

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  lastMessage?: { content: string } | null;
}

interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
}

export default function ChatPage() {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const { data: conversations, isLoading: loadingList } = useQuery({
    queryKey: ['conversations'],
    queryFn: () =>
      api<{ items: ConversationSummary[] }>('/chat/conversations?limit=50').then((r) => r.items),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => abortRef.current?.(), []);

  const openConversation = async (id: string) => {
    setActiveId(id);
    setError(null);
    const conversation = await api<{ messages: Message[] }>(`/chat/conversations/${id}`);
    setMessages(conversation.messages);
  };

  const newConversation = () => {
    setActiveId(null);
    setMessages([]);
    setError(null);
  };

  const deleteConversation = async (id: string) => {
    await api(`/chat/conversations/${id}`, { method: 'DELETE' });
    void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    if (id === activeId) newConversation();
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || streaming) return;

    setInput('');
    setError(null);
    setStreaming(true);
    setMessages((prev) => [
      ...prev,
      { id: `local-user-${Date.now()}`, role: 'USER', content },
      { id: 'streaming', role: 'ASSISTANT', content: '' },
    ]);

    abortRef.current = streamChat(
      { content, conversationId: activeId ?? undefined },
      {
        onStart: (data) => {
          if (!activeId) setActiveId(data.conversationId);
        },
        onDelta: (delta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === 'streaming' ? { ...m, content: m.content + delta } : m)),
          );
        },
        onDone: () => {
          setStreaming(false);
          setMessages((prev) =>
            prev.map((m) => (m.id === 'streaming' ? { ...m, id: `done-${Date.now()}` } : m)),
          );
          void queryClient.invalidateQueries({ queryKey: ['conversations'] });
        },
        onError: (message) => {
          setStreaming(false);
          setError(message);
          setMessages((prev) => prev.filter((m) => m.id !== 'streaming' || m.content));
        },
      },
    );
  };

  return (
    <div className="flex h-[calc(100vh-8.5rem)] gap-4">
      {/* Conversation list */}
      <aside className="hidden w-64 shrink-0 flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="p-3">
          <Button size="sm" className="w-full" onClick={newConversation}>
            <Plus className="h-4 w-4" />
            {t('chat.newConversation')}
          </Button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-2 scrollbar-thin">
          {loadingList ? (
            <Spinner />
          ) : (
            conversations?.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  'group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm',
                  conversation.id === activeId
                    ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
                onClick={() => void openConversation(conversation.id)}
              >
                <span className="truncate">{conversation.title}</span>
                <button
                  className="hidden text-slate-400 hover:text-rose-500 group-hover:block"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteConversation(conversation.id);
                  }}
                  aria-label="Delete conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Chat pane */}
      <section className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl text-white">
                A
              </div>
              <h2 className="mt-4 text-lg font-semibold">Hi, I&apos;m Akili</h2>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                I&apos;m here to listen — whether it&apos;s stress, sleep, relationships, or just a heavy day.
                What&apos;s on your mind?
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {['I feel stressed about work', 'Help me sleep better', 'Nataka kuongea tu'].map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="rounded-full border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:border-brand-400 dark:border-slate-700 dark:text-slate-300"
                    >
                      {suggestion}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn('flex', message.role === 'USER' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  message.role === 'USER'
                    ? 'rounded-br-md bg-brand-600 text-white'
                    : 'rounded-bl-md bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
                )}
              >
                {message.content || <span className="animate-pulse">▋</span>}
              </div>
            </div>
          ))}
          {error && <p className="text-center text-sm text-rose-600">{error}</p>}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="flex items-end gap-2">
            <Textarea
              rows={1}
              value={input}
              placeholder={t('chat.placeholder')}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(e);
                }
              }}
              className="max-h-32 resize-none"
            />
            <Button type="submit" disabled={!input.trim() || streaming} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-400">{t('chat.disclaimer')}</p>
        </form>
      </section>
    </div>
  );
}
