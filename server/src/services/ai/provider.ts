/**
 * AI provider abstraction. The tutor never depends on a specific vendor:
 *   - DemoTutorProvider      → deterministic, curriculum-grounded, offline (default)
 *   - OpenAICompatibleProvider → any OpenAI-compatible chat completions API (opt-in via env)
 */
import { config } from '../../config.js';
import type { LanguageCode, Recommendation, TutorIntent } from '@shared/types';
import type { StudentSkill } from '@shared/types';

export interface TutorLessonContext {
  id: string;
  title: string;
  summary: string;
  contentMd: string;
  keyPoints: string[];
  simpler: string;
  example: string;
  misconceptions: string[];
  glossary: Record<string, string>;
  courseTitle: string;
  subjectName: string;
  translation?: { title: string; summary: string; keyPoints: string[]; status: 'available' | 'fallback' } | null;
}

export interface TutorPracticeQuestion {
  questionId: string;
  prompt: string;
  options: string[] | null;
  answerIndex: number | null;
  explanation: string;
  skillName: string;
}

export interface TutorRequest {
  message: string;
  intent: TutorIntent;
  language: LanguageCode;
  studentName: string;
  lesson: TutorLessonContext | null;
  skills: StudentSkill[]; // skills relevant to the lesson (or weakest overall)
  recentAttempt: { title: string; percent: number; weakSkillNames: string[] } | null;
  recommendations: Recommendation[];
  practiceQuestion: TutorPracticeQuestion | null; // question to pose (intent=practice)
  pendingQuestion: TutorPracticeQuestion | null; // question the student is answering (intent=answer)
  history: { role: 'user' | 'assistant'; content: string }[];
}

export interface TutorResponse {
  content: string;
  provider: string;
  providerLabel: string;
  suggestions: string[];
  practiceQuestion?: { questionId: string; prompt: string; options: string[] | null; skillName: string };
  answeredCorrectly?: boolean | null;
}

export interface AIProvider {
  readonly id: string;
  readonly label: string;
  generate(req: TutorRequest): Promise<TutorResponse>;
}

export function providerStatus(): { provider: string; label: string; live: boolean; model?: string } {
  if (config.ai.provider === 'openai-compatible' && config.ai.apiKey) {
    return { provider: 'openai-compatible', label: `OpenAI-compatible API (${config.ai.model})`, live: true, model: config.ai.model };
  }
  return { provider: 'demo', label: 'Demo Tutor (curriculum-grounded, offline)', live: false };
}
