/**
 * Demo Tutor — deterministic, curriculum-grounded assistant used when no live LLM is configured.
 * It composes answers from the lesson's authored notes (summary, key points, simpler explanation,
 * worked example, misconceptions, glossary) plus the student's skill profile. Clearly labelled in the UI.
 */
import type { AIProvider, TutorRequest, TutorResponse } from './provider.js';
import type { LanguageCode } from '@shared/types';

const L = {
  en: {
    keyIdeas: 'Key ideas',
    simpler: 'A simpler way to see it',
    example: 'Worked example',
    watchOut: 'Watch out for',
    practiceIntro: 'Try this practice question',
    correct: 'Correct! 🎉',
    incorrect: 'Not quite.',
    theAnswerIs: 'The correct answer is',
    nextSteps: 'Recommended next steps',
    noLesson: "I don't have a lesson open right now, so here is what I can see from your profile.",
    askMore: 'Ask me for a simpler explanation, an example, or a practice question.',
    demoNote: 'Demo Tutor: answers are composed from your lesson notes and progress (no live AI provider configured).',
    glossaryHit: 'Definition',
    greeting: 'Namaste! I am your AIESES tutor.',
    inLesson: 'You are on the lesson',
    yourMastery: 'Your current mastery',
    weakest: 'Your weakest skill right now is',
  },
  hi: {
    keyIdeas: 'मुख्य बिंदु',
    simpler: 'इसे सरल तरीके से समझें',
    example: 'हल किया हुआ उदाहरण',
    watchOut: 'इन गलतियों से बचें',
    practiceIntro: 'यह अभ्यास प्रश्न हल करें',
    correct: 'सही उत्तर! 🎉',
    incorrect: 'यह सही नहीं है।',
    theAnswerIs: 'सही उत्तर है',
    nextSteps: 'अगले सुझाए गए कदम',
    noLesson: 'अभी कोई पाठ खुला नहीं है, इसलिए मैं आपकी प्रोफ़ाइल के आधार पर बता रहा हूँ।',
    askMore: 'मुझसे सरल व्याख्या, उदाहरण या अभ्यास प्रश्न माँगें।',
    demoNote: 'डेमो ट्यूटर: उत्तर आपके पाठ के नोट्स और प्रगति से बनाए गए हैं (कोई लाइव AI प्रदाता कॉन्फ़िगर नहीं है)।',
    glossaryHit: 'परिभाषा',
    greeting: 'नमस्ते! मैं आपका AIESES ट्यूटर हूँ।',
    inLesson: 'आप इस पाठ पर हैं',
    yourMastery: 'आपकी वर्तमान दक्षता',
    weakest: 'अभी आपका सबसे कमज़ोर कौशल है',
  },
  ta: {
    keyIdeas: 'முக்கியக் கருத்துகள்',
    simpler: 'எளிமையாகப் புரிந்துகொள்ள',
    example: 'தீர்க்கப்பட்ட எடுத்துக்காட்டு',
    watchOut: 'கவனிக்க வேண்டியவை',
    practiceIntro: 'இந்தப் பயிற்சி வினாவை முயற்சிக்கவும்',
    correct: 'சரியான பதில்! 🎉',
    incorrect: 'இது சரியல்ல.',
    theAnswerIs: 'சரியான பதில்',
    nextSteps: 'பரிந்துரைக்கப்பட்ட அடுத்த படிகள்',
    noLesson: 'இப்போது எந்தப் பாடமும் திறந்திருக்கவில்லை, எனவே உங்கள் சுயவிவரத்தின் அடிப்படையில் சொல்கிறேன்.',
    askMore: 'எளிய விளக்கம், எடுத்துக்காட்டு அல்லது பயிற்சி வினாவைக் கேளுங்கள்.',
    demoNote: 'டெமோ டியூட்டர்: பதில்கள் உங்கள் பாடக் குறிப்புகள் மற்றும் முன்னேற்றத்திலிருந்து உருவாக்கப்பட்டவை (நேரடி AI வழங்குநர் இல்லை).',
    glossaryHit: 'வரையறை',
    greeting: 'வணக்கம்! நான் உங்கள் AIESES ஆசிரியர்.',
    inLesson: 'நீங்கள் இந்தப் பாடத்தில் உள்ளீர்கள்',
    yourMastery: 'உங்கள் தற்போதைய தேர்ச்சி',
    weakest: 'இப்போது உங்களுக்கு மிகவும் பலவீனமான திறன்',
  },
} as const;

type Labels = { [K in keyof (typeof L)['en']]: string };

function labels(lang: LanguageCode): Labels {
  return (L as unknown as Record<string, Labels>)[lang] ?? L.en;
}

function firstParagraph(md: string): string {
  const blocks = md.split(/\n\s*\n/).map((b) => b.trim());
  const para = blocks.find((b) => b && !b.startsWith('#') && !b.startsWith('|') && !b.startsWith('```') && !b.startsWith('>'));
  return para ? para.replace(/\n/g, ' ') : '';
}

function bullet(items: string[]): string {
  return items.map((i) => `- ${i}`).join('\n');
}

function masteryLine(req: TutorRequest, t: Labels): string {
  const relevant = req.skills.filter((s) => s.attemptsCount > 0);
  if (!relevant.length) return '';
  return relevant.map((s) => `${s.name}: **${Math.round(s.mastery)}%**`).join(' · ');
}

export class DemoTutorProvider implements AIProvider {
  readonly id = 'demo';
  readonly label = 'Demo Tutor (curriculum-grounded, offline)';

  async generate(req: TutorRequest): Promise<TutorResponse> {
    const t = labels(req.language);
    const lesson = req.lesson;
    const suggestions = lesson
      ? ['Explain this more simply', 'Give me an example', 'Give me a practice question', 'What should I study next?']
      : ['What should I study next?', 'Give me a practice question', 'Show my weak areas'];
    const base = (content: string, extra: Partial<TutorResponse> = {}): TutorResponse => ({
      content: `${content}\n\n_${t.demoNote}_`,
      provider: this.id,
      providerLabel: this.label,
      suggestions,
      ...extra,
    });

    // --- Answer to a pending practice question -------------------------------
    if (req.intent === 'answer' && req.pendingQuestion) {
      const pq = req.pendingQuestion;
      const chosen = parseChoice(req.message, pq.options);
      const correct = chosen !== null && pq.answerIndex !== null && chosen === pq.answerIndex;
      const answerText = pq.options && pq.answerIndex !== null ? `${String.fromCharCode(65 + pq.answerIndex)}. ${pq.options[pq.answerIndex]}` : '';
      const verdict = correct ? `**${t.correct}**` : `**${t.incorrect}** ${t.theAnswerIs} **${answerText}**.`;
      return base(`${verdict}\n\n${pq.explanation}\n\n${t.askMore}`, { answeredCorrectly: correct });
    }

    // --- Glossary lookups (works in any intent) -------------------------------
    if (lesson) {
      const lower = req.message.toLowerCase();
      const hit = Object.entries(lesson.glossary).find(([term]) => lower.includes(term.toLowerCase()));
      if (hit && (req.intent === 'general' || /what (is|are|does)|define|meaning/.test(lower))) {
        return base(`**${t.glossaryHit} — ${hit[0]}**\n\n${hit[1]}\n\n${t.inLesson} **${lesson.title}**. ${t.askMore}`);
      }
    }

    switch (req.intent) {
      case 'simpler': {
        if (!lesson) return base(`${t.noLesson}\n\n${t.askMore}`);
        return base(`**${t.simpler} — ${titleFor(lesson, req.language)}**\n\n${lesson.simpler}\n\n**${t.keyIdeas}**\n${bullet(pointsFor(lesson, req.language))}`);
      }
      case 'example': {
        if (!lesson) return base(`${t.noLesson}\n\n${t.askMore}`);
        const watch = lesson.misconceptions.length ? `\n\n**${t.watchOut}**\n${bullet(lesson.misconceptions)}` : '';
        return base(`**${t.example} — ${titleFor(lesson, req.language)}**\n\n${lesson.example}${watch}`);
      }
      case 'practice': {
        const pq = req.practiceQuestion;
        if (!pq) return base(`${t.noLesson}\n\n${t.askMore}`);
        const opts = pq.options ? '\n\n' + pq.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n') : '';
        return base(`**${t.practiceIntro}** (${pq.skillName})\n\n${pq.prompt}${opts}`, {
          practiceQuestion: { questionId: pq.questionId, prompt: pq.prompt, options: pq.options, skillName: pq.skillName },
          suggestions: pq.options ? pq.options.map((_, i) => String.fromCharCode(65 + i)) : ['Show me the answer'],
        });
      }
      case 'recommend': {
        const recs = req.recommendations.slice(0, 4);
        const weakest = req.skills.filter((s) => s.level === 'weak').sort((a, b) => a.mastery - b.mastery)[0];
        const lines: string[] = [];
        if (weakest) lines.push(`${t.weakest} **${weakest.name}** (${Math.round(weakest.mastery)}%).`);
        if (req.recentAttempt) {
          lines.push(
            `Latest assessment: **${req.recentAttempt.title}** — ${req.recentAttempt.percent}%${
              req.recentAttempt.weakSkillNames.length ? ` (weak: ${req.recentAttempt.weakSkillNames.join(', ')})` : ''
            }.`,
          );
        }
        if (recs.length) {
          lines.push(`**${t.nextSteps}**\n${recs.map((r, i) => `${i + 1}. **${r.title}** — ${r.reason}`).join('\n')}`);
        } else {
          lines.push('No weak areas detected yet — complete a practice set and I will personalise your plan.');
        }
        return base(lines.join('\n\n'));
      }
      case 'explain':
      case 'general':
      default: {
        if (!lesson) {
          const mastery = masteryLine(req, t);
          const recs = req.recommendations.slice(0, 3);
          return base(
            [
              `${t.greeting} ${t.noLesson}`,
              mastery ? `**${t.yourMastery}:** ${mastery}` : '',
              recs.length ? `**${t.nextSteps}**\n${recs.map((r) => `- **${r.title}** — ${r.reason}`).join('\n')}` : '',
              t.askMore,
            ]
              .filter(Boolean)
              .join('\n\n'),
          );
        }
        const greeting = /^(hi|hello|hey|namaste|vanakkam)\b/i.test(req.message.trim());
        const intro = greeting ? `${t.greeting} ${t.inLesson} **${lesson.title}**.` : `**${titleFor(lesson, req.language)}**`;
        const summary = summaryFor(lesson, req.language);
        const para = req.language === 'en' ? firstParagraph(lesson.contentMd) : '';
        const mastery = masteryLine(req, t);
        return base(
          [
            intro,
            summary,
            para && para !== summary ? para : '',
            `**${t.keyIdeas}**\n${bullet(pointsFor(lesson, req.language))}`,
            mastery ? `**${t.yourMastery}:** ${mastery}` : '',
            t.askMore,
          ]
            .filter(Boolean)
            .join('\n\n'),
        );
      }
    }
  }
}

function titleFor(lesson: NonNullable<TutorRequest['lesson']>, lang: LanguageCode): string {
  return lang !== 'en' && lesson.translation?.status === 'available' ? lesson.translation.title : lesson.title;
}
function summaryFor(lesson: NonNullable<TutorRequest['lesson']>, lang: LanguageCode): string {
  return lang !== 'en' && lesson.translation?.status === 'available' ? lesson.translation.summary : lesson.summary;
}
function pointsFor(lesson: NonNullable<TutorRequest['lesson']>, lang: LanguageCode): string[] {
  return lang !== 'en' && lesson.translation?.status === 'available' ? lesson.translation.keyPoints : lesson.keyPoints;
}

/** Parse "B", "b.", "option 2", "my answer: C", or the option text itself. */
export function parseChoice(message: string, options: string[] | null): number | null {
  const m = message.trim();
  const letter = m.match(/^(?:my answer(?: is)?[:\s]*)?\(?([a-dA-D])\)?[.)]?$/) || m.match(/\b(?:option|answer|choose|pick)\s*\(?([a-dA-D])\)?/i);
  if (letter) return letter[1].toUpperCase().charCodeAt(0) - 65;
  const num = m.match(/^(?:option\s*)?([1-4])$/);
  if (num) return Number(num[1]) - 1;
  if (options) {
    const idx = options.findIndex((o) => o.trim().toLowerCase() === m.toLowerCase());
    if (idx >= 0) return idx;
  }
  return null;
}
