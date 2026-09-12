import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ParseProblem, nearestWord, parseLine } from '../../src/shell/lexer.js';

test('parses a bare command', () => {
  const parsed = parseLine('ls');
  assert.equal(parsed?.name, 'ls');
  assert.deepEqual(parsed?.args, []);
});

test('a blank line is nothing at all', () => {
  assert.equal(parseLine(''), undefined);
  assert.equal(parseLine('   '), undefined);
});

test('command names are matched case-insensitively but remembered as typed', () => {
  // A child who has only just met the shift key should not be punished for
  // it, but "you typed LS" needs to quote them accurately.
  const parsed = parseLine('LS');
  assert.equal(parsed?.name, 'ls');
  assert.equal(parsed?.spelling, 'LS');
});

test('keeps quoted text in one piece', () => {
  assert.deepEqual(parseLine('echo "hello there"')?.args, ['hello there']);
  assert.deepEqual(parseLine("echo 'hello there'")?.args, ['hello there']);
});

test('understands both redirects', () => {
  assert.deepEqual(parseLine('echo hi > note.txt')?.redirect, { op: '>', target: 'note.txt' });
  assert.deepEqual(parseLine('echo hi >> note.txt')?.redirect, { op: '>>', target: 'note.txt' });
  assert.deepEqual(parseLine('echo hi>note.txt')?.args, ['hi']);
});

test('refuses shell syntax by name instead of ignoring it', () => {
  // Silently dropping a pipe is far more confusing to a child than saying
  // plainly that we do not have one.
  for (const [line, offender] of [
    ['echo a | grep a', '|'],
    ['echo a; echo b', ';'],
    ['echo a && echo b', '&'],
    ['echo `whoami`', '`'],
    ['echo $HOME', '$'],
    ['cat < note.txt', '<'],
    ['ls *', '*'],
    ['echo (hi)', '('],
  ] as const) {
    assert.throws(
      () => parseLine(line),
      (err: unknown) =>
        err instanceof ParseProblem && err.kind === 'unsupported' && err.offender === offender,
      `${line} should be refused, naming ${offender}`,
    );
  }
});

test('ordinary punctuation is allowed', () => {
  // A 7-year-old writes "Done!" and "Are you there?". Refusing those would be
  // a constant obstruction with nothing true behind it — bash treats them
  // literally in these positions too.
  assert.deepEqual(parseLine('echo Done!')?.args, ['Done!']);
  assert.deepEqual(parseLine('echo Are you there?')?.args, ['Are', 'you', 'there?']);
  assert.deepEqual(parseLine('echo 50% done')?.args, ['50%', 'done']);
});

test('an apostrophe inside a word is just an apostrophe', () => {
  // A quote only opens a quoted string at the START of a word, so `echo it's
  // mine` works. Bash would call that an unclosed quote and drop the child
  // into a continuation prompt they have no way to understand — this is one
  // of the few places where being deliberately kinder than a real shell is
  // worth it, because there is nothing to learn from that particular
  // confusion.
  assert.deepEqual(parseLine("echo it's mine")?.args, ["it's", 'mine']);
  assert.deepEqual(parseLine("echo CHIP's room")?.args, ["CHIP's", 'room']);

  // A quote at the start of a word still quotes, and still has to be closed.
  assert.deepEqual(parseLine("echo 'two words'")?.args, ['two words']);
  assert.throws(
    () => parseLine("echo 'never closed"),
    (err: unknown) => err instanceof ParseProblem && err.kind === 'unclosed-quote',
  );
});

test('an unclosed quote is explained, not guessed at', () => {
  assert.throws(
    () => parseLine('echo "hello'),
    (err: unknown) => err instanceof ParseProblem && err.kind === 'unclosed-quote',
  );
});

test('a redirect with nothing after it is explained', () => {
  assert.throws(
    () => parseLine('echo hi >'),
    (err: unknown) => err instanceof ParseProblem && err.kind === 'dangling-redirect',
  );
});

test('suggests a near miss, including swapped letters', () => {
  const words = ['ls', 'cd', 'cat', 'echo', 'pwd', 'mkdir', 'touch', 'map', 'help'];

  // Transpositions are how this age group mistypes most often, and plain
  // Levenshtein scores them as two edits, missing exactly these cases.
  assert.equal(nearestWord('sl', words), 'ls');
  assert.equal(nearestWord('mkidr', words), 'mkdir');
  assert.equal(nearestWord('ecko', words), 'echo');
  assert.equal(nearestWord('tuoch', words), 'touch');
});

test('never suggests a word that is two edits from a short one', () => {
  const words = ['ls', 'cd', 'echo', 'pwd', 'map', 'help'];

  // "cat" is two edits from "map". Suggesting it would send a child who
  // trusts CHIP somewhere completely unrelated, with his blessing. A wrong
  // suggestion is worse than none.
  assert.equal(nearestWord('cat', words), undefined);
  assert.equal(nearestWord('xyz', words), undefined);
  assert.equal(nearestWord('banana', words), undefined);
});
