import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Lightbulb, ListChecks, Send, ShieldAlert, Sparkles, Trash2, Volume2, Wand2 } from 'lucide-react';
import { del, get, post } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Markdown } from '@/lib/markdown';
import { speech } from '@/lib/speech';
import { cn } from '@/lib/utils';
import { Badge, Button } from '@/components/ui';
import type { AIConversation, AIMessage, TutorContextRef, TutorIntent } from '@shared/types';

interface ChatResponse {
  conversationId: string;
  userMessage: AIMessage;
  message: AIMessage;
}

const quickActions: { intent: TutorIntent; label: string; icon: React.ReactNode; prompt: string }[] = [
  { intent: 'explain', label: 'Explain', icon: <Lightbulb className="h-3.5 w-3.5" />, prompt: 'Explain this lesson to me.' },
  { intent: 'simpler', label: 'Simpler', icon: <Wand2 className="h-3.5 w-3.5" />, prompt: 'Explain it in a simpler way.' },
  { intent: 'example', label: 'Example', icon: <Sparkles className="h-3.5 w-3.5" />, prompt: 'Give me a real-life example.' },
  { intent: 'practice', label: 'Practice', icon: <ListChecks className="h-3.5 w-3.5" />, prompt: 'Give me a practice question.' },
  { intent: 'recommend', label: 'What next?', icon: <Sparkles className="h-3.5 w-3.5" />, prompt: 'What should I study next?' },
];

export function TutorPanel({ context, className, initialConversationId, title = 'AI Tutor', compact }: { context?: TutorContextRef; className?: string; initialConversationId?: string | null; title?: string; compact?: boolean }) {
  const { language } = useI18n();
  const qc = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const status = useQuery({ queryKey: ['ai-status'], queryFn: () => get<{ ai: { provider: string; label: string; live: boolean } }>('/ai/status').then((r) => r.ai), staleTime: Infinity });

  const conversation = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => get<{ conversation: AIConversation }>(`/ai/conversations/${conversationId}`).then((r) => r.conversation),
    enabled: !!conversationId && messages.length === 0,
  });
  useEffect(() => {
    if (conversation.data?.messages && messages.length === 0) setMessages(conversation.data.messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.data]);

  useEffect(() => {
    setConversationId(initialConversationId ?? null);
    setMessages([]);
  }, [initialConversationId]);

  const send = useMutation({
    mutationFn: (payload: { message: string; intent?: TutorIntent }) => post<ChatResponse>('/ai/chat', { ...payload, conversationId, context: { lessonId: context?.lessonId ?? null, courseId: context?.courseId ?? null, subjectId: context?.subjectId ?? null }, language }),
    onMutate: ({ message }) => {
      setError(null);
      setMessages((m) => [...m, { id: `tmp-${Date.now()}`, conversationId: conversationId ?? '', role: 'user', content: message, intent: null, provider: null, createdAt: new Date().toISOString() }]);
    },
    onSuccess: (res) => {
      setConversationId(res.conversationId);
      setMessages((m) => [...m.filter((x) => !x.id.startsWith('tmp-')), res.userMessage, res.message]);
      qc.invalidateQueries({ queryKey: ['conversations'] });
      if (res.message.meta?.recommendations) qc.invalidateQueries({ queryKey: ['recommendations'] });
    },
    onError: (err) => {
      setMessages((m) => m.filter((x) => !x.id.startsWith('tmp-')));
      setError(err instanceof Error ? err.message : 'The tutor is unavailable right now.');
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, send.isPending]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || send.isPending) return;
    setInput('');
    send.mutate({ message: text });
  };

  const reset = async () => {
    if (conversationId) {
      try {
        await del(`/ai/conversations/${conversationId}`);
      } catch {
        /* ignore */
      }
      qc.invalidateQueries({ queryKey: ['conversations'] });
    }
    setConversationId(null);
    setMessages([]);
    setError(null);
  };

  const speak = async (m: AIMessage) => {
    if (speaking === m.id) {
      speech.stop();
      setSpeaking(null);
      return;
    }
    setSpeaking(m.id);
    try {
      await speech.speak(m.content, language);
    } catch {
      /* unsupported */
    } finally {
      setSpeaking(null);
    }
  };

  const lastPractice = [...messages].reverse().find((m) => m.meta?.practiceQuestion)?.meta?.practiceQuestion;
  const awaitingAnswer = !!lastPractice && messages[messages.length - 1]?.meta?.practiceQuestion === lastPractice;

  return (
    <div className={cn('flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-[11px] text-slate-500">{status.data ? status.data.label : 'Checking provider…'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status.data && <Badge tone={status.data.live ? 'success' : 'warning'}>{status.data.live ? 'Live model' : 'Demo provider'}</Badge>}
          {messages.length > 0 && (
            <button type="button" onClick={reset} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="New conversation" title="New conversation">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className={cn('flex-1 space-y-3 overflow-y-auto px-4 py-4', compact ? 'max-h-[26rem] min-h-[16rem]' : 'min-h-[24rem]')} aria-live="polite">
        {messages.length === 0 && !conversation.isLoading && (
          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-800">Ask anything about {context?.lessonId ? 'this lesson' : 'your courses'}.</p>
            <p className="mt-1">The tutor answers in your selected language, grounds explanations in the curriculum, can give practice questions and tell you what to study next. It never reveals answer keys for graded quizzes.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[90%] rounded-2xl px-4 py-2.5 text-sm', m.role === 'user' ? 'rounded-br-sm bg-brand-600 text-white' : 'rounded-bl-sm bg-slate-100 text-slate-800')}>
              {m.role === 'user' ? (
                <p className="whitespace-pre-wrap">{m.content}</p>
              ) : (
                <>
                  {m.meta?.safety?.blocked && (
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-rose-700">
                      <ShieldAlert className="h-3.5 w-3.5" /> Safety guardrail
                    </p>
                  )}
                  <Markdown content={m.content} compact className="text-sm" />
                  {m.meta?.practiceQuestion?.options && (
                    <div className="mt-2 grid gap-1.5">
                      {m.meta.practiceQuestion.options.map((opt, i) => (
                        <button
                          key={i}
                          type="button"
                          disabled={send.isPending || !awaitingAnswer || m.meta?.practiceQuestion !== lastPractice}
                          onClick={() => send.mutate({ message: String.fromCharCode(65 + i), intent: 'answer' })}
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-left text-sm hover:border-brand-400 hover:bg-brand-50 disabled:opacity-60"
                        >
                          <span className="mr-2 font-semibold text-brand-700">{String.fromCharCode(65 + i)}.</span>
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  {m.meta?.recommendations && m.meta.recommendations.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {m.meta.recommendations.slice(0, 3).map((r) => (
                        <Link key={r.id} to={r.href} className="block rounded-md border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-brand-50">
                          → {r.title}
                        </Link>
                      ))}
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500">
                    <span>{m.meta?.providerLabel ?? m.provider ?? ''}</span>
                    {m.intent && <span>· {m.intent}</span>}
                    <button type="button" onClick={() => speak(m)} className="ml-auto flex items-center gap-1 rounded px-1 hover:bg-slate-200" aria-label="Read aloud">
                      <Volume2 className={cn('h-3.5 w-3.5', speaking === m.id && 'text-brand-600')} /> {speaking === m.id ? 'Stop' : 'Listen'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
        {send.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-500">Thinking…</div>
          </div>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-100 px-4 py-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {quickActions.map((a) => (
            <button
              key={a.intent}
              type="button"
              disabled={send.isPending}
              onClick={() => send.mutate({ message: a.prompt, intent: a.intent })}
              className="flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-violet-400 hover:bg-violet-50 disabled:opacity-50"
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={awaitingAnswer ? 'Type your answer (e.g. B)…' : 'Ask the tutor…'}
            aria-label="Message the AI tutor"
            className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            maxLength={2000}
          />
          <Button type="submit" loading={send.isPending} icon={<Send className="h-4 w-4" />} aria-label="Send">
            <span className="hidden sm:inline">Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
