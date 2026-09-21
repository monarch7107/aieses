/**
 * Multilingual layer — provider-independent translation & speech abstractions.
 *
 *  TranslationProvider
 *   • DictionaryTranslationProvider (active): human-authored demo translations stored in lesson_translations.
 *   • ExternalTranslationProvider (stub): shape for Bhashini / cloud MT — NOT connected, requires credentials.
 *
 *  SpeechProvider (server-side registry only; the browser Web Speech API provider lives in the client)
 */
import { q } from '../db/index.js';
import { LANGUAGES, type LanguageCode, type LanguageInfo } from '@shared/types';

export interface TranslationProvider {
  readonly id: string;
  readonly label: string;
  readonly live: boolean;
  translateLesson(lessonId: string, target: LanguageCode): Promise<{ status: 'available' | 'fallback'; provider: string }>;
  coverage(): { language: LanguageCode; lessons: number }[];
}

export class DictionaryTranslationProvider implements TranslationProvider {
  readonly id = 'dictionary';
  readonly label = 'Authored demo translations (dictionary)';
  readonly live = false;

  async translateLesson(lessonId: string, target: LanguageCode) {
    if (target === 'en') return { status: 'available' as const, provider: this.id };
    const row = q.get('SELECT 1 FROM lesson_translations WHERE lesson_id = ? AND language = ?', lessonId, target);
    return { status: row ? ('available' as const) : ('fallback' as const), provider: this.id };
  }

  coverage() {
    const rows = q.all<{ language: LanguageCode; n: number }>('SELECT language, COUNT(*) AS n FROM lesson_translations GROUP BY language');
    return LANGUAGES.filter((l) => l.code !== 'en').map((l) => ({ language: l.code, lessons: rows.find((r) => r.language === l.code)?.n ?? 0 }));
  }
}

/** Placeholder for a government/cloud MT provider (e.g. Bhashini ULCA). Never fabricates output. */
export class ExternalTranslationProvider implements TranslationProvider {
  readonly id = 'external-stub';
  readonly label = 'External MT provider (not connected — credentials required)';
  readonly live = false;
  private dictionary = new DictionaryTranslationProvider();
  async translateLesson(lessonId: string, target: LanguageCode) {
    return this.dictionary.translateLesson(lessonId, target);
  }
  coverage() {
    return this.dictionary.coverage();
  }
}

const translationProvider: TranslationProvider = new DictionaryTranslationProvider();
export function getTranslationProvider(): TranslationProvider {
  return translationProvider;
}

export interface SpeechProviderInfo {
  id: string;
  label: string;
  where: 'browser' | 'server';
  live: boolean;
  locales: string[];
  note: string;
}

export function speechProviders(): SpeechProviderInfo[] {
  return [
    {
      id: 'browser-web-speech',
      label: 'Browser Web Speech API (text-to-speech)',
      where: 'browser',
      live: true,
      locales: ['en-IN', 'hi-IN', 'ta-IN'],
      note: 'Uses voices installed in the student\'s browser/OS; availability of Hindi/Tamil voices depends on the device.',
    },
    {
      id: 'external-tts-stub',
      label: 'External speech provider (Bhashini / cloud TTS)',
      where: 'server',
      live: false,
      locales: [],
      note: 'Interface reserved; not connected — requires provider credentials.',
    },
  ];
}

export function languageCatalogue(): (LanguageInfo & { lessonTranslations: number })[] {
  const coverage = getTranslationProvider().coverage();
  const total = q.count('SELECT COUNT(*) FROM lessons');
  return LANGUAGES.map((l) => ({
    ...l,
    lessonTranslations: l.code === 'en' ? total : coverage.find((c) => c.language === l.code)?.lessons ?? 0,
  }));
}
