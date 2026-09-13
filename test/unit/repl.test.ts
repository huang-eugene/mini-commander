/**
 * Reading what the child types, over a pair of fake streams.
 *
 * The bug this file exists for was visible in every real session and in none
 * of the tests: each question registered its own `rl.once('close', ...)`
 * listener, removed only by a close that does not come until the session ends.
 * Node warned on the eleventh line —
 *
 *   MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
 *   11 close listeners added to [Interface].
 *
 * — printing an EventEmitter diagnostic into the middle of a seven-year-old's
 * game. Every transcript test uses the scripted input instead, so nothing
 * exercised this path at all.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';

import { makeTerminalInput, promptFor } from '../../src/shell/repl.js';
import { ROOT, resolve } from '../../src/shell/vpath.js';
import type { World } from '../../src/shell/fs-jail.js';

/** Enough of a World for the completion cache. */
const emptyWorld = { list: async () => [] } as unknown as World;

function terminal() {
  const input = new PassThrough();
  const output = new PassThrough();
  output.resume(); // drain, or writes back up

  const term = makeTerminalInput({
    world: emptyWorld,
    state: { cwd: ROOT, stage: 1 },
    vocabulary: () => ['echo', 'ls'],
    write: () => {},
    input,
    output,
  });

  return { term, input, output };
}

test('a long session adds no listeners and emits no warning', async () => {
  const warnings: string[] = [];
  const collect = (w: Error): void => {
    warnings.push(w.name);
  };
  process.on('warning', collect);

  const { term, input } = terminal();
  try {
    // Well past the default limit of 10, and past the eleventh line where the
    // warning used to appear.
    for (let i = 0; i < 25; i += 1) {
      const pending = term.line(promptFor(ROOT));
      input.write(`echo line ${i}\n`);
      assert.equal(await pending, `echo line ${i}`);
    }

    await new Promise((done) => setTimeout(done, 20));
    assert.deepEqual(
      warnings.filter((w) => w === 'MaxListenersExceededWarning'),
      [],
      'a real session must not print an EventEmitter warning at the child',
    );
  } finally {
    process.off('warning', collect);
    term.close();
  }
});

test('closing the input ends the session rather than hanging', async () => {
  // Ctrl-D. line() must resolve to undefined, which is how runSession knows to
  // stop; a waiter left unresolved would hang the game on exit.
  const { term, input } = terminal();
  const pending = term.line('> ');
  input.end();

  assert.equal(await pending, undefined);

  // And anything asked afterwards resolves immediately rather than waiting for
  // a close that has already happened.
  assert.equal(await term.line('> '), undefined);
  assert.equal(await term.choose('pick one', ['a', 'b']), '');
});

test('choose accepts a number, the option text, or just Enter', async () => {
  const { term, input } = terminal();
  try {
    const byNumber = term.choose('which?', ['first', 'second']);
    input.write('2\n');
    assert.equal(await byNumber, 'second');

    const byText = term.choose('which?', ['first', 'second']);
    input.write('FIRST\n');
    assert.equal(await byText, 'first');

    const skipped = term.choose('which?', ['first', 'second']);
    input.write('\n');
    assert.equal(await skipped, '');
  } finally {
    term.close();
  }
});

test('the prompt says which room the child is standing in', () => {
  assert.equal(promptFor(ROOT), '/ > ');
  assert.equal(promptFor(resolve(ROOT, 'cave')), 'cave > ');
});
