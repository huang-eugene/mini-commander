/**
 * The learner model's arithmetic.
 *
 * These lock in the four judgement calls that make the model pedagogical
 * rather than arbitrary, because they are the kind of thing that gets
 * "tidied" later by someone who reads the formula but not the reasoning.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  Learner,
  applyOutcome,
  decay,
  freshConceptState,
  isMastered,
  type ConceptBook,
} from '../../src/engine/learner.js';

const DAY = 86_400_000;
const START = new Date('2026-03-14T10:00:00.000Z');

test('being shown the answer earns almost nothing', () => {
  // A success at rung 5 is evidence the hint worked, not that the child knows
  // the command. If this ever starts granting real credit, the model will
  // call a child fluent for reading CHIP's answers back to him.
  const unaided = applyOutcome(freshConceptState(), { kind: 'unaided' }, 0, START);
  const revealed = applyOutcome(freshConceptState(), { kind: 'hinted', rung: 5 }, 0, START);

  assert.ok(unaided.strength > 0.4, `unaided should earn real credit, got ${unaided.strength}`);
  assert.ok(revealed.strength < 0.01, `a reveal should earn ~nothing, got ${revealed.strength}`);
});

test('an early hint earns more than a late one', () => {
  const rung1 = applyOutcome(freshConceptState(), { kind: 'hinted', rung: 1 }, 0, START);
  const rung4 = applyOutcome(freshConceptState(), { kind: 'hinted', rung: 4 }, 0, START);

  assert.ok(rung1.strength > rung4.strength);
});

test('correcting CHIP is worth more than an ordinary success', () => {
  // Generating a correction is the strongest retrieval act in the design, and
  // the moment the child becomes the one who knows. It should out-earn
  // quietly typing the right thing.
  const predicted = applyOutcome(freshConceptState(), { kind: 'predicted' }, 0, START);
  const corrected = applyOutcome(freshConceptState(), { kind: 'corrected-chip' }, 0, START);

  assert.ok(corrected.strength > predicted.strength);
});

test('a prediction earns credit whether or not it was right', () => {
  // Predicting is the habit being built; being correct is incidental. The
  // model has no notion of a "wrong" prediction on purpose.
  const state = applyOutcome(freshConceptState(), { kind: 'predicted' }, 0, START);
  assert.ok(state.strength > 0);
});

test('mastery needs more than one good session', () => {
  let state = freshConceptState();

  // Three unaided uses, all in the same sitting.
  for (let i = 0; i < 3; i += 1) {
    state = applyOutcome(state, { kind: 'unaided' }, 0, START);
  }

  assert.equal(
    isMastered(state),
    false,
    'three successes in one sitting is short-term memory, not mastery',
  );

  // Come back another day and still know it.
  state = applyOutcome(state, { kind: 'unaided' }, 1, new Date(START.getTime() + DAY));
  assert.equal(isMastered(state), true);
});

test('help never shrinks inside a single sitting', () => {
  // Step one says "type echo hello"; step two, ninety seconds later, must not
  // ask "what command could help?" — that demotes a child for getting it
  // right, and it is what the first real transcript did.
  let state = freshConceptState();
  assert.equal(state.scaffold, 'guided');

  for (let i = 0; i < 5; i += 1) {
    state = applyOutcome(state, { kind: 'unaided' }, 0, START);
    assert.equal(state.scaffold, 'guided', 'scaffolding moved within one session');
  }
});

test('help fades between sessions, one step at a time', () => {
  let state = freshConceptState();

  for (let session = 0; session < 6; session += 1) {
    state = applyOutcome(
      state,
      { kind: 'unaided' },
      session,
      new Date(START.getTime() + session * DAY),
    );
  }

  assert.notEqual(state.scaffold, 'guided', 'help should have faded by now');
});

test('two failures in a row bring the help straight back', () => {
  let state = freshConceptState();

  // Get fluent over several sessions.
  for (let session = 0; session < 6; session += 1) {
    state = applyOutcome(
      state,
      { kind: 'unaided' },
      session,
      new Date(START.getTime() + session * DAY),
    );
  }
  const fluent = state.scaffold;

  state = applyOutcome(state, { kind: 'failed' }, 7, START);
  state = applyOutcome(state, { kind: 'failed' }, 7, START);

  assert.notEqual(state.scaffold, fluent, 'a stranded child should get more help at once');
});

test('forgetting happens over weeks, not within a session', () => {
  let state = applyOutcome(freshConceptState(), { kind: 'unaided' }, 0, START);
  const learned = state.strength;

  state = decay(state, new Date(START.getTime() + 60_000));
  assert.ok(Math.abs(state.strength - learned) < 0.01, 'a minute should change nothing');

  const later = decay(state, new Date(START.getTime() + 30 * DAY));
  assert.ok(later.strength < learned / 2, 'a month away should cost real strength');
});

test('the stalest concept is the one worth revisiting', () => {
  const book: ConceptBook = {};
  const learner = new Learner(book, 5);

  learner.record('ls.look', { kind: 'unaided' }, new Date(START.getTime() - 20 * DAY));
  learner.record('cat.read', { kind: 'unaided' }, START);

  // Both used once, but one is three weeks cold.
  book['ls.look'] = decay(book['ls.look']!, START);

  assert.equal(learner.stalest(['ls.look', 'cat.read']), 'ls.look');
});

test('a concept never used is not offered as a warm-up', () => {
  // You cannot practise retrieval on something you were never taught.
  const learner = new Learner({}, 1);
  assert.equal(learner.stalest(), undefined);
});
