/**
 * AI Tutor orchestration: builds context (lesson, skills, recent attempt, recommendations),
 * runs safety screening, calls the configured provider and persists the conversation.
 */
import { config } from '../../config.js';
import { nowIso, parseJson, q, tx } from '../../db/index.js';
import { newId } from '../../lib/http.js';
import { forbidden, notFound } from '../../lib/errors.js';
import { getLessonDetail } from '../content.js';
import { getRecommendations, getStudentSkills, getWeakSkills } from '../adaptive.js';
import { listAttempts, getAttempt } from '../assessment.js';
import { DemoTutorProvider } from './demoProvider.js';
import { OpenAICompatibleProvider } from './openaiProvider.js';
import { screenInput } from './safety.js';
import type { AIProvider, TutorPracticeQuestion, TutorRequest } from './provider.js';
import type { AIConversation, AIMessage, AIMessageMeta, LanguageCode, TutorContextRef, TutorIntent } from '@shared/types';

let provider: AIProvider | null = null;
export function getProvider(): AIProvider {
  if (provider) return provider;
  provider = config.ai.provider === 'openai-compatible' && config.ai.apiKey ? new OpenAICompatibleProvider() : new DemoTutorProvider();
  return provider;
}
/** Test hook. */
export function setProvider(p: AIProvider | null): void {
  provider = p;
}

export function detectIntent(message: string, requested?: TutorIntent | null, hasPending = false): TutorIntent {
  if (requested && requested !== 'general') return requested;
  const m = message.trim().toLowerCase();
  if (hasPending && /^(?:my answer(?: is)?[:\s]*)?\(?[a-d1-4]\)?[.)]?$/.test(m)) return 'answer';
  if (hasPending && /^(option|answer|choose|pick)\b/.test(m)) return 'answer';
  if (/(simpl|easier|easy|eli5|don'?t (get|understand)|confus|slow(ly)?|again)/.test(m)) return 'simpler';
  if (/(example|instance|show me|real[- ]life|demonstrat)/.test(m)) return 'example';
  if (/(practice|practise|quiz|question|test me|exercise|problem to solve)/.test(m)) return 'practice';
  if (/(recommend|what next|next step|should i (study|learn|do)|suggest|plan|weak)/.test(m)) return 'recommend';
  if (/(explain|what is|what are|why|how does|how do|tell me about|meaning|define)/.test(m)) return 'explain';
  return 'general';
}

function loadQuestion(questionId: string): TutorPracticeQuestion | null {
  const row = q.get<{ id: string; prompt: string; options_json: string | null; answer_key_json: string; explanation: string; skill_name: string }>(
    'SELECT qu.id, qu.prompt, qu.options_json, qu.answer_key_json, qu.explanation, s.name AS skill_name FROM questions qu JOIN skills s ON s.id = qu.skill_id WHERE qu.id = ?',
    questionId,
  );
  if (!row) return null;
  const key = parseJson<{ index?: number }>(row.answer_key_json, {});
  return {
    questionId: row.id,
    prompt: row.prompt,
    options: parseJson<string[] | null>(row.options_json, null),
    answerIndex: typeof key.index === 'number' ? key.index : null,
    explanation: row.explanation,
    skillName: row.skill_name,
  };
}

/** Pick a practice question: weakest relevant skill first, avoiding recently asked questions. */
function pickPracticeQuestion(studentId: string, lessonId: string | null, askedIds: string[]): TutorPracticeQuestion | null {
  const skills = getStudentSkills(studentId);
  let candidates: { id: string; skill_id: string }[] = [];
  if (lessonId) candidates = q.all<{ id: string; skill_id: string }>('SELECT id, skill_id FROM questions WHERE lesson_id = ? ORDER BY difficulty, id', lessonId);
  if (!candidates.length) {
    const weak = getWeakSkills(studentId, 1)[0];
    if (weak) candidates = q.all<{ id: string; skill_id: string }>('SELECT id, skill_id FROM questions WHERE skill_id = ? ORDER BY difficulty, id', weak.id);
  }
  if (!candidates.length) candidates = q.all<{ id: string; skill_id: string }>('SELECT id, skill_id FROM questions ORDER BY difficulty, id LIMIT 20');
  if (!candidates.length) return null;
  const masteryOf = (skillId: string) => skills.find((s) => s.id === skillId)?.mastery ?? 50;
  const sorted = [...candidates].sort((a, b) => masteryOf(a.skill_id) - masteryOf(b.skill_id));
  const fresh = sorted.find((c) => !askedIds.includes(c.id)) ?? sorted[0];
  return loadQuestion(fresh.id);
}

export interface ChatInput {
  userId: string;
  userName: string;
  message: string;
  intent?: TutorIntent | null;
  conversationId?: string | null;
  context?: TutorContextRef;
  language?: LanguageCode;
}

export interface ChatOutput {
  conversationId: string;
  message: AIMessage;
  userMessage: AIMessage;
}

export async function chat(input: ChatInput): Promise<ChatOutput> {
  const at = nowIso();
  const language: LanguageCode = input.language ?? input.context?.language ?? 'en';

  // Resolve / create conversation
  let convId = input.conversationId ?? null;
  let contextJson: TutorContextRef & { pendingQuestionId?: string | null; askedQuestionIds?: string[] } = { ...(input.context ?? {}) };
  if (convId) {
    const conv = q.get<{ user_id: string; context_json: string }>('SELECT user_id, context_json FROM ai_conversations WHERE id = ?', convId);
    if (!conv) throw notFound('Conversation');
    if (conv.user_id !== input.userId) throw forbidden();
    contextJson = { ...parseJson(conv.context_json, {}), ...(input.context ?? {}) };
  } else {
    convId = newId('conv');
    const title = input.context?.lessonId
      ? q.get<{ title: string }>('SELECT title FROM lessons WHERE id = ?', input.context.lessonId)?.title ?? 'Conversation'
      : input.message.slice(0, 48);
    q.run('INSERT INTO ai_conversations (id, user_id, title, context_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', convId, input.userId, title, JSON.stringify(contextJson), at, at);
  }

  const userMsgId = newId('msg');
  q.run("INSERT INTO ai_messages (id, conversation_id, role, content, intent, provider, meta_json, created_at) VALUES (?, ?, 'user', ?, NULL, NULL, '{}', ?)", userMsgId, convId, input.message, at);
  const userMessage: AIMessage = { id: userMsgId, conversationId: convId, role: 'user', content: input.message, intent: null, provider: null, createdAt: at };

  const respond = (content: string, intent: TutorIntent | null, providerId: string, meta: AIMessageMeta): ChatOutput => {
    const id = newId('msg');
    const created = nowIso();
    q.run(
      "INSERT INTO ai_messages (id, conversation_id, role, content, intent, provider, meta_json, created_at) VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?)",
      id, convId, content, intent, providerId, JSON.stringify(meta), created,
    );
    q.run('UPDATE ai_conversations SET updated_at = ?, context_json = ? WHERE id = ?', created, JSON.stringify(contextJson), convId);
    return { conversationId: convId!, userMessage, message: { id, conversationId: convId!, role: 'assistant', content, intent, provider: providerId, createdAt: created, meta } };
  };

  // Safety screen
  const verdict = screenInput(input.message);
  if (verdict.blocked) {
    return respond(verdict.response ?? 'I cannot help with that.', null, 'safety', {
      providerLabel: 'Safety guardrail',
      safety: { blocked: true, category: verdict.category },
      suggestions: ['Explain this lesson', 'Give me a practice question'],
    });
  }

  const pending = contextJson.pendingQuestionId ? loadQuestion(contextJson.pendingQuestionId) : null;
  const intent = detectIntent(input.message, input.intent, !!pending);

  // Build context
  const lessonId = contextJson.lessonId ?? null;
  const lesson = lessonId ? safeLesson(lessonId, input.userId, language) : null;
  const lessonSkillIds = lesson ? lesson.skills.map((s) => s.id) : [];
  const allSkills = getStudentSkills(input.userId);
  const skills = lesson ? allSkills.filter((s) => lessonSkillIds.includes(s.id)) : allSkills.filter((s) => s.attemptsCount > 0).sort((a, b) => a.mastery - b.mastery).slice(0, 4);
  const lastAttempt = listAttempts(input.userId, 1)[0];
  const lastDetail = lastAttempt ? getAttempt(lastAttempt.id) : undefined;
  const recentAttempt = lastDetail
    ? { title: lastDetail.assessmentTitle ?? 'Assessment', percent: lastDetail.percent, weakSkillNames: (lastDetail.weakSkills ?? []).map((w) => w.skillName) }
    : null;
  const recommendations = getRecommendations(input.userId);
  const history = q
    .all<{ role: 'user' | 'assistant'; content: string }>('SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 8', convId)
    .reverse()
    .slice(0, -1);

  const asked = contextJson.askedQuestionIds ?? [];
  const practiceQuestion = intent === 'practice' ? pickPracticeQuestion(input.userId, lessonId, asked) : null;

  const req: TutorRequest = {
    message: input.message,
    intent,
    language,
    studentName: input.userName,
    lesson: lesson
      ? {
          id: lesson.id,
          title: lesson.title,
          summary: lesson.summary,
          contentMd: lesson.contentMd,
          keyPoints: lesson.keyPoints,
          simpler: lesson.tutorNotes.simpler,
          example: lesson.tutorNotes.example,
          misconceptions: lesson.tutorNotes.misconceptions,
          glossary: lesson.tutorNotes.glossary,
          courseTitle: lesson.courseTitle,
          subjectName: lesson.subjectName,
          translation: lesson.translation ? { title: lesson.translation.title, summary: lesson.translation.summary, keyPoints: lesson.translation.keyPoints, status: lesson.translation.status } : null,
        }
      : null,
    skills,
    recentAttempt,
    recommendations,
    practiceQuestion,
    pendingQuestion: intent === 'answer' ? pending : null,
    history,
  };

  const out = await getProvider().generate(req);

  // Update conversation state
  if (practiceQuestion) {
    contextJson.pendingQuestionId = practiceQuestion.questionId;
    contextJson.askedQuestionIds = [...asked, practiceQuestion.questionId].slice(-20);
  } else if (intent === 'answer') {
    contextJson.pendingQuestionId = null;
  }

  return respond(out.content, intent, out.provider, {
    providerLabel: out.providerLabel,
    safety: { blocked: false },
    practiceQuestion: out.practiceQuestion,
    recommendations: intent === 'recommend' ? recommendations.slice(0, 4) : undefined,
    suggestions: out.suggestions,
  });
}

function safeLesson(lessonId: string, userId: string, language: LanguageCode) {
  try {
    return getLessonDetail(lessonId, userId, language);
  } catch {
    return null;
  }
}

export function listConversations(userId: string): AIConversation[] {
  return q
    .all<{ id: string; user_id: string; title: string; context_json: string; created_at: string }>(
      'SELECT id, user_id, title, context_json, created_at FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 30',
      userId,
    )
    .map((c) => ({ id: c.id, userId: c.user_id, title: c.title, context: parseJson<TutorContextRef>(c.context_json, {}), createdAt: c.created_at }));
}

export function getConversation(userId: string, id: string): AIConversation {
  const c = q.get<{ id: string; user_id: string; title: string; context_json: string; created_at: string }>('SELECT * FROM ai_conversations WHERE id = ?', id);
  if (!c) throw notFound('Conversation');
  if (c.user_id !== userId) throw forbidden();
  const messages = q
    .all<{ id: string; conversation_id: string; role: 'user' | 'assistant'; content: string; intent: TutorIntent | null; provider: string | null; meta_json: string; created_at: string }>(
      'SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at',
      id,
    )
    .map((m) => ({ id: m.id, conversationId: m.conversation_id, role: m.role, content: m.content, intent: m.intent, provider: m.provider, createdAt: m.created_at, meta: parseJson<AIMessageMeta>(m.meta_json, {}) }));
  return { id: c.id, userId: c.user_id, title: c.title, context: parseJson<TutorContextRef>(c.context_json, {}), createdAt: c.created_at, messages };
}

export function deleteConversation(userId: string, id: string): void {
  tx(() => {
    const c = q.get<{ user_id: string }>('SELECT user_id FROM ai_conversations WHERE id = ?', id);
    if (!c) throw notFound('Conversation');
    if (c.user_id !== userId) throw forbidden();
    q.run('DELETE FROM ai_conversations WHERE id = ?', id);
  });
}
