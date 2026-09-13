// Generates docs/for-grown-ups.md from the guide the CLI prints.
//
// The TypeScript is the single source of truth, because that is what a
// grown-up actually sees when they type `mini-commander grown-ups` and it
// must work without the docs folder being installed. This script keeps the
// GitHub-readable copy in step, and a test asserts it has not drifted.
import { writeFileSync } from 'node:fs';
import { GROWN_UP_GUIDE } from '../build/src/grown-ups.js';

const body = GROWN_UP_GUIDE.replace('{{HOME}}', '~/.mini-commander')
  .replace(/^\s*FOR GROWN-UPS\s*\n=+\n/, '')
  .trim();

writeFileSync(
  'docs/for-grown-ups.md',
  `# For grown-ups\n\n<!-- Generated from src/grown-ups.ts by scripts/build-docs.mjs. -->\n<!-- Edit the TypeScript, then run: npm run docs -->\n\n\`\`\`\n${body}\n\`\`\`\n`,
);

console.log('docs/for-grown-ups.md written');
