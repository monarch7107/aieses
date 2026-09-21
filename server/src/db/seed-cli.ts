import { migrate } from './index.js';
import { seed } from './seed.js';

migrate();
const force = process.argv.includes('--force');
const out = seed({ force });
console.log(out.seeded ? '[seed] database seeded with synthetic demo data' : '[seed] already seeded (use --force to reset)');
