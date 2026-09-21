/**
 * AI Safety / Governance MVP — deterministic input & output guardrails.
 * These are basic keyword/regex screens, not a full moderation model.
 */
import { config } from '../../config.js';

export type SafetyCategory = 'self_harm' | 'violence' | 'sexual' | 'harassment' | 'prompt_injection' | 'too_long' | 'empty';

export interface SafetyVerdict {
  blocked: boolean;
  category?: SafetyCategory;
  response?: string;
}

const RULES: { category: SafetyCategory; pattern: RegExp; response: string }[] = [
  {
    category: 'self_harm',
    pattern: /\b(kill myself|end my life|suicide|self[- ]harm|hurt myself|want to die)\b/i,
    response:
      "I'm really glad you told me, and I'm sorry you're feeling this way. I'm a study assistant and not able to help with this the way a person can. Please talk to a trusted adult, teacher or counsellor right now. In India you can call Tele-MANAS on 14416 (free, 24×7) or KIRAN on 1800-599-0019. You matter.",
  },
  {
    category: 'violence',
    pattern: /\b(how to (make|build) (a )?(bomb|gun|weapon)|hurt (someone|him|her|them)|attack (my|the) (school|teacher|class))\b/i,
    response: "I can't help with anything that could hurt people. If you're worried about safety at school, please tell a teacher or a trusted adult. I'm happy to help with your lessons instead.",
  },
  {
    category: 'sexual',
    pattern: /\b(porn|sexual|nude|naked)\b/i,
    response: "That's not something I can discuss here. Let's keep going with your studies — ask me anything about your current lesson.",
  },
  {
    category: 'harassment',
    pattern: /\b(stupid|idiot|dumb)\b.*\b(teacher|student|classmate)\b|\b(bully|bullying)\b.*\b(how|help)\b/i,
    response: "Let's keep things respectful. If someone is being unkind to you, please tell a teacher. I'm here to help with your learning.",
  },
  {
    category: 'prompt_injection',
    pattern: /(ignore (all|the|your|previous|prior) (previous |prior )?instructions|reveal (your|the) (system )?prompt|system prompt|you are now|jailbreak|developer mode|pretend (you are|to be))/i,
    response: "I'm the AIESES tutor and I can only help with learning tasks. My configuration isn't something I can share, but I'm happy to explain the lesson, give an example, or set a practice question.",
  },
];

export function screenInput(text: string): SafetyVerdict {
  const trimmed = text.trim();
  if (!trimmed) return { blocked: true, category: 'empty', response: 'Please type a question about your lesson.' };
  if (trimmed.length > config.limits.maxAiMessageChars) {
    return { blocked: true, category: 'too_long', response: `Please keep your question under ${config.limits.maxAiMessageChars} characters.` };
  }
  for (const rule of RULES) {
    if (rule.pattern.test(trimmed)) return { blocked: true, category: rule.category, response: rule.response };
  }
  return { blocked: false };
}

/** Strip anything that looks like leaked configuration and cap the length of provider output. */
export function screenOutput(text: string): string {
  let out = text.replace(/^\s*(system|developer)\s*:\s*.*$/gim, '').trim();
  if (out.length > 6000) out = out.slice(0, 6000) + '…';
  return out;
}

/** Remove obvious PII patterns (phone numbers, emails) from text sent to external providers. */
export function redactPii(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/\b(\+91[- ]?)?\d{10}\b/g, '[phone]');
}
