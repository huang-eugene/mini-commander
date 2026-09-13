/**
 * Whatever the child types, the game answers. It does not fall over.
 *
 * A crash here is not cosmetic: an error that is not a ShellError escapes the
 * session loop entirely, so runSession never reaches its save — and the child
 * loses everything they did that sitting. That is the one failure this project
 * cannot afford socially, whatever the code does.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeShell } from '../harness/session.js';
import { NOT_HERE } from '../../src/shell/commands.js';
import { COSMETICS } from '../../src/engine/progress.js';

/**
 * Words that are ordinary English but also live on Object.prototype.
 *
 * NOT_HERE used to be an object literal indexed by the typed word, so
 * `constructor` resolved to the inherited FUNCTION, passed the truthiness
 * check, and was handed to screen.chip() — which died on
 * `text.split is not a function`. Lookups are lowercased, so `constructor` was
 * the only one of these that could reach it; the rest are here so that a
 * future change to the casing cannot quietly reopen the hole.
 */
const INHERITED_KEYS = [
  'constructor',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  '__proto__',
  '__defineGetter__',
  '__lookupGetter__',
];

test('a word that is also an Object.prototype key does not crash the session', async () => {
  const shell = await makeShell();
  try {
    for (const word of INHERITED_KEYS) {
      await shell.run(word);
      await shell.run(`${word} something`);
      await shell.run(word.toUpperCase());
    }

    // Still alive and still answering.
    await shell.run('echo still here');
    assert.match(shell.output(), /still here/);
  } finally {
    await shell.cleanup();
  }
});

test('the lookup tables do not answer for keys they were never given', () => {
  for (const word of INHERITED_KEYS) {
    assert.equal(NOT_HERE.get(word), undefined, `NOT_HERE answered for ${word}`);
    assert.equal(COSMETICS.get(word), undefined, `COSMETICS answered for ${word}`);
  }

  // And still answer for the ones they were.
  assert.match(NOT_HERE.get('sudo') ?? '', /special powers/);
  assert.match(COSMETICS.get('torch') ?? '', /torch/);
});

test('the dangerous commands still get CHIP\u2019s word rather than silence', async () => {
  const shell = await makeShell();
  try {
    await shell.run('sudo rm');
    const out = shell.output();

    assert.match(out, /command not found/, 'the real shell error comes first');
    // CHIP's line is wrapped into a speech box, so match a word rather than
    // a phrase that the box may have split across two lines.
    assert.match(out, /special/, "then CHIP's word about it");
  } finally {
    await shell.cleanup();
  }
});
