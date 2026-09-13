/**
 * The child keeps what they did.
 *
 * save.ts is explicit that losing a seven-year-old's badges is the one bug
 * this project cannot recover from socially, and it goes to real trouble about
 * it: atomic writes, a .bak, a corrupt save renamed aside rather than deleted.
 *
 * Two holes in that, both fixed here and both tested from the outside:
 * loadSave threw on a save shape it was supposed to recover from, and
 * runSession wrote the save exactly once at the very end, so any unexpected
 * throw before that point cost the whole sitting.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as nodePath from 'node:path';

import { loadSave, freshSave, writeSave } from '../../src/engine/save.js';
import { makeTempHome, play } from '../harness/session.js';

test('a save that is valid JSON but the wrong shape is recovered, not thrown on', async () => {
  const home = await makeTempHome('mc-save-');

  // The decay loop used to run on whatever the file said `concepts` was, and
  // Object.keys(null) throws — from outside every guard in the function.
  const shapes = [
    { version: 1, concepts: null },
    { version: 1, concepts: 'not an object' },
    { version: 1, concepts: 42 },
    { version: 1 },
    {},
  ];

  for (const shape of shapes) {
    await fs.writeFile(nodePath.join(home, 'save.json'), JSON.stringify(shape), 'utf8');
    const save = await loadSave(home);
    assert.equal(typeof save.concepts, 'object', `concepts unusable for ${JSON.stringify(shape)}`);
    assert.equal(save.version, 1);
  }
});

test('a save that is not JSON at all is moved aside and a fresh one started', async () => {
  const home = await makeTempHome('mc-save-');
  await fs.writeFile(nodePath.join(home, 'save.json'), 'not json {{{', 'utf8');

  const save = await loadSave(home);
  assert.equal(save.sessionIndex, 0, 'a fresh save');

  const names = await fs.readdir(home);
  assert.ok(
    names.some((n) => n.startsWith('save.json.broken-')),
    `the unreadable save must be kept for a grown-up to look at, got: ${names.join(', ')}`,
  );
});

test('a crash mid-session still banks the progress', async () => {
  const home = await makeTempHome('mc-save-');

  // Something deep in the stack throws a plain Error, the way decodeTolerantly
  // could from inside a step's done(). Before the fix this lost the whole
  // sitting: no save.json and no journal.md at all.
  const played = play({
    inputs: ['1', 'echo hello', 'echo Explorer', ''],
    home,
    breakAfterChips: 6,
  });

  await assert.rejects(() => played, /deliberate test crash/);

  const names = await fs.readdir(home);
  assert.ok(
    names.includes('save.json'),
    `save.json must survive a crash, got: ${names.join(', ')}`,
  );
  assert.ok(names.includes('journal.md'), 'the journal must survive a crash too');

  const reloaded = await loadSave(home);
  assert.equal(reloaded.sessionIndex, 1, 'the session must be counted');
  assert.ok(
    reloaded.sessions.at(-1)?.notes.some((n) => n.includes('hit a problem')),
    "the grown-up's journal should record that it stopped early",
  );
});

test('the save written after a crash is loadable', async () => {
  // Banking after a crash is only worth anything if the file is intact.
  const home = await makeTempHome('mc-save-');
  const original = freshSave();
  original.stage = 4;
  original.badges = [{ id: 'explorer', earnedAt: 'now', missionId: 'm01-hello-explorer' }];
  await writeSave(home, original);

  const reloaded = await loadSave(home);
  assert.equal(reloaded.stage, 4);
  assert.equal(reloaded.badges.length, 1, 'badges are the thing that must never be lost');
});
