import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Globe2, Languages, Mic, Volume2 } from 'lucide-react';
import { get } from '@/lib/api';
import { LANGUAGES, useI18n } from '@/lib/i18n';
import { speech } from '@/lib/speech';
import { Alert, Badge, Button, Card, CardBody, CardHeader, ErrorState, PageHeader, Spinner } from '@/components/ui';
import type { LanguageCode } from '@shared/types';

interface LanguageCatalogue {
  languages: { code: LanguageCode; name: string; nativeName: string; status: 'available' | 'pilot'; lessonTranslations: number; uiStrings: boolean; speech: boolean; notes: string }[];
  translationProvider: { id: string; label: string; live: boolean };
  speechProviders: { id: string; label: string; live: boolean; languages: LanguageCode[] }[];
}

const SAMPLES: Record<LanguageCode, { text: string; lessonId: string; title: string }> = {
  en: { text: 'A fraction shows equal parts of a whole. Three out of four equal parts is written as three by four.', lessonId: 'les-frac-equivalent', title: 'Equivalent Fractions' },
  hi: { text: 'भिन्न किसी पूरी वस्तु के बराबर भागों को दर्शाती है। चार बराबर भागों में से तीन को तीन बटा चार लिखते हैं।', lessonId: 'les-frac-equivalent', title: 'तुल्य भिन्न' },
  ta: { text: 'பின்னம் என்பது ஒரு முழுப் பொருளின் சம பாகங்களைக் காட்டுகிறது. நான்கு சம பாகங்களில் மூன்று, நான்கில் மூன்று என எழுதப்படுகிறது.', lessonId: 'les-frac-equivalent', title: 'சமான பின்னங்கள்' },
  unr: { text: '', lessonId: 'les-frac-equivalent', title: 'Equivalent Fractions' },
};

export function ClassroomPage() {
  const { t, language, setLanguage } = useI18n();
  const [speaking, setSpeaking] = useState<LanguageCode | null>(null);
  const catalogue = useQuery({ queryKey: ['i18n-languages'], queryFn: () => get<LanguageCatalogue>('/i18n/languages') });

  const speak = async (code: LanguageCode) => {
    if (speaking) {
      speech.stop();
      setSpeaking(null);
      if (speaking === code) return;
    }
    setSpeaking(code);
    try {
      await speech.speak(SAMPLES[code].text, code);
    } catch {
      /* not supported */
    } finally {
      setSpeaking(null);
    }
  };

  if (catalogue.isLoading) return <Spinner />;
  if (catalogue.isError) return <ErrorState error={catalogue.error} onRetry={() => catalogue.refetch()} />;
  const c = catalogue.data!;

  return (
    <div>
      <PageHeader title={t('classroom')} subtitle="Learn in your own language: interface strings, lesson translations, AI tutor responses and read-aloud, with a clearly scoped pilot for Mundari." />
      <Alert tone="info" className="mb-6">
        Translation provider: <strong>{c.translationProvider.label}</strong> {c.translationProvider.live ? '(live)' : '(offline dictionary — no machine translation is fabricated)'} · Speech: {c.speechProviders.map((s) => `${s.label}${s.live ? '' : ' (not connected)'}`).join(' · ')}
      </Alert>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {c.languages.map((l) => {
          const sample = SAMPLES[l.code];
          const active = language === l.code;
          return (
            <Card key={l.code} className={active ? 'border-brand-400 ring-2 ring-brand-100' : ''}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    {l.nativeName} <Badge tone={l.status === 'available' ? 'success' : 'warning'}>{l.status}</Badge>
                  </span>
                }
                subtitle={l.name}
              />
              <CardBody className="space-y-3 text-sm">
                <ul className="space-y-1 text-xs text-slate-600">
                  <li>UI strings: {l.uiStrings ? '✅ translated' : '⚠️ English fallback'}</li>
                  <li>Lesson translations: {l.lessonTranslations}</li>
                  <li>Read-aloud: {l.speech ? '✅ browser voice (if installed)' : '—'}</li>
                </ul>
                {sample.text ? (
                  <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">{sample.text}</p>
                ) : (
                  <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{l.notes}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={active ? 'secondary' : 'primary'} icon={<Languages className="h-4 w-4" />} onClick={() => setLanguage(l.code)} disabled={active}>
                    {active ? 'Current' : 'Use'}
                  </Button>
                  {sample.text && (
                    <Button size="sm" variant="outline" icon={<Volume2 className="h-4 w-4" />} onClick={() => speak(l.code)}>
                      {speaking === l.code ? t('stop') : t('listen')}
                    </Button>
                  )}
                </div>
                <Link to={`/lessons/${sample.lessonId}`} onClick={() => setLanguage(l.code)} className="block text-xs font-medium text-brand-700 hover:underline">
                  Open sample lesson: {sample.title} →
                </Link>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Globe2 className="h-4 w-4" /> How multilingual works here</span>} />
          <CardBody className="space-y-2 text-sm text-slate-700">
            <p>1. <strong>UI layer</strong> — dictionary-based strings (English, Hindi, Tamil) switched instantly from the selector; the choice is saved to your profile.</p>
            <p>2. <strong>Content layer</strong> — lessons carry per-language translations; when one is missing the app shows English and says so, never a machine-generated guess.</p>
            <p>3. <strong>Tutor layer</strong> — the AI tutor answers in the selected language for the demo lessons and falls back gracefully elsewhere.</p>
            <p>4. <strong>Speech layer</strong> — a provider interface with the browser Web Speech API implemented; Bhashini/other TTS can be plugged in without UI changes.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Mic className="h-4 w-4" /> Mundari pilot (architecture only)</span>} />
          <CardBody className="space-y-2 text-sm text-slate-700">
            <p>Mundari (ISO 639-3 <code>unr</code>) is registered end to end: language code, selector entry, translation table slot, tutor language routing and speech-provider capability flags.</p>
            <p>No Mundari content is shipped because none has been validated by native speakers. The pilot path is: community-authored lesson translations → review → import via the same <code>lesson_translations</code> table used for Hindi and Tamil.</p>
            <Badge tone="warning">No fabricated content</Badge>
          </CardBody>
        </Card>
      </div>
      <p className="mt-4 text-xs text-slate-400">Registered languages: {LANGUAGES.map((l) => `${l.name} (${l.code})`).join(', ')}</p>
    </div>
  );
}
