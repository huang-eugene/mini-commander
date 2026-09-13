/**
 * Spells — the stage 7 "program".
 *
 * The property that matters most here is that a spell runs through exactly
 * the same path as typed input. If that ever stops being true, the game
 * grows a second way to execute commands and therefore a second safety
 * boundary, which is the thing the whole design avoids.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeShell } from '../harness/session.js';
import { readSpell } from '../../src/shell/spells.js';

test('blank lines and comments are skipped, numbering is preserved', () => {
  const lines = readSpell(['# a comment', '', 'ls', '  ', 'pwd'].join('\n'));

  assert.deepEqual(
    lines.map((l) => [l.number, l.text]),
    [
      [3, 'ls'],
      [5, 'pwd'],
    ],
    'line numbers must match what the child counts in the file',
  );
});

test('a spell runs its lines in order', async () => {
  const shell = await makeShell();
  try {
    await shell.run('mkdir cave');
    await shell.run('echo cd cave > plan.spell');
    await shell.run('echo ls >> plan.spell');
    await shell.run('echo echo done >> plan.spell');

    await shell.run('run plan.spell');

    // The spell walked us into the cave, so the shell is standing there now.
    assert.equal(shell.state.cwd, '/cave', 'the spell should have moved us');
    assert.match(shell.output(), /done/, 'the last line should have run');
  } finally {
    await shell.cleanup();
  }
});

test('a broken spell stops on the line that broke, and says which', async () => {
  // This is the whole of mission 15. The line number is what makes the
  // failure findable: the child opens the spell and counts to it.
  const shell = await makeShell();
  try {
    await shell.run('echo echo starting > broken.spell');
    await shell.run('echo cd nowhere >> broken.spell');
    await shell.run('echo echo finished >> broken.spell');

    await shell.run('run broken.spell');

    const out = shell.output();
    assert.match(out, /starting/, 'the first line should have run');
    assert.match(out, /No such file or directory/, 'the real error must be shown');
    assert.match(out, /stopped at line 2/, 'it must name the line that broke');
    assert.doesNotMatch(out, /finished/, 'it must not carry on past the break');
  } finally {
    await shell.cleanup();
  }
});

test('a spell emits a program-run event naming the failed line', async () => {
  const shell = await makeShell();
  try {
    await shell.run('echo ls > s.spell');
    await shell.run('echo cd nope >> s.spell');
    await shell.run('run s.spell');

    const event = shell.bus
      .history()
      .find((e): e is Extract<typeof e, { kind: 'program-run' }> => e.kind === 'program-run');

    assert.ok(event, 'running a spell must emit program-run');
    assert.equal(event.failedLine, 2);
  } finally {
    await shell.cleanup();
  }
});

test('a spell cannot run another spell', async () => {
  // No recursion means no cycles, no depth limit to explain to a child, and
  // no way to hang the game.
  const shell = await makeShell();
  try {
    await shell.run('echo ls > inner.spell');
    await shell.run('echo run inner.spell > outer.spell');
    await shell.run('run outer.spell');

    assert.match(shell.output(), /a spell cannot run another spell/);
  } finally {
    await shell.cleanup();
  }
});

test('a spell obeys the jail like anything else', async () => {
  // The important one. A spell is not a way around the sandbox.
  const shell = await makeShell();
  try {
    await shell.run('echo cat ../../../../etc/passwd > sneaky.spell');
    await shell.run('run sneaky.spell');

    const out = shell.output();
    assert.doesNotMatch(out, /root:/, 'a spell must never reach a real system file');
    assert.match(out, /No such file or directory/);
  } finally {
    await shell.cleanup();
  }
});

test('an empty spell says so instead of doing nothing silently', async () => {
  const shell = await makeShell();
  try {
    await shell.run('touch empty.spell');
    await shell.run('run empty.spell');

    assert.match(shell.output(), /nothing in it yet/);
  } finally {
    await shell.cleanup();
  }
});

test('running a room, or something absent, gives the real error', async () => {
  const shell = await makeShell();
  try {
    await shell.run('mkdir aroom');
    await shell.run('run aroom');
    assert.match(shell.output(), /Is a directory/);

    await shell.run('run nothing-here.spell');
    assert.match(shell.output(), /No such file or directory/);
  } finally {
    await shell.cleanup();
  }
});

test('a quoted run is still a run', async () => {
  // The guard used to split the raw line and compare the first word, so
  // `"run"` did not match it — while the lexer stripped the quotes and the
  // dispatcher ran it as `run`. A spell naming itself that way recursed
  // without limit, because MAX_SPELL_STEPS counts one invocation only.
  const shell = await makeShell();
  try {
    await shell.run('echo "run" loop.spell > loop.spell');
    await shell.run('run loop.spell');

    assert.match(shell.output(), /a spell cannot run another spell/);
  } finally {
    await shell.cleanup();
  }
});

test('a spell that calls itself terminates instead of hanging', async () => {
  // The property the guard exists for, stated directly: whatever spelling a
  // spell uses to name `run`, the game must come back.
  const shell = await makeShell();
  try {
    await shell.run('echo echo still here > loop.spell');
    await shell.run('echo "RUN" loop.spell >> loop.spell');

    const finished = await Promise.race([
      shell.run('run loop.spell').then(() => true),
      new Promise<boolean>((done) => setTimeout(() => done(false), 5000)),
    ]);

    assert.equal(finished, true, 'running a self-referencing spell must terminate');
    assert.match(shell.output(), /a spell cannot run another spell/);
  } finally {
    await shell.cleanup();
  }
});
