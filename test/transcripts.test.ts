/**
 * Golden transcripts.
 *
 * These record what a child actually sees. They exist because the most
 * important qualities of this game — CHIP's tone, whether a prediction gets
 * asked, whether an error is handed back as a question instead of being
 * explained away — are not assertable as values. They are prose, and the only
 * way to review prose changes is to read the diff.
 *
 * Re-record with: npm run test:update
 * Then READ the diff. A transcript change that looks worse is a failing test
 * even when the suite is green.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeTempHome, matchGolden, play, scrubHome } from './harness/session.js';
import { freshSave } from '../src/engine/save.js';
import { freshConceptState } from '../src/engine/learner.js';

async function check(name: string, inputs: string[], save?: ReturnType<typeof freshSave>) {
  const played = await play(save ? { inputs, save } : { inputs });
  try {
    const outcome = await matchGolden(name, played.transcript, played.home);

    assert.ok(
      outcome.ok,
      outcome.expected === undefined
        ? `No golden for "${name}" yet. Run npm run test:update, then read the diff.\n\n` +
            outcome.actual
        : `The transcript for "${name}" changed.\n\n` +
            `--- recorded ---\n${outcome.expected}\n--- now ---\n${outcome.actual}`,
    );

    return played;
  } finally {
    await played.cleanup();
  }
}

test('mission 1, played straight through', async () => {
  const played = await check('m01-straight-through', [
    '1', // prediction: "it says hello back"
    'echo hello',
    'echo Explorer',
    '', // recap answer
  ]);

  assert.equal(played.result.completed, true);
});

test('mission 1, with a typo and the full hint ladder', async () => {
  // The child mistypes, asks for every clue, and gets there. This is the
  // transcript to read when changing anything about hints: it shows all five
  // rungs in order and how the near-miss suggestion reads.
  await check('m01-hint-ladder', [
    '', // skips the prediction
    'ecko hello', // near miss — should suggest echo
    'hint', // rung 1: ask
    'hint', // rung 2: concept
    'hint', // rung 3: first letter
    'hint', // rung 4: two choices
    'hint', // rung 5: the command
    'echo hello',
    'echo me',
    '',
  ]);
});

test('a real error is shown, then handed back as a question', async () => {
  // The brief: "let the Terminal show the real error" and then have CHIP ask
  // what the computer is trying to tell us. This asserts the error text is
  // present verbatim rather than paraphrased away.
  const played = await check('m01-productive-mistake', [
    '',
    'cat missing.txt', // cat is locked at stage 1 — command not found
    'sudo rm -rf /', // must be refused as unknown, with a word from CHIP
    'echo hello',
    'echo me',
    '',
  ]);

  assert.match(
    played.transcript,
    /command not found/,
    'the real error text must appear, not a paraphrase',
  );
});

test('unsupported shell syntax is refused by name, not ignored', async () => {
  const played = await check('m01-unsupported-syntax', [
    '',
    'echo hello | grep h',
    'echo a; echo b',
    'echo hello',
    'echo me',
    '',
  ]);

  // Silently dropping the pipe would be far more confusing than refusing it.
  assert.match(played.transcript, /does not understand a pipe/);
  assert.match(played.transcript, /does not understand a semicolon/);
});

test('wandering off mid-mission is followed, not corrected', async () => {
  // Curiosity outranks the curriculum. The child ignores the instruction and
  // pokes about; the step stays open and CHIP reacts to what they did.
  const save = freshSave();
  save.stage = 4; // so mkdir is available to wander with
  save.seenWelcome = true;

  const played = await check(
    'm01-wandering',
    ['', 'mkdir my-own-room', 'ls', 'echo hello', 'echo me', ''],
    save,
  );

  assert.equal(played.result.completed, true, 'wandering must not block the mission');
  assert.doesNotMatch(
    played.transcript,
    /\b(wrong|incorrect|no,)\b/i,
    'nothing the child does safely should be called wrong',
  );
});

test('the child corrects CHIP, and he takes it well', async () => {
  // The reversal mechanic: CHIP insists `touch` makes a room, the child runs
  // it and looks, and the output settles it. Read this transcript when
  // changing anything about claims — CHIP must be pleased to be wrong, and
  // the child must be the one who established the truth.
  const save = freshSave();
  save.seenWelcome = true;
  save.stage = 4;
  // Pretend the earlier missions are done so the selector offers m07.
  for (const id of [
    'm01-hello-explorer',
    'm02-where-am-i',
    'm03-the-message',
    'm04-three-doors',
    'm05-moon-crystal',
    'm06-build-your-base',
  ]) {
    save.missions[id] = { plays: 1, completed: true, lastSessionIndex: 0, hintsUsed: 0 };
  }
  for (const id of [
    'echo.say',
    'pwd.where',
    'ls.look',
    'cat.read',
    'cd.into',
    'cd.up',
    'mkdir.make',
  ]) {
    save.concepts[id] = {
      ...freshConceptState(),
      strength: 0.9,
      unaidedUses: 4,
      sessions: 2,
      scaffold: 'prompted',
      lastUsedAt: new Date('2026-03-14T09:00:00.000Z').toISOString(),
    };
  }

  const played = await check(
    'm07-correcting-chip',
    [
      'echo', // the warm-up retrieval question
      '2', // prediction: "no, he is wrong"
      'touch rock',
      'ls',
      'slash', // recap answer
    ],
    save,
  );

  assert.match(
    played.transcript,
    /You were right and I was wrong/,
    'CHIP must acknowledge the correction',
  );
  assert.equal(played.save.chipCorrections, 1, 'correcting CHIP should be recorded');
});

test('quitting halfway keeps everything and says so', async () => {
  const played = await play({ inputs: ['', 'echo hello', 'quit'] });
  try {
    assert.equal(played.result.quitEarly, true);
    assert.equal(played.result.completed, false);

    // Progress on the concept is still recorded — stopping is not a penalty.
    assert.ok(
      (played.save.concepts['echo.say']?.unaidedUses ?? 0) >= 1,
      'what they did before quitting should still count',
    );
  } finally {
    await played.cleanup();
  }
});

test('a transcript does not depend on how long the temp path is', async () => {
  // The welcome block prints the world folder. It used to sit inside a
  // sentence that gets wrapped, so the path was one unbreakable word whose
  // LENGTH decided where every following word landed — and os.tmpdir() is
  // ~19 characters on Linux against ~60 on macOS, where /var/folders/... is
  // the norm. Four goldens therefore passed on Linux and failed on macOS.
  //
  // Scrubbing cannot fix this: matchGolden runs after rendering, so it can
  // make a path stable but never its length. The fix has to keep variable
  // -length paths out of wrapped prose, and this is the test for that.
  const short = await play({ inputs: ['', 'echo hi', ''] });
  const long = await play({
    inputs: ['', 'echo hi', ''],
    home: await makeTempHome('mc-test-' + 'x'.repeat(60) + '-'),
  });

  try {
    assert.equal(
      await scrubHome(short.transcript, short.home),
      await scrubHome(long.transcript, long.home),
      'the transcript changed because the temp directory path was longer',
    );
  } finally {
    await short.cleanup();
    await long.cleanup();
  }
});
