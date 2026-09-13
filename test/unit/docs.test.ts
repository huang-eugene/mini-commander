/**
 * The grown-ups guide exists in two places: the TypeScript the CLI prints,
 * and a markdown copy for anyone reading the repo on GitHub. Two copies of
 * anything drift, so this test is what stops them.
 *
 * The TypeScript is the source of truth, because `mini-commander grown-ups`
 * has to work whether or not the docs folder was installed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';

import { GROWN_UP_GUIDE } from '../../src/grown-ups.js';

test('the published grown-ups guide matches the one the CLI prints', async () => {
  const markdown = await fs.readFile('docs/for-grown-ups.md', 'utf8');

  // Every non-trivial line of the guide must appear in the markdown. Run
  // `npm run docs` if this fails.
  const lines = GROWN_UP_GUIDE.split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 20 && !l.includes('{{HOME}}'));

  const missing = lines.filter((l) => !markdown.includes(l));

  assert.deepEqual(
    missing.slice(0, 3),
    [],
    `docs/for-grown-ups.md is out of date — run: npm run docs`,
  );
});

test('the guide says the three things that matter, in the child’s favour', async () => {
  // These are the specific instructions the brief is most emphatic about and
  // that an adult is most likely to ignore. If the guide ever stops saying
  // them, it has stopped being useful.
  const guide = GROWN_UP_GUIDE.toLowerCase();

  assert.match(guide, /let's see what the computer says/i);
  assert.match(guide, /i don't know/i);
  assert.match(guide, /don't take the keyboard/i);
  assert.match(guide, /stop while they still want more/i);
  assert.match(guide, /can i try something/i);
});
