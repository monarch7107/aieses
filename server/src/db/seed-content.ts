/**
 * AIESES demo curriculum — SYNTHETIC DEMO CONTENT authored for the hackathon MVP.
 * Content is aligned to Class 6 / Class 8 style topics but is not an official NCERT/DIKSHA export.
 */
import type { LanguageCode, TutorNotes } from '@shared/types';

export interface SeedSubject {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export interface SeedSkill {
  id: string;
  subjectId: string;
  name: string;
  description: string;
}

export interface SeedLesson {
  id: string;
  title: string;
  summary: string;
  durationMin: number;
  skills: string[];
  keyPoints: string[];
  contentMd: string;
  tutor: TutorNotes;
  /** filled in by the seeder */
  practiceId?: string;
}

export interface SeedModule {
  id: string;
  title: string;
  description: string;
  lessons: SeedLesson[];
}

export interface SeedCourse {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  grade: number;
  level: 'foundation' | 'intermediate' | 'advanced';
  estimatedHours: number;
  color: string;
  modules: SeedModule[];
}

export interface SeedQuestion {
  id: string;
  lessonId: string;
  skillId: string;
  prompt: string;
  options: string[];
  answer: number; // index into options
  explanation: string;
  difficulty: 1 | 2 | 3;
}

export interface SeedResource {
  id: string;
  title: string;
  type: 'video' | 'article' | 'interactive' | 'pdf';
  url: string;
  source: string;
  subjectId: string;
  skillId: string;
  language: LanguageCode;
  description: string;
  durationMin: number;
}

export interface SeedTranslation {
  lessonId: string;
  language: LanguageCode;
  title: string;
  summary: string;
  keyPoints: string[];
  contentMd: string;
}

export const subjects: SeedSubject[] = [
  { id: 'math', name: 'Mathematics', icon: 'calculator', color: '#2563eb', description: 'Numbers, fractions, decimals and problem solving.' },
  { id: 'science', name: 'Science', icon: 'flask', color: '#16a34a', description: 'Light, shadows, reflection and the world around us.' },
  { id: 'cs', name: 'Computer Science', icon: 'code', color: '#7c3aed', description: 'Programming fundamentals with Python and JavaScript.' },
];

export const skills: SeedSkill[] = [
  { id: 'frac-basics', subjectId: 'math', name: 'Fraction Basics', description: 'Numerator, denominator and reading fractions.' },
  { id: 'frac-equivalent', subjectId: 'math', name: 'Equivalent Fractions', description: 'Finding fractions that represent the same value.' },
  { id: 'frac-compare', subjectId: 'math', name: 'Comparing Fractions', description: 'Ordering fractions with like and unlike denominators.' },
  { id: 'frac-add-sub', subjectId: 'math', name: 'Adding & Subtracting Fractions', description: 'Combining fractions using common denominators.' },
  { id: 'frac-multiply', subjectId: 'math', name: 'Multiplying Fractions', description: 'Multiplying fractions and whole numbers.' },
  { id: 'dec-basics', subjectId: 'math', name: 'Decimal Basics', description: 'Place value of tenths and hundredths.' },
  { id: 'frac-dec-convert', subjectId: 'math', name: 'Fraction ↔ Decimal Conversion', description: 'Converting between fractions and decimals.' },
  { id: 'light-sources', subjectId: 'science', name: 'Sources of Light', description: 'Luminous and non-luminous objects.' },
  { id: 'light-transparency', subjectId: 'science', name: 'Transparency of Materials', description: 'Transparent, translucent and opaque objects.' },
  { id: 'shadows', subjectId: 'science', name: 'Shadows', description: 'How and why shadows form.' },
  { id: 'pinhole', subjectId: 'science', name: 'Pinhole Camera', description: 'Rectilinear propagation of light and image formation.' },
  { id: 'reflection', subjectId: 'science', name: 'Reflection', description: 'Mirrors and how light bounces back.' },
  { id: 'prog-basics', subjectId: 'cs', name: 'Programming Basics', description: 'What programs are and how computers follow instructions.' },
  { id: 'py-variables', subjectId: 'cs', name: 'Python Variables', description: 'Storing values with names and data types.' },
  { id: 'py-conditionals', subjectId: 'cs', name: 'Conditionals', description: 'Decision making with if / elif / else.' },
  { id: 'py-loops', subjectId: 'cs', name: 'Loops', description: 'Repeating work with for and while loops.' },
  { id: 'py-functions', subjectId: 'cs', name: 'Functions', description: 'Defining and calling reusable blocks of code.' },
  { id: 'js-basics', subjectId: 'cs', name: 'JavaScript Basics', description: 'Variables, console output and simple expressions.' },
  { id: 'js-functions', subjectId: 'cs', name: 'JavaScript Functions & Arrays', description: 'Functions, arrays and array methods.' },
];

const g = (glossary: Record<string, string>) => glossary;

export const courses: SeedCourse[] = [
  {
    id: 'course-math6-fractions',
    subjectId: 'math',
    title: 'Fractions & Decimals',
    description: 'Understand parts of a whole, compare and operate on fractions, and connect them with decimals.',
    grade: 6,
    level: 'foundation',
    estimatedHours: 3,
    color: '#2563eb',
    modules: [
      {
        id: 'mod-frac-understanding',
        title: 'Understanding Fractions',
        description: 'What fractions mean and how to recognise equal fractions.',
        lessons: [
          {
            id: 'les-frac-what',
            title: 'What is a Fraction?',
            summary: 'A fraction shows equal parts of a whole. The top number is the numerator and the bottom number is the denominator.',
            durationMin: 10,
            skills: ['frac-basics'],
            keyPoints: [
              'A fraction = numerator / denominator.',
              'The denominator tells how many equal parts the whole is divided into.',
              'The numerator tells how many of those parts are taken.',
              '3/4 means three out of four equal parts.',
            ],
            contentMd: `## Parts of a whole

Imagine a roti cut into **4 equal pieces**. If you eat 3 pieces, you have eaten **3/4** of the roti.

- **Numerator** (top number): how many parts are taken → 3
- **Denominator** (bottom number): how many equal parts in total → 4

> The parts must be **equal**. Cutting a roti into 4 uneven pieces does not give quarters!

## Reading fractions

| Fraction | We say | Meaning |
|---|---|---|
| 1/2 | one half | 1 of 2 equal parts |
| 1/4 | one quarter | 1 of 4 equal parts |
| 2/3 | two thirds | 2 of 3 equal parts |

## Fractions on a number line

Between 0 and 1 you can mark 1/4, 2/4, 3/4. Each step is one quarter. When the numerator equals the denominator (4/4) you reach the whole, which is 1.

## Try it
Look around you: a clock face, a chocolate bar, a cricket over. Each can be described with fractions — 15 minutes is 1/4 of an hour!`,
            tutor: {
              simpler:
                'Think of a pizza. Cut it into equal slices — that number goes at the bottom. Count the slices you take — that number goes on top. 2 slices out of 8 equal slices is 2/8.',
              example:
                'A chocolate bar has 6 equal pieces. Meera eats 5 pieces. The fraction eaten is 5/6, and the fraction left is 1/6 because 6 − 5 = 1 piece remains out of 6.',
              misconceptions: [
                'Parts must be equal — 1 of 3 unequal pieces is not 1/3.',
                'A bigger denominator means smaller pieces, not a bigger fraction.',
              ],
              glossary: g({
                numerator: 'The top number of a fraction — how many parts are taken.',
                denominator: 'The bottom number of a fraction — how many equal parts make the whole.',
                whole: 'The complete object or quantity that is being divided.',
              }),
            },
          },
          {
            id: 'les-frac-equivalent',
            title: 'Equivalent Fractions',
            summary: 'Different fractions can name the same amount. Multiply or divide the numerator and denominator by the same number to find equivalent fractions.',
            durationMin: 12,
            skills: ['frac-equivalent', 'frac-basics'],
            keyPoints: [
              'Equivalent fractions have the same value: 1/2 = 2/4 = 4/8.',
              'Multiply (or divide) top and bottom by the SAME number.',
              'A fraction is in simplest form when numerator and denominator share no common factor except 1.',
              'Cross-multiplication checks equivalence: 2/3 = 4/6 because 2×6 = 3×4.',
            ],
            contentMd: `## Same amount, different names

Half of a roti is the same amount whether you call it **1/2**, **2/4** or **4/8**. These are **equivalent fractions**.

## How to make equivalent fractions

Multiply the numerator **and** the denominator by the same non-zero number:

\`\`\`
1/2 × 2/2 = 2/4
1/2 × 3/3 = 3/6
1/2 × 5/5 = 5/10
\`\`\`

Dividing both by the same number also works — this is called **simplifying**:

\`\`\`
6/8 ÷ 2/2 = 3/4
\`\`\`

## Simplest form

A fraction is in **simplest form** (lowest terms) when the only common factor of the numerator and denominator is 1.

- 12/16 → divide both by 4 → **3/4** ✅ simplest
- 10/15 → divide both by 5 → **2/3** ✅ simplest

## Checking equivalence quickly

Cross-multiply. For 2/3 and 4/6: 2 × 6 = 12 and 3 × 4 = 12. Equal products ⇒ equivalent fractions.

> **Common mistake:** adding the same number to top and bottom does NOT give an equivalent fraction. 1/2 ≠ 2/3.`,
            tutor: {
              simpler:
                'Cutting each piece of a cake into two smaller pieces doubles the number of pieces but you still have the same amount of cake. That is why 1/2 and 2/4 are equal — you multiplied top and bottom by 2.',
              example:
                'Is 3/5 equivalent to 9/15? Multiply 3 × 3 = 9 and 5 × 3 = 15 — the same multiplier (3) on top and bottom, so yes, 3/5 = 9/15. Check: 3 × 15 = 45 and 5 × 9 = 45.',
              misconceptions: [
                'Adding the same number to numerator and denominator does not keep the value (1/2 ≠ 2/3).',
                'You must multiply or divide BOTH parts by the same number.',
              ],
              glossary: g({
                'equivalent fractions': 'Fractions that look different but have exactly the same value.',
                'simplest form': 'A fraction whose numerator and denominator have no common factor other than 1.',
                'common factor': 'A number that divides two numbers exactly, e.g. 4 is a common factor of 12 and 16.',
              }),
            },
          },
          {
            id: 'les-frac-compare',
            title: 'Comparing Fractions',
            summary: 'Compare fractions by making the denominators the same, or by comparing with benchmarks like 1/2.',
            durationMin: 12,
            skills: ['frac-compare', 'frac-equivalent'],
            keyPoints: [
              'Same denominator → the bigger numerator is bigger (5/8 > 3/8).',
              'Same numerator → the smaller denominator is bigger (2/3 > 2/5).',
              'Unlike fractions → convert to a common denominator using the LCM.',
              'Benchmarks (0, 1/2, 1) give quick estimates.',
            ],
            contentMd: `## Like fractions

When denominators are the same, just compare numerators: **5/8 > 3/8** because 5 pieces are more than 3 pieces of the same size.

## Same numerator

When numerators are the same, the fraction with the **smaller denominator** is larger: **2/3 > 2/5**, because thirds are bigger pieces than fifths.

## Unlike fractions — use a common denominator

Compare 3/4 and 5/6.

1. LCM of 4 and 6 is 12.
2. 3/4 = 9/12 and 5/6 = 10/12.
3. 10/12 > 9/12, so **5/6 > 3/4**.

## Benchmark trick

Is 4/9 more or less than 1/2? Half of 9 is 4.5, and 4 < 4.5, so **4/9 < 1/2**.

## Ordering

To order 1/2, 2/3 and 3/5, write them as 15/30, 20/30 and 18/30 → ascending order is 1/2, 3/5, 2/3.`,
            tutor: {
              simpler:
                'Bigger bottom number = the pizza was cut into more slices = each slice is smaller. So 1/8 of a pizza is smaller than 1/4 even though 8 is bigger than 4.',
              example:
                'Which is bigger, 2/5 or 3/10? LCM of 5 and 10 is 10. 2/5 = 4/10. Since 4/10 > 3/10, 2/5 is bigger.',
              misconceptions: [
                'A larger denominator does not make a larger fraction.',
                'You cannot compare numerators alone when denominators differ.',
              ],
              glossary: g({
                'like fractions': 'Fractions with the same denominator.',
                'unlike fractions': 'Fractions with different denominators.',
                LCM: 'Lowest common multiple — the smallest number that both denominators divide into.',
                benchmark: 'A familiar value such as 0, 1/2 or 1 used for quick estimates.',
              }),
            },
          },
        ],
      },
      {
        id: 'mod-frac-operations',
        title: 'Operations with Fractions',
        description: 'Adding, subtracting and multiplying fractions.',
        lessons: [
          {
            id: 'les-frac-add',
            title: 'Adding and Subtracting Fractions',
            summary: 'Add or subtract fractions only when the denominators are the same. For unlike fractions, first find a common denominator.',
            durationMin: 15,
            skills: ['frac-add-sub', 'frac-equivalent'],
            keyPoints: [
              'Like fractions: add/subtract the numerators, keep the denominator.',
              'Unlike fractions: convert to the LCM denominator first.',
              'Always simplify the answer.',
              'Mixed numbers can be converted to improper fractions before adding.',
            ],
            contentMd: `## Like fractions

Add the numerators and keep the denominator:

\`\`\`
2/7 + 3/7 = 5/7
5/9 − 2/9 = 3/9 = 1/3   (simplified)
\`\`\`

## Unlike fractions

Find the LCM of the denominators, rewrite, then add:

\`\`\`
1/4 + 1/6
LCM(4, 6) = 12
1/4 = 3/12,  1/6 = 2/12
3/12 + 2/12 = 5/12
\`\`\`

Subtraction works the same way:

\`\`\`
5/6 − 1/4 = 10/12 − 3/12 = 7/12
\`\`\`

## Mixed numbers

2 1/2 + 1 1/3 → convert: 5/2 + 4/3 = 15/6 + 8/6 = 23/6 = **3 5/6**

## Word problem

Ravi walked 3/4 km to school and 1/2 km to the market. Total = 3/4 + 2/4 = 5/4 = **1 1/4 km**.

> **Never** add denominators. 1/2 + 1/2 is 1, not 2/4!`,
            tutor: {
              simpler:
                'You can only add things that are the same size. Quarters plus quarters is easy: 1 quarter + 2 quarters = 3 quarters. If the pieces are different sizes, first cut them into equal pieces (common denominator), then count.',
              example:
                '2/3 + 1/6: sixths are half the size of thirds, so 2/3 = 4/6. Now 4/6 + 1/6 = 5/6.',
              misconceptions: [
                'Adding denominators (1/2 + 1/2 = 2/4) is wrong — the denominator stays the same for like fractions.',
                'Forgetting to convert BOTH fractions to the common denominator.',
              ],
              glossary: g({
                'improper fraction': 'A fraction whose numerator is larger than its denominator, like 5/4.',
                'mixed number': 'A whole number together with a fraction, like 1 1/4.',
              }),
            },
          },
          {
            id: 'les-frac-multiply',
            title: 'Multiplying Fractions',
            summary: 'To multiply fractions, multiply the numerators together and the denominators together, then simplify.',
            durationMin: 12,
            skills: ['frac-multiply', 'frac-equivalent'],
            keyPoints: [
              'Multiply tops together and bottoms together: 2/3 × 4/5 = 8/15.',
              '"of" means multiply: 1/2 of 3/4 = 3/8.',
              'A whole number is a fraction over 1: 3 × 2/5 = 6/5.',
              'Cancel common factors before multiplying to keep numbers small.',
            ],
            contentMd: `## The rule

\`\`\`
a/b × c/d = (a × c) / (b × d)
2/3 × 4/5 = 8/15
\`\`\`

## "Of" means multiply

Half **of** three-quarters of a cake: 1/2 × 3/4 = 3/8.

## Whole numbers

3 × 2/5 = 3/1 × 2/5 = 6/5 = 1 1/5.

## Cancel first (cross-simplify)

\`\`\`
4/9 × 3/8
4 and 8 share factor 4 → 1/9 × 3/2
3 and 9 share factor 3 → 1/3 × 1/2 = 1/6
\`\`\`

## Why does multiplying make it smaller?

Multiplying by a fraction less than 1 takes a *part* of a quantity, so 1/2 × 10 = 5 — smaller than 10.`,
            tutor: {
              simpler:
                'Multiplying fractions is the easy one: top times top, bottom times bottom. 1/2 × 1/2 = 1/4 — half of a half is a quarter.',
              example:
                'A recipe needs 3/4 cup of sugar. You make 2/3 of the recipe. Sugar needed = 2/3 × 3/4 = 6/12 = 1/2 cup.',
              misconceptions: [
                'You do NOT need a common denominator to multiply.',
                'Multiplying by a proper fraction makes the result smaller, not bigger.',
              ],
              glossary: g({
                'proper fraction': 'A fraction less than 1 (numerator smaller than denominator).',
                cancel: 'Divide a numerator and a denominator by a common factor before multiplying.',
              }),
            },
          },
        ],
      },
      {
        id: 'mod-decimals',
        title: 'Decimals',
        description: 'Tenths, hundredths and the link between fractions and decimals.',
        lessons: [
          {
            id: 'les-dec-intro',
            title: 'Introduction to Decimals',
            summary: 'Decimals are another way of writing fractions with denominators 10, 100, 1000. The decimal point separates whole numbers from parts.',
            durationMin: 10,
            skills: ['dec-basics'],
            keyPoints: [
              '0.1 = 1/10 (one tenth), 0.01 = 1/100 (one hundredth).',
              'Place values after the point: tenths, hundredths, thousandths.',
              '₹1.50 means 1 rupee and 50 paise (50/100 of a rupee).',
              'Adding zeros at the end does not change a decimal: 0.5 = 0.50.',
            ],
            contentMd: `## Place value after the point

| Hundreds | Tens | Ones | . | Tenths | Hundredths |
|---|---|---|---|---|---|
| 1 | 2 | 3 | . | 4 | 5 |

123.45 = 100 + 20 + 3 + 4/10 + 5/100

## Decimals in daily life

- Money: ₹12.75 = 12 rupees 75 paise
- Length: 1.5 m = 1 metre 50 centimetres
- Weight: 2.250 kg = 2 kg 250 g

## Comparing decimals

Line up the decimal points: 0.7 vs 0.65 → 0.70 vs 0.65 → **0.7 is bigger**.

## Number line

Between 0 and 1 there are ten equal steps of 0.1. Between 0.1 and 0.2 there are ten steps of 0.01.`,
            tutor: {
              simpler:
                'A decimal is just money! ₹0.50 is half a rupee, ₹0.25 is a quarter. The digits after the point are pieces of one whole rupee.',
              example: 'Write 3 rupees and 5 paise as a decimal: 5 paise = 5/100 = 0.05, so it is ₹3.05 (not ₹3.5!).',
              misconceptions: [
                '0.65 is NOT bigger than 0.7 — compare place by place.',
                '3.5 and 3.05 are different numbers.',
              ],
              glossary: g({
                tenth: 'One of ten equal parts — written 0.1 or 1/10.',
                hundredth: 'One of a hundred equal parts — written 0.01 or 1/100.',
                'decimal point': 'The dot that separates whole numbers from parts of a whole.',
              }),
            },
          },
          {
            id: 'les-frac-dec',
            title: 'Fractions and Decimals',
            summary: 'Convert fractions to decimals by making the denominator 10 or 100, or by dividing. Convert decimals to fractions using place value.',
            durationMin: 12,
            skills: ['frac-dec-convert', 'dec-basics'],
            keyPoints: [
              '1/2 = 5/10 = 0.5, 1/4 = 25/100 = 0.25, 3/4 = 0.75.',
              'Decimal → fraction: 0.6 = 6/10 = 3/5.',
              'Fraction → decimal: divide numerator by denominator.',
              'Some fractions give repeating decimals: 1/3 = 0.333…',
            ],
            contentMd: `## Fraction → decimal

**Method 1: make the denominator 10, 100 or 1000**

\`\`\`
3/5 = 6/10 = 0.6
7/20 = 35/100 = 0.35
\`\`\`

**Method 2: divide**

3 ÷ 8 = 0.375, so 3/8 = 0.375.

## Decimal → fraction

Read the place value, then simplify:

\`\`\`
0.75 = 75/100 = 3/4
0.4 = 4/10 = 2/5
2.5 = 25/10 = 5/2 = 2 1/2
\`\`\`

## Useful pairs to remember

| Fraction | Decimal |
|---|---|
| 1/2 | 0.5 |
| 1/4 | 0.25 |
| 3/4 | 0.75 |
| 1/5 | 0.2 |
| 1/10 | 0.1 |
| 1/3 | 0.333… |`,
            tutor: {
              simpler:
                'Decimals and fractions are two languages for the same idea. 0.5 and 1/2 both mean "half". To translate, ask: how many tenths or hundredths is this?',
              example: 'Convert 2/5 to a decimal: multiply top and bottom by 2 → 4/10 → 0.4.',
              misconceptions: ['1/4 is 0.25, not 0.4.', '0.3 is 3/10, not 1/3.'],
              glossary: g({
                'repeating decimal': 'A decimal whose digits repeat forever, like 0.333…',
                'terminating decimal': 'A decimal that ends, like 0.75.',
              }),
            },
          },
        ],
      },
    ],
  },
  {
    id: 'course-sci6-light',
    subjectId: 'science',
    title: 'Light, Shadows & Reflection',
    description: 'Explore where light comes from, how shadows form and how mirrors reflect light.',
    grade: 6,
    level: 'foundation',
    estimatedHours: 2.5,
    color: '#16a34a',
    modules: [
      {
        id: 'mod-light-sources',
        title: 'Sources of Light',
        description: 'Objects that give out light and how materials let light through.',
        lessons: [
          {
            id: 'les-light-luminous',
            title: 'Luminous and Non-luminous Objects',
            summary: 'Objects that emit their own light are luminous (the Sun, a candle). Objects we see because they reflect light are non-luminous (the Moon, a book).',
            durationMin: 8,
            skills: ['light-sources'],
            keyPoints: [
              'Luminous objects produce their own light: Sun, stars, bulb, firefly.',
              'Non-luminous objects do not produce light: Moon, table, mirror.',
              'We see non-luminous objects because light bounces off them into our eyes.',
              'The Moon shines by reflecting sunlight.',
            ],
            contentMd: `## Why can we see things?

We see an object when light coming from it enters our eyes. Light either comes **from** the object itself, or **bounces off** it.

## Luminous objects

Objects that give out their own light: the **Sun**, other stars, a burning candle, an electric bulb, a torch, a **firefly**.

## Non-luminous objects

Objects that do not give out light: the **Moon**, a book, a chair, you and me. We see them only when light from a luminous source falls on them and is reflected into our eyes.

> In a completely dark room you cannot see a book — there is no light to bounce off it.

## The Moon

The Moon looks bright at night but it is **non-luminous**: it reflects light from the Sun.

## Activity

Switch off the lights in a room at night. Wait a minute. Can you see anything? Now light a candle — what changes?`,
            tutor: {
              simpler:
                'Luminous things are like torches — they make their own light. Non-luminous things are like a mirror or a wall — they only show light that hits them.',
              example:
                'A television screen is luminous because it emits light. The remote control is non-luminous — you see it because room light bounces off it.',
              misconceptions: [
                'The Moon is not luminous — it reflects sunlight.',
                'A shiny object like a mirror is still non-luminous.',
              ],
              glossary: g({
                luminous: 'Gives out its own light.',
                'non-luminous': 'Does not give out light; seen by reflected light.',
                reflect: 'To bounce light back from a surface.',
              }),
            },
          },
          {
            id: 'les-light-transparency',
            title: 'Transparent, Translucent and Opaque',
            summary: 'Materials are grouped by how much light passes through them: transparent (all), translucent (some), opaque (none).',
            durationMin: 8,
            skills: ['light-transparency'],
            keyPoints: [
              'Transparent: light passes through clearly — glass, clean water, air.',
              'Translucent: light passes partly, objects look blurry — butter paper, frosted glass.',
              'Opaque: no light passes — wood, stone, metal, cardboard.',
              'Only opaque and translucent objects form noticeable shadows.',
            ],
            contentMd: `## Three groups

| Type | How much light passes | Can you see through it? | Examples |
|---|---|---|---|
| Transparent | Almost all | Clearly | Clear glass, water, air |
| Translucent | Some | Blurry | Butter paper, oiled paper, frosted glass |
| Opaque | None | No | Wood, brick, metal sheet, your hand |

## A quick test

Hold the material in front of a lit torch:

- See the bulb clearly → **transparent**
- See only a glow → **translucent**
- See nothing → **opaque**

## Why it matters

Windows are transparent so we get light and a view. Bathroom windows are often translucent for light **and** privacy. Walls are opaque to keep rooms private and shaded.`,
            tutor: {
              simpler:
                'Transparent = see-through like clear water. Translucent = light comes through but blurry, like a plastic bag. Opaque = blocks everything, like a wall.',
              example: 'Sunglasses are usually translucent-ish tinted glass: light gets through but less of it. A wooden door is opaque.',
              misconceptions: ['Coloured glass can still be transparent.', 'Thin paper is translucent, not transparent.'],
              glossary: g({
                transparent: 'Lets almost all light through so objects are seen clearly.',
                translucent: 'Lets some light through; objects appear blurred.',
                opaque: 'Does not let light through.',
              }),
            },
          },
        ],
      },
      {
        id: 'mod-shadows',
        title: 'Shadows',
        description: 'How shadows form and what a pinhole camera shows us about light.',
        lessons: [
          {
            id: 'les-shadows',
            title: 'How Shadows Form',
            summary: 'A shadow forms when an opaque object blocks light. You need a light source, an opaque object and a screen.',
            durationMin: 10,
            skills: ['shadows', 'light-transparency'],
            keyPoints: [
              'Three things are needed: a source of light, an opaque object, and a screen.',
              'Shadows are always dark, whatever the colour of the object.',
              'The shape of a shadow depends on the outline of the object and the direction of light.',
              'Moving the object closer to the source makes the shadow bigger.',
            ],
            contentMd: `## Recipe for a shadow

1. A **source of light** (Sun, torch)
2. An **opaque object** (your hand)
3. A **screen** to catch the shadow (wall, ground)

Light travels in straight lines. Where the object blocks the light, a dark region — the **shadow** — appears on the screen.

## What shadows tell us

- A shadow shows the **outline** of the object, not its colour or details. A red ball and a blue ball give the same black shadow.
- A round plate can cast a circular or an oval shadow depending on how it is held.

## Changing the size

Bring your hand closer to the torch and the shadow on the wall **grows**. Move it away and the shadow **shrinks**.

## Shadows during the day

In the morning and evening the Sun is low, so shadows are **long**. At noon the Sun is overhead, so shadows are **short**.`,
            tutor: {
              simpler:
                'A shadow is the "dark hole" left in the light where something is in the way. No light source, no shadow. No object, no shadow. No wall or ground to catch it, no shadow to see.',
              example:
                'In a shadow-puppet show, hands held near the lamp make huge animals on the sheet; held near the sheet they make small, sharp animals.',
              misconceptions: [
                'Shadows are not the object\'s reflection — they show no colour.',
                'A transparent glass hardly forms a shadow.',
              ],
              glossary: g({
                shadow: 'A dark area formed when an opaque object blocks light.',
                screen: 'Any surface on which a shadow or image is formed.',
              }),
            },
          },
          {
            id: 'les-pinhole',
            title: 'The Pinhole Camera',
            summary: 'A pinhole camera forms an upside-down image because light travels in straight lines through the tiny hole.',
            durationMin: 10,
            skills: ['pinhole', 'shadows'],
            keyPoints: [
              'Light travels in straight lines (rectilinear propagation).',
              'A pinhole camera forms a real, inverted (upside-down) image.',
              'A smaller hole gives a sharper but dimmer image.',
              'The circular patches under a tree are pinhole images of the Sun.',
            ],
            contentMd: `## Building one

Take two boxes, one sliding inside the other. Make a tiny **pinhole** in the outer box and fit tracing paper on the inner box as a screen. Point it at a bright, distant object.

## Why is the image upside down?

Light from the **top** of the object travels straight through the hole and lands at the **bottom** of the screen. Light from the bottom lands at the top. Straight-line travel flips the image.

## Size of the hole

- Tiny hole → sharp but dim image
- Big hole → bright but blurry image (overlapping images)

## Nature's pinhole camera

Under a leafy tree, the small gaps between leaves act as pinholes. The bright round patches on the ground are **images of the Sun** — during a partial solar eclipse they become crescents!`,
            tutor: {
              simpler:
                'Imagine throwing balls in straight lines through a small window. Balls thrown from a high spot land low on the far wall; balls from a low spot land high. Light does the same, so the picture flips.',
              example: 'Point a pinhole camera at a candle flame — the flame appears on the screen pointing downwards.',
              misconceptions: ['The image is inverted, not mirrored left-to-right only.', 'A bigger hole does not make a better image.'],
              glossary: g({
                'rectilinear propagation': 'Light travels in straight lines.',
                'inverted image': 'An upside-down image.',
              }),
            },
          },
        ],
      },
      {
        id: 'mod-reflection',
        title: 'Reflection',
        description: 'Mirrors and how light bounces back.',
        lessons: [
          {
            id: 'les-reflection',
            title: 'Mirrors and Reflection',
            summary: 'Light bouncing back from a surface is reflection. A plane mirror forms an image that is upright, the same size, and laterally inverted.',
            durationMin: 10,
            skills: ['reflection', 'light-sources'],
            keyPoints: [
              'Reflection is light bouncing off a surface.',
              'Smooth, shiny surfaces (mirrors, still water) give clear images.',
              'A plane mirror image is upright, same size, and left-right reversed.',
              'The image appears as far behind the mirror as the object is in front.',
            ],
            contentMd: `## What is reflection?

When light hits a surface and **bounces back**, we call it reflection. Every object reflects some light — that is how we see non-luminous things.

## Mirrors

A **plane mirror** is flat and very smooth, so it reflects light in an orderly way and forms a clear **image**.

Properties of a plane-mirror image:

- Upright
- Same size as the object
- **Laterally inverted** — your right hand appears as the image's left hand
- As far behind the mirror as you are in front

## Regular vs diffuse reflection

Still water and mirrors give **regular** reflection (clear image). Rough surfaces like paper scatter light in all directions — **diffuse** reflection — so no image forms.

## Uses

Periscopes use two mirrors to see over walls; rear-view mirrors help drivers; solar cookers use mirrors to focus sunlight.`,
            tutor: {
              simpler:
                'Throw a ball at a smooth wall and it bounces back neatly. Throw it at a rocky wall and it goes anywhere. Light does the same — smooth mirror = clear image, rough paper = no image.',
              example: 'Write "AMBULANCE" reversed on the front of an ambulance so drivers ahead read it correctly in their rear-view mirror — that is lateral inversion in action.',
              misconceptions: ['A mirror does not make its own light.', 'The image is not behind the mirror physically — it only appears to be.'],
              glossary: g({
                reflection: 'The bouncing back of light from a surface.',
                'lateral inversion': 'Left–right reversal of an image in a plane mirror.',
                'plane mirror': 'A flat mirror.',
              }),
            },
          },
        ],
      },
    ],
  },
  {
    id: 'course-cs-python',
    subjectId: 'cs',
    title: 'Introduction to Programming with Python',
    description: 'Learn to think like a programmer: variables, decisions, loops and functions, with code you can run in the AIESES IDE.',
    grade: 8,
    level: 'foundation',
    estimatedHours: 4,
    color: '#7c3aed',
    modules: [
      {
        id: 'mod-py-start',
        title: 'Getting Started',
        description: 'What programs are and how to store information.',
        lessons: [
          {
            id: 'les-py-what',
            title: 'What is Programming?',
            summary: 'A program is a precise list of instructions a computer follows. Python is a beginner-friendly language for writing them.',
            durationMin: 8,
            skills: ['prog-basics'],
            keyPoints: [
              'Computers follow instructions exactly, in order.',
              'A programming language is how humans write those instructions.',
              'print() shows output on the screen.',
              'Bugs are mistakes in programs; fixing them is debugging.',
            ],
            contentMd: `## Instructions, exactly

Tell a friend "make tea" and they fill in the details. A computer cannot — it needs every step: boil water, add leaves, wait 3 minutes… A **program** is that precise list of steps.

## Your first Python program

\`\`\`python
print("Namaste, AIESES!")
\`\`\`

\`print()\` is a **function** that shows text on the screen. The text inside quotes is a **string**.

## Order matters

\`\`\`python
print("Step 1: Boil water")
print("Step 2: Add tea leaves")
print("Step 3: Pour and enjoy")
\`\`\`

Python runs lines from top to bottom.

## Bugs

If you type \`prnt("hi")\` Python will complain: \`NameError: name 'prnt' is not defined\`. Reading error messages carefully is a superpower.

> Try it: open the **IDE** from your workspace, choose Python, and run the program above.`,
            tutor: {
              simpler:
                'A program is a recipe for a very obedient but very literal cook. Write every step clearly and in order, and the computer will do exactly that.',
              example: 'print("2 + 2 =", 2 + 2) prints "2 + 2 = 4" — text in quotes is shown as-is, while 2 + 2 is calculated.',
              misconceptions: ['Computers are not smart — they only follow instructions.', 'Spelling and capitalisation matter: Print is not print.'],
              glossary: g({
                program: 'A list of instructions for a computer.',
                syntax: 'The rules for writing valid code.',
                bug: 'A mistake in a program.',
              }),
            },
          },
          {
            id: 'les-py-variables',
            title: 'Variables and Data Types',
            summary: 'Variables store values under a name. Python has numbers (int, float), text (str) and booleans (bool).',
            durationMin: 12,
            skills: ['py-variables', 'prog-basics'],
            keyPoints: [
              'name = value creates a variable.',
              'int (5), float (2.5), str ("hi"), bool (True/False).',
              'type(x) tells you the data type.',
              'input() reads text from the user; use int() to convert.',
            ],
            contentMd: `## Naming a value

\`\`\`python
age = 13
name = "Aarav"
height = 1.52
is_student = True
\`\`\`

The **variable** on the left stores the **value** on the right. You can use it later:

\`\`\`python
print(name, "is", age, "years old")
\`\`\`

## Data types

| Type | Example | Used for |
|---|---|---|
| int | 42 | whole numbers |
| float | 3.14 | decimals |
| str | "hello" | text |
| bool | True | yes/no |

## Changing a variable

\`\`\`python
score = 10
score = score + 5   # score is now 15
\`\`\`

## Reading input

\`\`\`python
marks = int(input("Enter marks: "))
print("Percentage:", marks / 50 * 100)
\`\`\`

\`input()\` always gives a string, so we wrap it in \`int()\` to do maths.`,
            tutor: {
              simpler:
                'A variable is a labelled box. age = 13 puts 13 in a box labelled "age". Later you can look inside the box or replace what is in it.',
              example: 'price = 20 and qty = 3 → total = price * qty stores 60. print(total) shows 60.',
              misconceptions: ['"5" (a string) is not the same as 5 (an int) — "5" + "5" is "55".', 'Variable names cannot start with a digit or contain spaces.'],
              glossary: g({
                variable: 'A named place to store a value.',
                string: 'A piece of text inside quotes.',
                integer: 'A whole number.',
              }),
            },
          },
        ],
      },
      {
        id: 'mod-py-flow',
        title: 'Control Flow',
        description: 'Making decisions and repeating actions.',
        lessons: [
          {
            id: 'les-py-conditionals',
            title: 'Making Decisions with if / else',
            summary: 'Conditionals let a program choose between paths using comparisons like >, <, == and logical operators and/or/not.',
            durationMin: 12,
            skills: ['py-conditionals', 'py-variables'],
            keyPoints: [
              'if condition: runs a block only when the condition is True.',
              'elif and else give alternatives.',
              'Indentation (4 spaces) defines the block.',
              '== compares; = assigns.',
            ],
            contentMd: `## if / elif / else

\`\`\`python
marks = 72
if marks >= 90:
    print("Grade A")
elif marks >= 60:
    print("Grade B")
else:
    print("Keep practising")
\`\`\`

Python checks the conditions **from top to bottom** and runs the first block that is True.

## Comparison operators

\`==\` equal, \`!=\` not equal, \`>\` \`<\` \`>=\` \`<=\`

## Combining conditions

\`\`\`python
age = 14
has_ticket = True
if age >= 12 and has_ticket:
    print("Welcome to the show")
\`\`\`

## Indentation

The indented lines belong to the if. Un-indented lines run regardless:

\`\`\`python
if marks < 35:
    print("Please meet your teacher")
print("Result published")   # always runs
\`\`\``,
            tutor: {
              simpler:
                'if is like a gate: if the condition is true the gate opens and the indented code runs; otherwise Python skips it and tries elif or else.',
              example: 'temp = 38. if temp > 37.5: print("Fever") else: print("Normal") → prints Fever.',
              misconceptions: ['Using = instead of == inside an if is a syntax error.', 'Only the FIRST true branch runs in an if/elif chain.'],
              glossary: g({
                condition: 'An expression that is True or False.',
                indentation: 'The spaces at the start of a line that group code into blocks.',
              }),
            },
          },
          {
            id: 'les-py-loops',
            title: 'Repeating with Loops',
            summary: 'for loops repeat over a range or a list; while loops repeat as long as a condition stays True.',
            durationMin: 14,
            skills: ['py-loops', 'py-conditionals'],
            keyPoints: [
              'for i in range(5): repeats 5 times with i = 0,1,2,3,4.',
              'for item in list: visits every item.',
              'while condition: repeats until the condition becomes False.',
              'Accumulators (total += x) build up results inside loops.',
            ],
            contentMd: `## for loops

\`\`\`python
for i in range(1, 6):
    print(i, "x 7 =", i * 7)
\`\`\`

\`range(1, 6)\` gives 1, 2, 3, 4, 5 (the end value is not included).

Looping over a list:

\`\`\`python
fruits = ["mango", "banana", "guava"]
for fruit in fruits:
    print("I like", fruit)
\`\`\`

## while loops

\`\`\`python
count = 3
while count > 0:
    print(count)
    count = count - 1
print("Go!")
\`\`\`

Make sure something inside the loop changes the condition, or the loop never ends!

## Accumulator pattern

\`\`\`python
total = 0
for n in [4, 8, 15, 16]:
    total += n
print("Sum:", total)   # 43
\`\`\``,
            tutor: {
              simpler:
                'A for loop is "do this for each item". A while loop is "keep doing this while something is still true". Both save you from copy-pasting the same line many times.',
              example: 'for i in range(3): print("Hip") prints Hip three times. range(3) means 0, 1, 2.',
              misconceptions: ['range(5) stops at 4, not 5.', 'A while loop whose condition never becomes False runs forever.'],
              glossary: g({
                iteration: 'One pass through the body of a loop.',
                range: 'A built-in that produces a sequence of numbers.',
                'infinite loop': 'A loop that never stops because its condition stays True.',
              }),
            },
          },
        ],
      },
      {
        id: 'mod-py-functions',
        title: 'Functions',
        description: 'Reusable blocks of code.',
        lessons: [
          {
            id: 'les-py-functions',
            title: 'Writing Functions',
            summary: 'Functions package code under a name so it can be reused. They take parameters and can return a value.',
            durationMin: 14,
            skills: ['py-functions', 'py-variables'],
            keyPoints: [
              'def name(parameters): defines a function.',
              'Call it with name(arguments).',
              'return sends a value back to the caller.',
              'Functions make programs shorter and easier to fix.',
            ],
            contentMd: `## Defining and calling

\`\`\`python
def greet(name):
    print("Hello,", name)

greet("Priya")
greet("Rahul")
\`\`\`

## Returning values

\`\`\`python
def area_of_rectangle(length, width):
    return length * width

a = area_of_rectangle(5, 3)
print(a)   # 15
\`\`\`

## Why functions?

- **Reuse** — write once, call many times.
- **Readability** — \`calculate_average(marks)\` explains itself.
- **Debugging** — fix a bug in one place.

## Default parameters

\`\`\`python
def power(base, exponent=2):
    return base ** exponent

print(power(4))      # 16
print(power(2, 5))   # 32
\`\`\``,
            tutor: {
              simpler:
                'A function is a machine with a name. You put values in (parameters), it does its job, and it may hand a result back (return).',
              example: 'def is_even(n): return n % 2 == 0 → is_even(10) gives True, is_even(7) gives False.',
              misconceptions: ['A function does nothing until it is called.', 'print() shows a value; return gives it back — they are different.'],
              glossary: g({
                parameter: 'A variable listed in the function definition.',
                argument: 'The actual value passed when calling the function.',
                return: 'Send a value back from a function.',
              }),
            },
          },
        ],
      },
    ],
  },
  {
    id: 'course-cs-js',
    subjectId: 'cs',
    title: 'Web Coding Basics with JavaScript',
    description: 'JavaScript is the language of the web. Learn variables, functions and arrays with code that runs safely in your browser.',
    grade: 8,
    level: 'intermediate',
    estimatedHours: 2,
    color: '#ea580c',
    modules: [
      {
        id: 'mod-js-start',
        title: 'JavaScript Fundamentals',
        description: 'Variables, console output, functions and arrays.',
        lessons: [
          {
            id: 'les-js-basics',
            title: 'JavaScript Variables and console.log',
            summary: 'Use let and const to declare variables and console.log() to print output.',
            durationMin: 10,
            skills: ['js-basics', 'prog-basics'],
            keyPoints: [
              'const for values that never change, let for values that do.',
              'console.log() prints to the console.',
              'Template strings use backticks: `Hi ${name}`.',
              'Statements usually end with a semicolon.',
            ],
            contentMd: `## Declaring variables

\`\`\`javascript
const school = "Kendriya Vidyalaya";
let students = 40;
students = students + 2;
console.log(school, "has", students, "students");
\`\`\`

## Types

Numbers (\`42\`, \`3.5\`), strings (\`"text"\`), booleans (\`true\`/\`false\`).

## Template strings

\`\`\`javascript
const name = "Aarav";
console.log(\`Welcome, \${name}!\`);
\`\`\`

## Arithmetic

\`\`\`javascript
console.log(7 + 3);   // 10
console.log(7 / 2);   // 3.5
console.log(7 % 2);   // 1  (remainder)
\`\`\`

> Run these in the AIESES IDE — JavaScript runs inside a browser sandbox (Web Worker), completely isolated from the server.`,
            tutor: {
              simpler: 'let makes a box you can refill; const makes a box that is sealed once filled. console.log() is how JavaScript talks to you.',
              example: 'const price = 50; let qty = 2; console.log(`Total: ₹${price * qty}`); prints Total: ₹100.',
              misconceptions: ['You cannot reassign a const.', '"5" + 5 in JavaScript gives "55", not 10.'],
              glossary: g({
                console: 'The place where console.log() output appears.',
                'template string': 'A string in backticks that can embed ${expressions}.',
              }),
            },
          },
          {
            id: 'les-js-functions',
            title: 'Functions and Arrays',
            summary: 'Functions group reusable code; arrays store ordered lists that you can loop over and transform with map and filter.',
            durationMin: 14,
            skills: ['js-functions', 'js-basics'],
            keyPoints: [
              'function add(a, b) { return a + b; }',
              'Arrow functions: const add = (a, b) => a + b;',
              'Arrays: const marks = [78, 92, 65]; marks.length is 3.',
              'map transforms, filter selects, reduce combines.',
            ],
            contentMd: `## Functions

\`\`\`javascript
function square(n) {
  return n * n;
}
const cube = (n) => n * n * n;
console.log(square(4), cube(2));   // 16 8
\`\`\`

## Arrays

\`\`\`javascript
const marks = [78, 92, 65, 88];
console.log(marks[0]);        // 78
console.log(marks.length);    // 4
marks.push(70);
\`\`\`

## Looping

\`\`\`javascript
for (const m of marks) {
  console.log(m);
}
\`\`\`

## map / filter / reduce

\`\`\`javascript
const doubled = marks.map((m) => m * 2);
const passed = marks.filter((m) => m >= 70);
const total = marks.reduce((sum, m) => sum + m, 0);
console.log(doubled, passed, total);
\`\`\``,
            tutor: {
              simpler: 'An array is a numbered shelf of values starting at position 0. A function is a named recipe you can call with different ingredients.',
              example: 'const names = ["Asha", "Ravi"]; names.map((n) => n.toUpperCase()) gives ["ASHA", "RAVI"].',
              misconceptions: ['Array positions start at 0, so marks[1] is the SECOND item.', 'map returns a new array; it does not change the original.'],
              glossary: g({
                array: 'An ordered list of values.',
                'arrow function': 'A short way to write a function: (a) => a + 1.',
                callback: 'A function passed to another function, e.g. to map.',
              }),
            },
          },
        ],
      },
    ],
  },
];

export const questions: SeedQuestion[] = [
  // --- Fraction basics
  { id: 'q-fb-1', lessonId: 'les-frac-what', skillId: 'frac-basics', prompt: 'In the fraction 3/8, which number is the denominator?', options: ['3', '8', '11', '24'], answer: 1, explanation: 'The denominator is the bottom number: it shows the whole is divided into 8 equal parts.', difficulty: 1 },
  { id: 'q-fb-2', lessonId: 'les-frac-what', skillId: 'frac-basics', prompt: 'A pizza is cut into 6 equal slices and Riya eats 2. What fraction of the pizza did she eat?', options: ['2/6', '6/2', '2/4', '4/6'], answer: 0, explanation: '2 slices taken out of 6 equal slices is 2/6 (which simplifies to 1/3).', difficulty: 1 },
  { id: 'q-fb-3', lessonId: 'les-frac-what', skillId: 'frac-basics', prompt: 'Which fraction represents one whole?', options: ['1/4', '4/4', '4/1', '0/4'], answer: 1, explanation: 'When numerator equals denominator, all parts are taken — 4/4 = 1 whole.', difficulty: 2 },
  { id: 'q-fb-4', lessonId: 'les-frac-what', skillId: 'frac-basics', prompt: '15 minutes is what fraction of an hour?', options: ['1/2', '1/3', '1/4', '1/15'], answer: 2, explanation: 'An hour has 60 minutes; 15/60 = 1/4.', difficulty: 2 },
  // --- Equivalent fractions
  { id: 'q-fe-1', lessonId: 'les-frac-equivalent', skillId: 'frac-equivalent', prompt: 'Which fraction is equivalent to 1/2?', options: ['2/3', '3/6', '2/5', '1/4'], answer: 1, explanation: 'Multiply numerator and denominator of 1/2 by 3: 3/6.', difficulty: 1 },
  { id: 'q-fe-2', lessonId: 'les-frac-equivalent', skillId: 'frac-equivalent', prompt: 'Write 12/16 in simplest form.', options: ['6/8', '3/4', '4/3', '2/3'], answer: 1, explanation: 'Divide both by their common factor 4: 12 ÷ 4 = 3 and 16 ÷ 4 = 4 → 3/4.', difficulty: 2 },
  { id: 'q-fe-3', lessonId: 'les-frac-equivalent', skillId: 'frac-equivalent', prompt: 'Fill in the blank: 2/5 = ?/20', options: ['4', '8', '10', '17'], answer: 1, explanation: '5 × 4 = 20, so multiply the numerator by 4 too: 2 × 4 = 8.', difficulty: 2 },
  { id: 'q-fe-4', lessonId: 'les-frac-equivalent', skillId: 'frac-equivalent', prompt: 'Which pair of fractions is NOT equivalent?', options: ['2/3 and 4/6', '3/4 and 9/12', '1/2 and 2/3', '5/10 and 1/2'], answer: 2, explanation: 'Cross-multiply 1/2 and 2/3: 1 × 3 = 3 but 2 × 2 = 4. Not equal. (Adding 1 to top and bottom is not allowed.)', difficulty: 3 },
  { id: 'q-fe-5', lessonId: 'les-frac-equivalent', skillId: 'frac-equivalent', prompt: 'Which of these is the simplest form of 18/24?', options: ['9/12', '6/8', '3/4', '2/3'], answer: 2, explanation: 'HCF of 18 and 24 is 6; 18 ÷ 6 = 3, 24 ÷ 6 = 4 → 3/4.', difficulty: 3 },
  // --- Comparing
  { id: 'q-fc-1', lessonId: 'les-frac-compare', skillId: 'frac-compare', prompt: 'Which is larger: 5/8 or 3/8?', options: ['5/8', '3/8', 'They are equal', 'Cannot compare'], answer: 0, explanation: 'Same denominator → compare numerators: 5 > 3.', difficulty: 1 },
  { id: 'q-fc-2', lessonId: 'les-frac-compare', skillId: 'frac-compare', prompt: 'Which is larger: 2/3 or 2/5?', options: ['2/5', '2/3', 'They are equal', 'Cannot compare'], answer: 1, explanation: 'Same numerator → the smaller denominator (thirds) gives bigger pieces.', difficulty: 1 },
  { id: 'q-fc-3', lessonId: 'les-frac-compare', skillId: 'frac-compare', prompt: 'Compare 3/4 and 5/6.', options: ['3/4 > 5/6', '3/4 < 5/6', '3/4 = 5/6', 'Cannot compare'], answer: 1, explanation: 'LCM 12: 3/4 = 9/12 and 5/6 = 10/12, so 5/6 is larger.', difficulty: 2 },
  { id: 'q-fc-4', lessonId: 'les-frac-compare', skillId: 'frac-compare', prompt: 'Arrange in ascending order: 1/2, 2/3, 3/5', options: ['1/2, 2/3, 3/5', '1/2, 3/5, 2/3', '3/5, 1/2, 2/3', '2/3, 3/5, 1/2'], answer: 1, explanation: 'With denominator 30: 15/30, 20/30, 18/30 → 1/2 < 3/5 < 2/3.', difficulty: 3 },
  // --- Add/sub
  { id: 'q-fa-1', lessonId: 'les-frac-add', skillId: 'frac-add-sub', prompt: '2/7 + 3/7 = ?', options: ['5/14', '5/7', '6/7', '1/7'], answer: 1, explanation: 'Like fractions: add numerators, keep the denominator → 5/7.', difficulty: 1 },
  { id: 'q-fa-2', lessonId: 'les-frac-add', skillId: 'frac-add-sub', prompt: '1/4 + 1/6 = ?', options: ['2/10', '1/5', '5/12', '2/24'], answer: 2, explanation: 'LCM of 4 and 6 is 12: 3/12 + 2/12 = 5/12.', difficulty: 2 },
  { id: 'q-fa-3', lessonId: 'les-frac-add', skillId: 'frac-add-sub', prompt: '5/6 − 1/4 = ?', options: ['4/2', '7/12', '4/24', '1/2'], answer: 1, explanation: '10/12 − 3/12 = 7/12.', difficulty: 2 },
  { id: 'q-fa-4', lessonId: 'les-frac-add', skillId: 'frac-add-sub', prompt: 'Ravi walked 3/4 km and then 1/2 km. How far did he walk in total?', options: ['4/6 km', '1 1/4 km', '3/8 km', '1 km'], answer: 1, explanation: '3/4 + 2/4 = 5/4 = 1 1/4 km.', difficulty: 3 },
  // --- Multiply
  { id: 'q-fm-1', lessonId: 'les-frac-multiply', skillId: 'frac-multiply', prompt: '2/3 × 4/5 = ?', options: ['6/8', '8/15', '6/15', '8/8'], answer: 1, explanation: 'Multiply tops (2×4=8) and bottoms (3×5=15).', difficulty: 1 },
  { id: 'q-fm-2', lessonId: 'les-frac-multiply', skillId: 'frac-multiply', prompt: 'What is 1/2 of 3/4?', options: ['3/8', '4/6', '1 1/4', '3/4'], answer: 0, explanation: '"Of" means multiply: 1/2 × 3/4 = 3/8.', difficulty: 2 },
  { id: 'q-fm-3', lessonId: 'les-frac-multiply', skillId: 'frac-multiply', prompt: '3 × 2/5 = ?', options: ['6/15', '5/5', '6/5', '2/15'], answer: 2, explanation: '3/1 × 2/5 = 6/5 = 1 1/5.', difficulty: 2 },
  // --- Decimals
  { id: 'q-db-1', lessonId: 'les-dec-intro', skillId: 'dec-basics', prompt: 'What is the value of the digit 4 in 12.34?', options: ['4 tens', '4 ones', '4 tenths', '4 hundredths'], answer: 3, explanation: 'The second digit after the point is the hundredths place.', difficulty: 1 },
  { id: 'q-db-2', lessonId: 'les-dec-intro', skillId: 'dec-basics', prompt: 'Which is greater: 0.7 or 0.65?', options: ['0.65', '0.7', 'They are equal', 'Cannot compare'], answer: 1, explanation: '0.7 = 0.70 > 0.65.', difficulty: 2 },
  { id: 'q-db-3', lessonId: 'les-dec-intro', skillId: 'dec-basics', prompt: '3 rupees and 5 paise written as a decimal is:', options: ['₹3.5', '₹3.05', '₹3.50', '₹35'], answer: 1, explanation: '5 paise = 5/100 = 0.05, so ₹3.05.', difficulty: 2 },
  // --- Fraction-decimal conversion
  { id: 'q-fd-1', lessonId: 'les-frac-dec', skillId: 'frac-dec-convert', prompt: '3/4 as a decimal is:', options: ['0.34', '0.75', '0.43', '0.25'], answer: 1, explanation: '3/4 = 75/100 = 0.75.', difficulty: 1 },
  { id: 'q-fd-2', lessonId: 'les-frac-dec', skillId: 'frac-dec-convert', prompt: '0.6 as a fraction in simplest form is:', options: ['6/10', '3/5', '1/6', '6/100'], answer: 1, explanation: '0.6 = 6/10 = 3/5.', difficulty: 2 },
  { id: 'q-fd-3', lessonId: 'les-frac-dec', skillId: 'frac-dec-convert', prompt: '2/5 as a decimal is:', options: ['0.25', '0.2', '0.4', '2.5'], answer: 2, explanation: '2/5 = 4/10 = 0.4.', difficulty: 2 },
  // --- Science: luminous
  { id: 'q-ls-1', lessonId: 'les-light-luminous', skillId: 'light-sources', prompt: 'Which of these is a luminous object?', options: ['The Moon', 'A mirror', 'A firefly', 'A book'], answer: 2, explanation: 'A firefly produces its own light. The Moon and mirror only reflect light.', difficulty: 1 },
  { id: 'q-ls-2', lessonId: 'les-light-luminous', skillId: 'light-sources', prompt: 'Why can we see the Moon at night?', options: ['It burns like the Sun', 'It reflects sunlight', 'It is made of glowing rock', 'Stars light it from inside'], answer: 1, explanation: 'The Moon is non-luminous; it reflects light from the Sun.', difficulty: 2 },
  { id: 'q-ls-3', lessonId: 'les-light-luminous', skillId: 'light-sources', prompt: 'We can see a non-luminous object only when…', options: ['it is very large', 'light from it enters our eyes after reflection', 'it is close to us', 'it is painted white'], answer: 1, explanation: 'Light from a luminous source bounces off the object into our eyes.', difficulty: 2 },
  // --- Transparency
  { id: 'q-lt-1', lessonId: 'les-light-transparency', skillId: 'light-transparency', prompt: 'Butter paper is an example of a(n) ___ material.', options: ['transparent', 'translucent', 'opaque', 'luminous'], answer: 1, explanation: 'Some light passes through butter paper but objects look blurred → translucent.', difficulty: 1 },
  { id: 'q-lt-2', lessonId: 'les-light-transparency', skillId: 'light-transparency', prompt: 'Which object lets almost all light pass through?', options: ['Wooden door', 'Clear glass', 'Cardboard', 'Frosted glass'], answer: 1, explanation: 'Clear glass is transparent.', difficulty: 1 },
  { id: 'q-lt-3', lessonId: 'les-light-transparency', skillId: 'light-transparency', prompt: 'Which material forms the darkest shadow?', options: ['Clear plastic sheet', 'Oiled paper', 'Metal sheet', 'Clean water'], answer: 2, explanation: 'Opaque materials block all light and form the darkest shadows.', difficulty: 2 },
  // --- Shadows
  { id: 'q-sh-1', lessonId: 'les-shadows', skillId: 'shadows', prompt: 'Which is NOT needed to form a shadow?', options: ['A source of light', 'An opaque object', 'A screen', 'A mirror'], answer: 3, explanation: 'Shadows need a light source, an opaque object and a screen. A mirror is not required.', difficulty: 1 },
  { id: 'q-sh-2', lessonId: 'les-shadows', skillId: 'shadows', prompt: 'A red ball and a blue ball of the same size are held in the same way in front of a torch. Their shadows are:', options: ['red and blue', 'both black and the same shape', 'different shapes', 'invisible'], answer: 1, explanation: 'Shadows show only the outline, never the colour.', difficulty: 2 },
  { id: 'q-sh-3', lessonId: 'les-shadows', skillId: 'shadows', prompt: 'When is your shadow shortest on a sunny day?', options: ['Early morning', 'Noon', 'Evening', 'Midnight'], answer: 1, explanation: 'At noon the Sun is nearly overhead, so shadows are shortest.', difficulty: 2 },
  // --- Pinhole
  { id: 'q-ph-1', lessonId: 'les-pinhole', skillId: 'pinhole', prompt: 'The image formed by a pinhole camera is:', options: ['upright and same size', 'inverted', 'always larger', 'coloured differently'], answer: 1, explanation: 'Because light travels in straight lines through the hole, the image is upside down.', difficulty: 1 },
  { id: 'q-ph-2', lessonId: 'les-pinhole', skillId: 'pinhole', prompt: 'A pinhole camera works because light…', options: ['travels in straight lines', 'bends around corners', 'is absorbed by paper', 'is always white'], answer: 0, explanation: 'Rectilinear propagation of light explains the inverted image.', difficulty: 2 },
  { id: 'q-ph-3', lessonId: 'les-pinhole', skillId: 'pinhole', prompt: 'Making the pinhole larger will make the image:', options: ['sharper and dimmer', 'brighter but blurrier', 'upright', 'disappear'], answer: 1, explanation: 'A larger hole lets in more light (brighter) but overlapping images blur it.', difficulty: 3 },
  // --- Reflection
  { id: 'q-rf-1', lessonId: 'les-reflection', skillId: 'reflection', prompt: 'The image in a plane mirror is:', options: ['inverted top to bottom', 'laterally inverted', 'smaller than the object', 'always blurred'], answer: 1, explanation: 'A plane mirror swaps left and right (lateral inversion).', difficulty: 1 },
  { id: 'q-rf-2', lessonId: 'les-reflection', skillId: 'reflection', prompt: 'Which surface gives the clearest reflection?', options: ['Rough paper', 'A wooden board', 'Still water', 'A brick wall'], answer: 2, explanation: 'Smooth surfaces give regular reflection and clear images.', difficulty: 1 },
  { id: 'q-rf-3', lessonId: 'les-reflection', skillId: 'reflection', prompt: 'You stand 2 m in front of a plane mirror. How far behind the mirror does your image appear?', options: ['1 m', '2 m', '4 m', '0 m'], answer: 1, explanation: 'The image is as far behind the mirror as the object is in front.', difficulty: 2 },
  // --- CS: programming basics
  { id: 'q-pb-1', lessonId: 'les-py-what', skillId: 'prog-basics', prompt: 'What does print("Hello") do in Python?', options: ['Prints on paper', 'Shows Hello on the screen', 'Saves Hello to a file', 'Nothing'], answer: 1, explanation: 'print() displays output on the screen (console).', difficulty: 1 },
  { id: 'q-pb-2', lessonId: 'les-py-what', skillId: 'prog-basics', prompt: 'A mistake in a program is called a…', options: ['virus', 'bug', 'loop', 'variable'], answer: 1, explanation: 'Errors in programs are called bugs; fixing them is debugging.', difficulty: 1 },
  { id: 'q-pb-3', lessonId: 'les-py-what', skillId: 'prog-basics', prompt: 'In what order does Python normally run the lines of a program?', options: ['Bottom to top', 'Random order', 'Top to bottom', 'Longest line first'], answer: 2, explanation: 'Statements execute sequentially from top to bottom.', difficulty: 1 },
  // --- Variables
  { id: 'q-pv-1', lessonId: 'les-py-variables', skillId: 'py-variables', prompt: 'What is the data type of the value 3.14?', options: ['int', 'float', 'str', 'bool'], answer: 1, explanation: 'Numbers with a decimal point are floats.', difficulty: 1 },
  { id: 'q-pv-2', lessonId: 'les-py-variables', skillId: 'py-variables', prompt: 'After running: score = 10 followed by score = score + 5, what is score?', options: ['10', '5', '15', 'score + 5'], answer: 2, explanation: 'The right side is calculated first (15) and stored back in score.', difficulty: 2 },
  { id: 'q-pv-3', lessonId: 'les-py-variables', skillId: 'py-variables', prompt: 'What does "5" + "5" give in Python?', options: ['10', '"55"', 'an error', '25'], answer: 1, explanation: 'Both values are strings, so + joins them into "55".', difficulty: 3 },
  // --- Conditionals
  { id: 'q-pc-1', lessonId: 'les-py-conditionals', skillId: 'py-conditionals', prompt: 'Which operator checks whether two values are equal?', options: ['=', '==', '!=', '=>'], answer: 1, explanation: '== compares; a single = assigns a value.', difficulty: 1 },
  { id: 'q-pc-2', lessonId: 'les-py-conditionals', skillId: 'py-conditionals', prompt: 'marks = 72. Which line prints? if marks >= 90: print("A") elif marks >= 60: print("B") else: print("C")', options: ['A', 'B', 'C', 'Nothing'], answer: 1, explanation: '72 is not ≥ 90 but is ≥ 60, so the elif branch prints B.', difficulty: 2 },
  { id: 'q-pc-3', lessonId: 'les-py-conditionals', skillId: 'py-conditionals', prompt: 'How does Python know which lines belong to an if block?', options: ['Curly braces', 'Indentation', 'Semicolons', 'Capital letters'], answer: 1, explanation: 'Python uses indentation (usually 4 spaces) to group blocks.', difficulty: 1 },
  // --- Loops
  { id: 'q-pl-1', lessonId: 'les-py-loops', skillId: 'py-loops', prompt: 'How many times does for i in range(5): run?', options: ['4', '5', '6', 'Forever'], answer: 1, explanation: 'range(5) produces 0,1,2,3,4 — five values.', difficulty: 1 },
  { id: 'q-pl-2', lessonId: 'les-py-loops', skillId: 'py-loops', prompt: 'What is printed? total = 0; for n in [4, 8, 15]: total += n; print(total)', options: ['15', '27', '0', '4815'], answer: 1, explanation: '4 + 8 + 15 = 27.', difficulty: 2 },
  { id: 'q-pl-3', lessonId: 'les-py-loops', skillId: 'py-loops', prompt: 'A while loop whose condition never becomes False will…', options: ['run once', 'run forever', 'give a syntax error', 'skip its body'], answer: 1, explanation: 'This is an infinite loop — something inside must change the condition.', difficulty: 2 },
  // --- Functions
  { id: 'q-pf-1', lessonId: 'les-py-functions', skillId: 'py-functions', prompt: 'Which keyword defines a function in Python?', options: ['func', 'define', 'def', 'function'], answer: 2, explanation: 'Python uses def name(parameters):', difficulty: 1 },
  { id: 'q-pf-2', lessonId: 'les-py-functions', skillId: 'py-functions', prompt: 'def area(l, w): return l * w — what does area(5, 3) give?', options: ['8', '15', '53', 'None'], answer: 1, explanation: 'return sends back 5 × 3 = 15.', difficulty: 2 },
  { id: 'q-pf-3', lessonId: 'les-py-functions', skillId: 'py-functions', prompt: 'What is the difference between print and return inside a function?', options: ['No difference', 'print shows a value; return sends it back to the caller', 'return shows a value; print sends it back', 'print only works outside functions'], answer: 1, explanation: 'print displays; return hands the value back so it can be stored or reused.', difficulty: 3 },
  // --- JS basics
  { id: 'q-jb-1', lessonId: 'les-js-basics', skillId: 'js-basics', prompt: 'Which keyword declares a variable that cannot be reassigned?', options: ['let', 'var', 'const', 'static'], answer: 2, explanation: 'const creates a constant binding.', difficulty: 1 },
  { id: 'q-jb-2', lessonId: 'les-js-basics', skillId: 'js-basics', prompt: 'What does console.log(7 % 2) print?', options: ['3.5', '1', '3', '0'], answer: 1, explanation: '% gives the remainder: 7 ÷ 2 = 3 remainder 1.', difficulty: 2 },
  { id: 'q-jb-3', lessonId: 'les-js-basics', skillId: 'js-basics', prompt: 'What does `Hi ${name}` do when name = "Asha"?', options: ['Prints Hi ${name}', 'Gives "Hi Asha"', 'Causes an error', 'Gives "Hi name"'], answer: 1, explanation: 'Template strings in backticks embed expressions with ${}.', difficulty: 2 },
  // --- JS functions/arrays
  { id: 'q-jf-1', lessonId: 'les-js-functions', skillId: 'js-functions', prompt: 'const marks = [78, 92, 65]; What is marks[1]?', options: ['78', '92', '65', 'undefined'], answer: 1, explanation: 'Array indexes start at 0, so index 1 is the second item, 92.', difficulty: 1 },
  { id: 'q-jf-2', lessonId: 'les-js-functions', skillId: 'js-functions', prompt: 'Which array method creates a new array with only the items that pass a test?', options: ['map', 'filter', 'reduce', 'push'], answer: 1, explanation: 'filter selects; map transforms; reduce combines.', difficulty: 2 },
  { id: 'q-jf-3', lessonId: 'les-js-functions', skillId: 'js-functions', prompt: 'What does [1, 2, 3].map((n) => n * 2) return?', options: ['[1, 2, 3]', '[2, 4, 6]', '12', '6'], answer: 1, explanation: 'map applies the function to each item and returns a new array.', difficulty: 2 },
];

export const resources: SeedResource[] = [
  { id: 'res-frac-visual', title: 'Visual Fractions: Fraction Bars & Circles', type: 'interactive', url: 'https://www.geogebra.org/m/Nc2h6TSv', source: 'GeoGebra (open resource)', subjectId: 'math', skillId: 'frac-basics', language: 'en', description: 'Drag and compare fraction bars to see numerator and denominator in action.', durationMin: 10 },
  { id: 'res-frac-equiv-video', title: 'Equivalent Fractions Explained (Video)', type: 'video', url: 'https://www.khanacademy.org/math/cc-third-grade-math/imp-fractions/imp-equivalent-fractions/v/equivalent-fractions', source: 'Khan Academy (open resource)', subjectId: 'math', skillId: 'frac-equivalent', language: 'en', description: 'Short video on why multiplying top and bottom by the same number keeps a fraction equal.', durationMin: 6 },
  { id: 'res-frac-equiv-practice', title: 'Equivalent Fractions – Worked Examples (Article)', type: 'article', url: 'https://ncert.nic.in/textbook.php?femh1=7-14', source: 'NCERT Class 6 Mathematics, Chapter 7 (open textbook)', subjectId: 'math', skillId: 'frac-equivalent', language: 'en', description: 'Textbook explanation with exercises on equivalent fractions and simplest form.', durationMin: 15 },
  { id: 'res-frac-compare', title: 'Comparing Fractions with a Number Line', type: 'interactive', url: 'https://www.geogebra.org/m/uXnDnqQV', source: 'GeoGebra (open resource)', subjectId: 'math', skillId: 'frac-compare', language: 'en', description: 'Place fractions on a number line and compare them visually.', durationMin: 8 },
  { id: 'res-frac-add', title: 'Adding Fractions with Unlike Denominators', type: 'video', url: 'https://www.khanacademy.org/math/arithmetic/x18ca194a:add-and-subtract-fractions-different-denominators', source: 'Khan Academy (open resource)', subjectId: 'math', skillId: 'frac-add-sub', language: 'en', description: 'Step-by-step LCM method for adding unlike fractions.', durationMin: 9 },
  { id: 'res-frac-mult', title: 'Multiplying Fractions – Area Model', type: 'interactive', url: 'https://www.geogebra.org/m/fS9sVkMe', source: 'GeoGebra (open resource)', subjectId: 'math', skillId: 'frac-multiply', language: 'en', description: 'See why 1/2 × 3/4 = 3/8 using an area model.', durationMin: 8 },
  { id: 'res-dec-place', title: 'Decimal Place Value Chart', type: 'article', url: 'https://ncert.nic.in/textbook.php?femh1=8-14', source: 'NCERT Class 6 Mathematics, Chapter 8 (open textbook)', subjectId: 'math', skillId: 'dec-basics', language: 'en', description: 'Tenths and hundredths explained with money and measurement examples.', durationMin: 12 },
  { id: 'res-frac-dec', title: 'Fractions to Decimals Converter Practice', type: 'interactive', url: 'https://www.khanacademy.org/math/arithmetic/x18ca194a:decimals/x18ca194a:rewriting-fractions-as-decimals', source: 'Khan Academy (open resource)', subjectId: 'math', skillId: 'frac-dec-convert', language: 'en', description: 'Practice converting common fractions to decimals.', durationMin: 10 },
  { id: 'res-light-sources', title: 'Light, Shadows and Reflections – NCERT Chapter', type: 'article', url: 'https://ncert.nic.in/textbook.php?fesc1=11-16', source: 'NCERT Class 6 Science, Chapter 11 (open textbook)', subjectId: 'science', skillId: 'light-sources', language: 'en', description: 'The complete chapter: luminous objects, transparency, shadows, pinhole camera and mirrors.', durationMin: 25 },
  { id: 'res-shadows-video', title: 'How Shadows Form (Video)', type: 'video', url: 'https://www.youtube.com/results?search_query=how+shadows+form+class+6', source: 'Open video search (demo link)', subjectId: 'science', skillId: 'shadows', language: 'en', description: 'Demonstration of shadow formation with torch and objects.', durationMin: 5 },
  { id: 'res-pinhole-diy', title: 'Build Your Own Pinhole Camera', type: 'pdf', url: 'https://ncert.nic.in/textbook.php?fesc1=11-16', source: 'NCERT activity (open textbook)', subjectId: 'science', skillId: 'pinhole', language: 'en', description: 'Step-by-step activity sheet to build and test a pinhole camera.', durationMin: 20 },
  { id: 'res-reflection-sim', title: 'Plane Mirror Reflection Simulator', type: 'interactive', url: 'https://phet.colorado.edu/en/simulations/geometric-optics', source: 'PhET Interactive Simulations (open resource)', subjectId: 'science', skillId: 'reflection', language: 'en', description: 'Explore how images form with mirrors and lenses.', durationMin: 12 },
  { id: 'res-py-tutorial', title: 'Python for Beginners – Official Tutorial', type: 'article', url: 'https://docs.python.org/3/tutorial/introduction.html', source: 'python.org (open documentation)', subjectId: 'cs', skillId: 'py-variables', language: 'en', description: 'Numbers, strings and first steps in the official Python tutorial.', durationMin: 20 },
  { id: 'res-py-loops', title: 'Loops in Python – Interactive Exercises', type: 'interactive', url: 'https://docs.python.org/3/tutorial/controlflow.html', source: 'python.org (open documentation)', subjectId: 'cs', skillId: 'py-loops', language: 'en', description: 'for, range and while explained with runnable examples.', durationMin: 15 },
  { id: 'res-py-functions', title: 'Defining Functions', type: 'article', url: 'https://docs.python.org/3/tutorial/controlflow.html#defining-functions', source: 'python.org (open documentation)', subjectId: 'cs', skillId: 'py-functions', language: 'en', description: 'The official guide to def, parameters and return.', durationMin: 15 },
  { id: 'res-js-mdn', title: 'JavaScript First Steps', type: 'article', url: 'https://developer.mozilla.org/en-US/docs/Learn/JavaScript/First_steps', source: 'MDN Web Docs (open documentation)', subjectId: 'cs', skillId: 'js-basics', language: 'en', description: 'Variables, numbers, strings and your first lines of JavaScript.', durationMin: 25 },
  { id: 'res-js-arrays', title: 'Array Methods: map, filter, reduce', type: 'article', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array', source: 'MDN Web Docs (open documentation)', subjectId: 'cs', skillId: 'js-functions', language: 'en', description: 'Reference and examples for the most useful array methods.', durationMin: 20 },
  { id: 'res-frac-hi', title: 'भिन्न – कक्षा 6 गणित (हिन्दी)', type: 'article', url: 'https://ncert.nic.in/textbook.php?fhmh1=7-14', source: 'NCERT कक्षा 6 गणित, अध्याय 7 (open textbook)', subjectId: 'math', skillId: 'frac-basics', language: 'hi', description: 'भिन्न की अवधारणा हिन्दी माध्यम पाठ्यपुस्तक से।', durationMin: 15 },
];

export const translations: SeedTranslation[] = [
  {
    lessonId: 'les-frac-what',
    language: 'hi',
    title: 'भिन्न क्या है?',
    summary: 'भिन्न किसी पूरी वस्तु के बराबर भागों में से कुछ भागों को दर्शाती है। ऊपर की संख्या अंश और नीचे की संख्या हर कहलाती है।',
    keyPoints: [
      'भिन्न = अंश / हर',
      'हर बताता है कि पूरे को कितने बराबर भागों में बाँटा गया है।',
      'अंश बताता है कि उनमें से कितने भाग लिए गए हैं।',
      '3/4 का अर्थ है चार बराबर भागों में से तीन भाग।',
    ],
    contentMd: `## पूरे के भाग

कल्पना कीजिए कि एक रोटी को **4 बराबर टुकड़ों** में काटा गया है। यदि आप 3 टुकड़े खाते हैं, तो आपने रोटी का **3/4** भाग खाया।

- **अंश** (ऊपर की संख्या): कितने भाग लिए गए → 3
- **हर** (नीचे की संख्या): कुल कितने बराबर भाग → 4

> भाग **बराबर** होने चाहिए। रोटी को 4 असमान टुकड़ों में काटने से चौथाई नहीं बनती!

## भिन्न पढ़ना

| भिन्न | हम कहते हैं | अर्थ |
|---|---|---|
| 1/2 | आधा | 2 बराबर भागों में से 1 |
| 1/4 | चौथाई | 4 बराबर भागों में से 1 |
| 2/3 | दो तिहाई | 3 बराबर भागों में से 2 |

## याद रखें

हर कभी शून्य नहीं हो सकता, क्योंकि किसी वस्तु को शून्य भागों में नहीं बाँटा जा सकता। 15 मिनट एक घंटे का 1/4 है!`,
  },
  {
    lessonId: 'les-frac-what',
    language: 'ta',
    title: 'பின்னம் என்றால் என்ன?',
    summary: 'ஒரு முழுப் பொருளைச் சம பாகங்களாகப் பிரித்தால், அவற்றில் சில பாகங்களைக் குறிப்பதே பின்னம். மேலே உள்ள எண் தொகுதி, கீழே உள்ள எண் பகுதி.',
    keyPoints: [
      'பின்னம் = தொகுதி / பகுதி',
      'பகுதி: முழுப் பொருள் எத்தனை சம பாகங்களாகப் பிரிக்கப்பட்டது என்பதைக் குறிக்கிறது.',
      'தொகுதி: அவற்றில் எத்தனை பாகங்கள் எடுக்கப்பட்டன என்பதைக் குறிக்கிறது.',
      '3/4 என்பது நான்கு சம பாகங்களில் மூன்று பாகங்கள்.',
    ],
    contentMd: `## முழுமையின் பாகங்கள்

ஒரு ரொட்டியை **4 சம துண்டுகளாக** வெட்டுவதாகக் கற்பனை செய்யுங்கள். நீங்கள் 3 துண்டுகளைச் சாப்பிட்டால், ரொட்டியின் **3/4** பகுதியைச் சாப்பிட்டீர்கள்.

- **தொகுதி** (மேலே உள்ள எண்): எத்தனை பாகங்கள் எடுக்கப்பட்டன → 3
- **பகுதி** (கீழே உள்ள எண்): மொத்தம் எத்தனை சம பாகங்கள் → 4

> பாகங்கள் **சமமாக** இருக்க வேண்டும்!

## பின்னங்களைப் படித்தல்

| பின்னம் | நாம் சொல்வது | பொருள் |
|---|---|---|
| 1/2 | பாதி | 2 சம பாகங்களில் 1 |
| 1/4 | கால் | 4 சம பாகங்களில் 1 |
| 2/3 | மூன்றில் இரண்டு | 3 சம பாகங்களில் 2 |

## நினைவில் கொள்ளுங்கள்

பகுதி ஒருபோதும் பூஜ்ஜியமாக இருக்க முடியாது. 15 நிமிடங்கள் என்பது ஒரு மணி நேரத்தின் 1/4!`,
  },
  {
    lessonId: 'les-frac-equivalent',
    language: 'hi',
    title: 'तुल्य भिन्न',
    summary: 'अलग-अलग दिखने वाली भिन्नें एक ही मात्रा दर्शा सकती हैं। अंश और हर को एक ही संख्या से गुणा या भाग करके तुल्य भिन्न बनती है।',
    keyPoints: [
      'तुल्य भिन्नों का मान समान होता है: 1/2 = 2/4 = 4/8',
      'अंश और हर दोनों को एक ही संख्या से गुणा (या भाग) करें।',
      'जब अंश और हर में 1 के अलावा कोई उभयनिष्ठ गुणनखंड न हो, तो भिन्न सरलतम रूप में होती है।',
      'वज्र-गुणन से जाँच करें: 2/3 = 4/6 क्योंकि 2×6 = 3×4',
    ],
    contentMd: `## एक ही मात्रा, अलग-अलग नाम

आधी रोटी उतनी ही रहती है चाहे उसे **1/2**, **2/4** या **4/8** कहें। ये **तुल्य भिन्नें** हैं।

## तुल्य भिन्न कैसे बनाएँ

अंश **और** हर को एक ही संख्या से गुणा करें:

\`\`\`
1/2 × 2/2 = 2/4
1/2 × 3/3 = 3/6
\`\`\`

दोनों को एक ही संख्या से भाग देना **सरलीकरण** कहलाता है:

\`\`\`
6/8 ÷ 2/2 = 3/4
\`\`\`

## सरलतम रूप

12/16 → दोनों को 4 से भाग दें → **3/4**

> **सामान्य गलती:** अंश और हर में एक ही संख्या जोड़ने से तुल्य भिन्न नहीं बनती। 1/2 ≠ 2/3`,
  },
  {
    lessonId: 'les-frac-equivalent',
    language: 'ta',
    title: 'சமான பின்னங்கள்',
    summary: 'வெவ்வேறாகத் தோன்றும் பின்னங்கள் ஒரே அளவைக் குறிக்கலாம். தொகுதி மற்றும் பகுதியை ஒரே எண்ணால் பெருக்கினாலோ வகுத்தாலோ சமான பின்னம் கிடைக்கும்.',
    keyPoints: [
      'சமான பின்னங்களின் மதிப்பு ஒன்றே: 1/2 = 2/4 = 4/8',
      'தொகுதி மற்றும் பகுதி இரண்டையும் ஒரே எண்ணால் பெருக்கவும் (அல்லது வகுக்கவும்).',
      'தொகுதிக்கும் பகுதிக்கும் 1 தவிர பொதுக் காரணி இல்லாதபோது பின்னம் எளிய வடிவில் உள்ளது.',
      'குறுக்குப் பெருக்கலால் சரிபார்க்கலாம்: 2/3 = 4/6 ஏனெனில் 2×6 = 3×4',
    ],
    contentMd: `## ஒரே அளவு, வெவ்வேறு பெயர்கள்

பாதி ரொட்டியை **1/2**, **2/4** அல்லது **4/8** என்று அழைத்தாலும் அளவு ஒன்றே. இவை **சமான பின்னங்கள்**.

## சமான பின்னங்களை உருவாக்குதல்

தொகுதி **மற்றும்** பகுதியை ஒரே எண்ணால் பெருக்கவும்:

\`\`\`
1/2 × 2/2 = 2/4
1/2 × 3/3 = 3/6
\`\`\`

இரண்டையும் ஒரே எண்ணால் வகுப்பது **சுருக்குதல்** எனப்படும்:

\`\`\`
6/8 ÷ 2/2 = 3/4
\`\`\`

## எளிய வடிவம்

12/16 → இரண்டையும் 4 ஆல் வகுக்கவும் → **3/4**

> **பொதுவான தவறு:** தொகுதி மற்றும் பகுதியுடன் ஒரே எண்ணைக் கூட்டினால் சமான பின்னம் கிடைக்காது. 1/2 ≠ 2/3`,
  },
  {
    lessonId: 'les-light-luminous',
    language: 'hi',
    title: 'दीप्त और अदीप्त वस्तुएँ',
    summary: 'जो वस्तुएँ स्वयं प्रकाश उत्सर्जित करती हैं, वे दीप्त कहलाती हैं (सूर्य, मोमबत्ती)। जिन्हें हम परावर्तित प्रकाश से देखते हैं, वे अदीप्त हैं (चंद्रमा, पुस्तक)।',
    keyPoints: [
      'दीप्त वस्तुएँ अपना प्रकाश स्वयं उत्पन्न करती हैं: सूर्य, तारे, बल्ब, जुगनू।',
      'अदीप्त वस्तुएँ प्रकाश उत्पन्न नहीं करतीं: चंद्रमा, मेज़, दर्पण।',
      'अदीप्त वस्तुएँ हमें तब दिखती हैं जब प्रकाश उनसे टकराकर हमारी आँखों तक पहुँचता है।',
      'चंद्रमा सूर्य के प्रकाश को परावर्तित करके चमकता है।',
    ],
    contentMd: `## हम वस्तुओं को क्यों देख पाते हैं?

हम किसी वस्तु को तब देखते हैं जब उससे आने वाला प्रकाश हमारी आँखों में प्रवेश करता है। प्रकाश या तो वस्तु **से** आता है या उससे **टकराकर** आता है।

## दीप्त वस्तुएँ

जो अपना प्रकाश स्वयं देती हैं: **सूर्य**, तारे, जलती मोमबत्ती, बिजली का बल्ब, टॉर्च, **जुगनू**।

## अदीप्त वस्तुएँ

जो प्रकाश नहीं देतीं: **चंद्रमा**, पुस्तक, कुर्सी, आप और मैं। इन्हें हम तभी देखते हैं जब किसी दीप्त स्रोत का प्रकाश इन पर पड़कर परावर्तित होता है।

> पूरी तरह अँधेरे कमरे में आप पुस्तक नहीं देख सकते — वहाँ परावर्तित होने के लिए प्रकाश ही नहीं है।

## चंद्रमा

चंद्रमा रात में चमकता दिखता है, पर वह **अदीप्त** है: वह सूर्य के प्रकाश को परावर्तित करता है।`,
  },
  {
    lessonId: 'les-light-luminous',
    language: 'ta',
    title: 'ஒளிரும் மற்றும் ஒளிராப் பொருள்கள்',
    summary: 'தாமாகவே ஒளியை வெளியிடும் பொருள்கள் ஒளிரும் பொருள்கள் (சூரியன், மெழுகுவர்த்தி). எதிரொளிக்கும் ஒளியால் நாம் காணும் பொருள்கள் ஒளிராப் பொருள்கள் (நிலா, புத்தகம்).',
    keyPoints: [
      'ஒளிரும் பொருள்கள் தாமாகவே ஒளியை உருவாக்குகின்றன: சூரியன், விண்மீன்கள், மின்விளக்கு, மின்மினிப் பூச்சி.',
      'ஒளிராப் பொருள்கள் ஒளியை உருவாக்குவதில்லை: நிலா, மேசை, கண்ணாடி.',
      'ஒளி அவற்றின் மீது பட்டு எதிரொளித்து நம் கண்களை அடைவதால் ஒளிராப் பொருள்களை நாம் காண்கிறோம்.',
      'நிலா சூரிய ஒளியை எதிரொளிப்பதால் ஒளிர்கிறது.',
    ],
    contentMd: `## நாம் ஏன் பொருள்களைப் பார்க்க முடிகிறது?

ஒரு பொருளிலிருந்து வரும் ஒளி நம் கண்களுக்குள் நுழையும்போது அதை நாம் பார்க்கிறோம். ஒளி பொருளிலிருந்தே **வரலாம்** அல்லது அதன் மீது பட்டு **எதிரொளிக்கலாம்**.

## ஒளிரும் பொருள்கள்

தாமாகவே ஒளியைத் தருபவை: **சூரியன்**, விண்மீன்கள், எரியும் மெழுகுவர்த்தி, மின்விளக்கு, டார்ச், **மின்மினிப் பூச்சி**.

## ஒளிராப் பொருள்கள்

ஒளியைத் தராதவை: **நிலா**, புத்தகம், நாற்காலி, நீங்களும் நானும். ஒளிரும் மூலத்திலிருந்து வரும் ஒளி இவற்றின் மீது பட்டு எதிரொளிக்கும்போது மட்டுமே இவற்றை நாம் காண்கிறோம்.

> முழு இருட்டான அறையில் புத்தகத்தைப் பார்க்க முடியாது — எதிரொளிக்க ஒளியே இல்லை.

## நிலா

நிலா இரவில் பிரகாசமாகத் தெரிந்தாலும் அது **ஒளிராப் பொருள்**: அது சூரிய ஒளியை எதிரொளிக்கிறது.`,
  },
];

/** Course-level quizzes assembled from lesson questions (id → question ids). */
export const courseQuizzes: { id: string; courseId: string; title: string; description: string; questionIds: string[]; timeLimitMin: number }[] = [
  {
    id: 'quiz-fractions-checkpoint',
    courseId: 'course-math6-fractions',
    title: 'Fractions Checkpoint Quiz',
    description: 'Covers fraction basics, equivalent fractions, comparing and adding fractions.',
    questionIds: ['q-fb-2', 'q-fe-1', 'q-fe-2', 'q-fe-4', 'q-fc-3', 'q-fa-2', 'q-fm-2', 'q-fd-1'],
    timeLimitMin: 15,
  },
  {
    id: 'quiz-light-checkpoint',
    courseId: 'course-sci6-light',
    title: 'Light & Shadows Checkpoint Quiz',
    description: 'Luminous objects, transparency, shadows, pinhole camera and reflection.',
    questionIds: ['q-ls-1', 'q-ls-2', 'q-lt-1', 'q-sh-1', 'q-sh-2', 'q-ph-1', 'q-rf-1', 'q-rf-3'],
    timeLimitMin: 12,
  },
  {
    id: 'quiz-python-checkpoint',
    courseId: 'course-cs-python',
    title: 'Python Fundamentals Quiz',
    description: 'Variables, conditionals, loops and functions.',
    questionIds: ['q-pb-1', 'q-pv-1', 'q-pv-3', 'q-pc-2', 'q-pl-1', 'q-pl-2', 'q-pf-2', 'q-pf-3'],
    timeLimitMin: 12,
  },
];
