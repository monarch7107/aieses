/**
 * DIKSHA integration abstraction.
 *
 *  DikshaAdapter interface → search / getResource / attribution
 *   • MockDikshaAdapter (default): synthetic catalogue, every item flagged isDemo=true + "DIKSHA (DEMO DATA)".
 *   • LiveDikshaAdapter (opt-in DIKSHA_MODE=live): calls the public Sunbird content-search API used by
 *     diksha.gov.in. NOT verified from the hackathon sandbox (no outbound access) — falls back to mock.
 *
 * Nothing here fabricates live DIKSHA results: live data is only returned when the API actually responds.
 */
import { config } from '../config.js';
import type { DikshaResource } from '@shared/types';

export interface DikshaSearch {
  query?: string;
  subject?: string;
  grade?: string;
  medium?: string;
  limit?: number;
}

export interface DikshaAdapter {
  readonly mode: 'mock' | 'live';
  readonly label: string;
  search(params: DikshaSearch): Promise<{ resources: DikshaResource[]; total: number; live: boolean; note: string }>;
  getResource(identifier: string): Promise<DikshaResource | null>;
  attribution(): string;
}

const MOCK_ATTRIBUTION =
  'DEMO DATA — synthetic catalogue modelled on DIKSHA/NCERT metadata fields (name, subject, gradeLevel, medium, contentType). Not fetched from DIKSHA. Links point to the public DIKSHA explore portal.';

const MOCK_CATALOGUE: DikshaResource[] = [
  { identifier: 'do_demo_math_frac_01', name: 'Fractions – Introduction (Class 6 Mathematics)', description: 'Explainer video introducing fractions as parts of a whole with everyday examples.', subject: ['Mathematics'], gradeLevel: ['Class 6'], medium: ['English'], contentType: 'Resource', mimeType: 'video/mp4', url: 'https://diksha.gov.in/explore?query=fractions%20class%206', attribution: MOCK_ATTRIBUTION, isDemo: true, source: 'DIKSHA (DEMO DATA)' },
  { identifier: 'do_demo_math_frac_02', name: 'Equivalent Fractions – Practice Worksheet', description: 'Printable worksheet with 20 equivalent fraction exercises and answer key.', subject: ['Mathematics'], gradeLevel: ['Class 6'], medium: ['English'], contentType: 'PracticeResource', mimeType: 'application/pdf', url: 'https://diksha.gov.in/explore?query=equivalent%20fractions', attribution: MOCK_ATTRIBUTION, isDemo: true, source: 'DIKSHA (DEMO DATA)' },
  { identifier: 'do_demo_math_frac_03', name: 'भिन्न – तुल्य भिन्न (कक्षा 6 गणित)', description: 'हिन्दी माध्यम में तुल्य भिन्नों की व्याख्या करने वाला वीडियो।', subject: ['Mathematics'], gradeLevel: ['Class 6'], medium: ['Hindi'], contentType: 'Resource', mimeType: 'video/mp4', url: 'https://diksha.gov.in/explore?query=%E0%A4%AD%E0%A4%BF%E0%A4%A8%E0%A5%8D%E0%A4%A8', attribution: MOCK_ATTRIBUTION, isDemo: true, source: 'DIKSHA (DEMO DATA)' },
  { identifier: 'do_demo_math_frac_04', name: 'பின்னங்கள் – அறிமுகம் (வகுப்பு 6 கணிதம்)', description: 'தமிழ் வழியில் பின்னங்களை அறிமுகப்படுத்தும் காணொளி.', subject: ['Mathematics'], gradeLevel: ['Class 6'], medium: ['Tamil'], contentType: 'Resource', mimeType: 'video/mp4', url: 'https://diksha.gov.in/explore?query=%E0%AE%AA%E0%AE%BF%E0%AE%A9%E0%AF%8D%E0%AE%A9%E0%AE%AE%E0%AF%8D', attribution: MOCK_ATTRIBUTION, isDemo: true, source: 'DIKSHA (DEMO DATA)' },
  { identifier: 'do_demo_math_dec_01', name: 'Decimals and Money (Class 6)', description: 'Interactive lesson connecting decimals with rupees and paise.', subject: ['Mathematics'], gradeLevel: ['Class 6'], medium: ['English'], contentType: 'Resource', mimeType: 'application/vnd.ekstep.h5p-archive', url: 'https://diksha.gov.in/explore?query=decimals%20class%206', attribution: MOCK_ATTRIBUTION, isDemo: true, source: 'DIKSHA (DEMO DATA)' },
  { identifier: 'do_demo_sci_light_01', name: 'Light, Shadows and Reflections – Chapter Video', description: 'Chapter walkthrough: luminous objects, transparency, shadows and mirrors.', subject: ['Science'], gradeLevel: ['Class 6'], medium: ['English'], contentType: 'Resource', mimeType: 'video/mp4', url: 'https://diksha.gov.in/explore?query=light%20shadows%20reflections', attribution: MOCK_ATTRIBUTION, isDemo: true, source: 'DIKSHA (DEMO DATA)' },
  { identifier: 'do_demo_sci_light_02', name: 'Pinhole Camera Activity (Science Kit)', description: 'Hands-on activity guide for building a pinhole camera with household materials.', subject: ['Science'], gradeLevel: ['Class 6'], medium: ['English'], contentType: 'ExperientialResource', mimeType: 'application/pdf', url: 'https://diksha.gov.in/explore?query=pinhole%20camera', attribution: MOCK_ATTRIBUTION, isDemo: true, source: 'DIKSHA (DEMO DATA)' },
  { identifier: 'do_demo_sci_light_03', name: 'प्रकाश – छाया एवं परावर्तन (कक्षा 6 विज्ञान)', description: 'हिन्दी माध्यम में छाया बनने की प्रक्रिया और दर्पण पर वीडियो।', subject: ['Science'], gradeLevel: ['Class 6'], medium: ['Hindi'], contentType: 'Resource', mimeType: 'video/mp4', url: 'https://diksha.gov.in/explore?query=%E0%A4%AA%E0%A5%8D%E0%A4%B0%E0%A4%95%E0%A4%BE%E0%A4%B6', attribution: MOCK_ATTRIBUTION, isDemo: true, source: 'DIKSHA (DEMO DATA)' },
  { identifier: 'do_demo_cs_py_01', name: 'Introduction to Python Programming (Class 8 ICT)', description: 'Beginner course on variables, loops and functions with runnable examples.', subject: ['Computer Science'], gradeLevel: ['Class 8'], medium: ['English'], contentType: 'Course', mimeType: 'application/vnd.ekstep.content-collection', url: 'https://diksha.gov.in/explore?query=python%20programming', attribution: MOCK_ATTRIBUTION, isDemo: true, source: 'DIKSHA (DEMO DATA)' },
  { identifier: 'do_demo_cs_py_02', name: 'Loops in Python – Explainer', description: 'Short explainer video on for and while loops with classroom examples.', subject: ['Computer Science'], gradeLevel: ['Class 8'], medium: ['English'], contentType: 'Resource', mimeType: 'video/mp4', url: 'https://diksha.gov.in/explore?query=python%20loops', attribution: MOCK_ATTRIBUTION, isDemo: true, source: 'DIKSHA (DEMO DATA)' },
  { identifier: 'do_demo_cs_js_01', name: 'JavaScript Basics for School Students', description: 'Interactive lesson on variables, functions and arrays.', subject: ['Computer Science'], gradeLevel: ['Class 8'], medium: ['English'], contentType: 'Resource', mimeType: 'application/vnd.ekstep.h5p-archive', url: 'https://diksha.gov.in/explore?query=javascript%20basics', attribution: MOCK_ATTRIBUTION, isDemo: true, source: 'DIKSHA (DEMO DATA)' },
  { identifier: 'do_demo_math_comp_01', name: 'Comparing and Ordering Fractions – Quiz', description: 'Self-check quiz with instant feedback on comparing fractions.', subject: ['Mathematics'], gradeLevel: ['Class 6'], medium: ['English'], contentType: 'PracticeQuestionSet', mimeType: 'application/vnd.sunbird.questionset', url: 'https://diksha.gov.in/explore?query=comparing%20fractions', attribution: MOCK_ATTRIBUTION, isDemo: true, source: 'DIKSHA (DEMO DATA)' },
];

const SUBJECT_ALIASES: Record<string, string> = { math: 'Mathematics', mathematics: 'Mathematics', science: 'Science', cs: 'Computer Science', 'computer science': 'Computer Science' };

export class MockDikshaAdapter implements DikshaAdapter {
  readonly mode = 'mock' as const;
  readonly label = 'DIKSHA adapter — mock mode (DEMO DATA)';

  async search(params: DikshaSearch) {
    const qtext = (params.query ?? '').trim().toLowerCase();
    const subject = params.subject ? SUBJECT_ALIASES[params.subject.toLowerCase()] ?? params.subject : undefined;
    const tokens = qtext.split(/\s+/).filter(Boolean);
    let items = MOCK_CATALOGUE.filter((r) => {
      if (subject && !r.subject.includes(subject)) return false;
      if (params.grade && !r.gradeLevel.some((g) => g.toLowerCase().includes(params.grade!.toLowerCase()))) return false;
      if (params.medium && !r.medium.some((m) => m.toLowerCase() === params.medium!.toLowerCase())) return false;
      if (tokens.length) {
        const hay = `${r.name} ${r.description} ${r.subject.join(' ')}`.toLowerCase();
        return tokens.some((t) => hay.includes(t));
      }
      return true;
    });
    const limit = params.limit ?? 20;
    items = items.slice(0, limit);
    return { resources: items, total: items.length, live: false, note: MOCK_ATTRIBUTION };
  }

  async getResource(identifier: string) {
    return MOCK_CATALOGUE.find((r) => r.identifier === identifier) ?? null;
  }

  attribution() {
    return MOCK_ATTRIBUTION;
  }
}

export class LiveDikshaAdapter implements DikshaAdapter {
  readonly mode = 'live' as const;
  readonly label = 'DIKSHA adapter — live mode (Sunbird content search API, unverified)';
  private fallback = new MockDikshaAdapter();

  async search(params: DikshaSearch) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${config.diksha.baseUrl.replace(/\/$/, '')}/api/content/v1/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          request: {
            filters: {
              status: ['Live'],
              ...(params.subject ? { subject: [SUBJECT_ALIASES[params.subject.toLowerCase()] ?? params.subject] } : {}),
              ...(params.grade ? { gradeLevel: [params.grade] } : {}),
              ...(params.medium ? { medium: [params.medium] } : {}),
            },
            query: params.query ?? '',
            limit: params.limit ?? 20,
            fields: ['identifier', 'name', 'description', 'subject', 'gradeLevel', 'medium', 'contentType', 'mimeType', 'attributions', 'organisation'],
          },
        }),
      }).finally(() => clearTimeout(timer));
      if (!res.ok) throw new Error(`DIKSHA HTTP ${res.status}`);
      const data = (await res.json()) as { result?: { content?: Record<string, unknown>[]; count?: number } };
      const content = data.result?.content ?? [];
      const resources: DikshaResource[] = content.map((c) => ({
        identifier: String(c.identifier),
        name: String(c.name ?? ''),
        description: String(c.description ?? ''),
        subject: (c.subject as string[]) ?? [],
        gradeLevel: (c.gradeLevel as string[]) ?? [],
        medium: (c.medium as string[]) ?? [],
        contentType: String(c.contentType ?? ''),
        mimeType: String(c.mimeType ?? ''),
        url: `${config.diksha.baseUrl.replace(/\/$/, '')}/play/content/${c.identifier}`,
        attribution: `Content from DIKSHA (${((c.organisation as string[]) ?? (c.attributions as string[]) ?? []).join(', ') || 'contributor not listed'})`,
        isDemo: false,
        source: 'DIKSHA',
      }));
      return { resources, total: data.result?.count ?? resources.length, live: true, note: 'Live results from the DIKSHA content search API.' };
    } catch (err) {
      const mock = await this.fallback.search(params);
      return { ...mock, note: `Live DIKSHA API unreachable (${(err as Error).message}) — showing DEMO DATA.` };
    }
  }

  async getResource(identifier: string) {
    return this.fallback.getResource(identifier);
  }

  attribution() {
    return 'Content © respective DIKSHA contributors; retrieved via the public Sunbird content search API.';
  }
}

let adapter: DikshaAdapter | null = null;
export function getDikshaAdapter(): DikshaAdapter {
  if (adapter) return adapter;
  adapter = config.diksha.mode === 'live' ? new LiveDikshaAdapter() : new MockDikshaAdapter();
  return adapter;
}
