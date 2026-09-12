/**
 * The mission format.
 *
 * A mission is data plus a few small predicates. The shape is constrained on
 * purpose so that the lint in test/mission-lint.test.ts can hold every
 * mission to the same pedagogical standard — exactly five hint rungs, at
 * most two new concepts, all three scaffolding levels written, a prediction
 * somewhere, a recap, and lines short enough to read.
 *
 * The `solution` field on each step is what makes the ladder honest. The lint
 * executes it in a scratch world and asserts the step then completes, so a
 * mission cannot ship with a rung-5 reveal that does not actually work. Every
 * mission is provably completable.
 */

import type { ConceptId } from '../engine/concepts.js';
import type { ShellEvent } from '../engine/events.js';
import type { Scaffold } from '../engine/learner.js';
import type { World } from '../shell/fs-jail.js';
import type { VPath } from '../shell/vpath.js';

export type MissionId = string;
export type StepId = string;
export type BadgeId =
  'explorer' | 'file-finder' | 'bug-detective' | 'robot-engineer' | 'network-navigator';

export type Stage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'graduation';

/** One thing CHIP says. Kept short; the renderer wraps at 40 characters. */
export type Line = string;

/**
 * The 5-rung hint ladder from the brief: ask, conceptual hint, first letter,
 * two choices, show the command. Rungs are free and never framed as failure;
 * the only cost is that the learner model discounts the credit.
 */
export interface Hints {
  /** Rung 1 — put it back to the child. */
  ask: Line;
  /** Rung 2 — a hint about the idea, not the word. */
  concept: Line;
  /** Rung 3 — the first letter. */
  firstLetter: Line;
  /** Rung 4 — two options, one right. */
  choice: { line: Line; options: [string, string] };
  /** Rung 5 — the command itself, with a word about why. */
  reveal: { line: Line; command: string };
}

export interface Prediction {
  question: Line;
  /**
   * Optional multiple choice. Single keypress answers matter: typing is the
   * hard part for a 7-year-old, and a prediction should cost no typing at all.
   * Free text is accepted when this is absent.
   */
  options?: string[];
  /** CHIP's reply, whatever they guessed. Predicting is the point, not being right. */
  reply: Line;
}

export interface StepContext {
  world: World;
  cwd: VPath;
  /** The room this mission is anchored to, for relative checks. */
  anchor: VPath;
}

export interface Step {
  id: StepId;
  concepts: ConceptId[];

  /** The same instruction at three levels of help. */
  prompt: Record<Scaffold, Line[]>;

  /** Asked before the command runs, when present. */
  predict?: Prediction;

  /** True when this event (or the world it left behind) completes the step. */
  done(event: ShellEvent, ctx: StepContext): boolean | Promise<boolean>;

  /**
   * The command, or sequence of commands, that solves this step from the
   * mission's starting state. The lint runs them in order and asserts `done`
   * then fires, which is what proves the ladder's reveal is truthful and the
   * mission is completable.
   *
   * A sequence is the normal case from stage 6 onwards, where the whole point
   * is that the child combines several commands to reach a goal and no single
   * line gets there.
   */
  solution: string | string[];

  hints: Hints;

  /**
   * Set when rung 5 deliberately points the way rather than handing over the
   * whole answer — a search step, where revealing the full path would skip
   * the searching, which *is* the lesson. The reveal must still be true and
   * still make progress; it just is not the complete solution, so the lint
   * stops requiring the two to match. Use sparingly: on an ordinary step a
   * mismatch means the ladder points somewhere else entirely.
   */
  revealIsPartial?: boolean;

  /** Specific reaction to a near-miss. Never generic, never "wrong". */
  nearMiss?(event: ShellEvent): Line[] | undefined;

  /** What CHIP says on success. Specific to what just happened. */
  success: Line[];
}

/** CHIP believing something harmlessly wrong, for the child to correct. */
export interface ChipClaim {
  /** Said before the step. Wrong on purpose. */
  claim: Line;
  concept: ConceptId;
  /** True when the event proves CHIP wrong. */
  disprovedBy(event: ShellEvent): boolean;
  /** CHIP taking it well. */
  onCorrected: Line[];
}

export interface Mission {
  id: MissionId;
  title: string;
  stage: Stage;
  /** Expected length, in minutes. The lint holds this inside 5..15. */
  minutes: [number, number];

  teaches: ConceptId[];
  requires: ConceptId[];

  /** Story hook. */
  hook: Line[];
  /** One line, in the child's words, for what we are trying to do. */
  goal: Line;

  /**
   * Builds whatever the mission needs. Must be safe to run repeatedly — the
   * world persists between sessions and a grown-up may have tidied it, so
   * setup reconciles rather than assumes.
   */
  setup(world: World): Promise<void>;

  /** Where the child starts. Defaults to the world root. */
  startIn?: string;

  steps: Step[];

  claim?: ChipClaim;

  celebration: { title: string; detail?: string };

  /** Two lines at most. Asked, not told. */
  recap: { question: Line; accept: string[]; answer: Line[] };

  rewards?: { badges?: BadgeId[]; cosmetics?: string[]; artifacts?: string[] };
}
