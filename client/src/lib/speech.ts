/**
 * Speech abstraction (client side). Provider-independent interface with a real browser implementation
 * (Web Speech API text-to-speech) and a documented stub for external providers (e.g. Bhashini TTS).
 */
import { LANGUAGES, type LanguageCode } from '@shared/types';

export interface SpeechProvider {
  readonly id: string;
  readonly label: string;
  supports(language: LanguageCode): boolean;
  speak(text: string, language: LanguageCode): Promise<void>;
  stop(): void;
  isSpeaking(): boolean;
}

function localeFor(language: LanguageCode): string {
  return LANGUAGES.find((l) => l.code === language)?.speechLocale ?? 'en-IN';
}

export class BrowserSpeechProvider implements SpeechProvider {
  readonly id = 'browser-web-speech';
  readonly label = 'Browser Web Speech API';

  private get synth(): SpeechSynthesis | null {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  }

  voicesFor(language: LanguageCode): SpeechSynthesisVoice[] {
    const synth = this.synth;
    if (!synth) return [];
    const locale = localeFor(language);
    const prefix = locale.split('-')[0];
    return synth.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(prefix.toLowerCase()));
  }

  supports(language: LanguageCode): boolean {
    if (!this.synth) return false;
    if (language === 'unr') return false;
    // Voice lists load asynchronously in some browsers; treat English as always available.
    return language === 'en' || this.voicesFor(language).length > 0 || this.synth.getVoices().length === 0;
  }

  speak(text: string, language: LanguageCode): Promise<void> {
    const synth = this.synth;
    if (!synth) return Promise.reject(new Error('Speech synthesis is not available in this browser'));
    synth.cancel();
    return new Promise((resolve, reject) => {
      const utter = new SpeechSynthesisUtterance(text.replace(/[*_#`>|]/g, '').slice(0, 2500));
      utter.lang = localeFor(language);
      const voice = this.voicesFor(language)[0];
      if (voice) utter.voice = voice;
      utter.rate = 0.95;
      utter.onend = () => resolve();
      utter.onerror = (e) => reject(new Error(e.error || 'speech error'));
      synth.speak(utter);
    });
  }

  stop(): void {
    this.synth?.cancel();
  }

  isSpeaking(): boolean {
    return !!this.synth?.speaking;
  }
}

/** Placeholder for a server/remote speech provider — intentionally not connected. */
export class ExternalSpeechProviderStub implements SpeechProvider {
  readonly id = 'external-tts-stub';
  readonly label = 'External TTS provider (not connected)';
  supports(): boolean {
    return false;
  }
  speak(): Promise<void> {
    return Promise.reject(new Error('External speech provider is not configured'));
  }
  stop(): void {}
  isSpeaking(): boolean {
    return false;
  }
}

export const speech: SpeechProvider = new BrowserSpeechProvider();
