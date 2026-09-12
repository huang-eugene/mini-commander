/**
 * The learner model.
 *
 * This is what makes the scaffolding fade on its own. Nothing in the mission
 * content says "by now they should know ls" — the model works that out from
 * what the child has actually done, and the mission text follows.
 *
 * Four decisions worth explaining, because they are not arbitrary:
 *
 * 1. Being shown the answer earns almost no credit. A success at hint rung 5
 *    is evidence that the hint worked, not that the child knows the command.
 *    Credit scales down with the rung and reaches ~0 at the reveal.
 *
 * 2. Correcting CHIP earns MORE than an ordinary success. Generating a
 *    correction is the strongest retrieval act available to us, so the child
 *    catching CHIP's deliberate mistake is worth more than quietly typing the
 *    right thing.
 *
 * 3. Mastery needs two separate sessions. Doing something three times in one
 *    sitting is short-term memory. Coming back a day later and still knowing
 *    it is learning. Without this clause the model would call everything
 *    mastered within the first half hour.
 *
 * 4. Scaffolding rises slowly and falls immediately. Fading help one notch at
 *    a time keeps the child in range; but two failures in a row means they
 *    are stranded, and help should come back at once rather than a notch at
 *    a time.
 */

import { ALL_CONCEPT_IDS, type ConceptId } from './concepts.js';

/** How much help the mission text gives for a given step. */
export type Scaffold = 'guided' | 'prompted' | 'open';

export const SCAFFOLD_ORDER: readonly Scaffold[] = ['guided', 'prompted', 'open'];

export interface ConceptState {
  /** 0..1. Decayed by time-since-use on load. */
  strength: number;
  unaidedUses: number;
  hintedUses: number;
  deepestHint: number;
  failures: number;
  consecutiveFailures: number;
  /** Distinct play sessions in which this concept was used successfully. */
  sessions: number;
  lastSessionIndex: number;
  /** ISO timestamp, or undefined if never used. */
  lastUsedAt?: string;
  scaffold: Scaffold;
  /** Leitner box, 0..5. Counted in sessions, not days — see `dueInSessions`. */
  box: number;
  dueAtSession: number;
}

export function freshConceptState(): ConceptState {
  return {
    strength: 0,
    unaidedUses: 0,
    hintedUses: 0,
    deepestHint: 0,
    failures: 0,
    consecutiveFailures: 0,
    sessions: 0,
    lastSessionIndex: -1,
    scaffold: 'guided',
    box: 0,
    dueAtSession: 0,
  };
}

/* ---- the arithmetic ------------------------------------------------- */

const GAIN = 0.45;

/** Half-life per Leitner box, in days. Used only as a wall-clock backstop. */
const HALF_LIFE_DAYS = [1, 2, 4, 8, 16, 32];

/**
 * Spacing is measured in *sessions*, not days, because a 7-year-old plays
 * irregularly. A days-based schedule turns a two-week holiday into a wall of
 * overdue material, which is exactly the wrong thing to hand a child on
 * their first day back.
 */
const DUE_IN_SESSIONS = [0, 1, 2, 4, 8, 16];

export function dueInSessions(box: number): number {
  return DUE_IN_SESSIONS[Math.min(box, DUE_IN_SESSIONS.length - 1)]!;
}

function approach(strength: number, gain: number): number {
  return Math.min(1, strength + (1 - strength) * gain);
}

export type Outcome =
  | { kind: 'unaided' }
  | { kind: 'hinted'; rung: number }
  | { kind: 'failed' }
  | { kind: 'predicted' }
  | { kind: 'corrected-chip' };

export function applyOutcome(
  state: ConceptState,
  outcome: Outcome,
  sessionIndex: number,
  now: Date,
): ConceptState {
  const next: ConceptState = { ...state };

  switch (outcome.kind) {
    case 'unaided':
      next.strength = approach(next.strength, GAIN);
      next.unaidedUses += 1;
      next.consecutiveFailures = 0;
      break;

    case 'hinted': {
      // Rung 5 is the reveal: the answer was on screen, so credit is ~0.
      const discount = Math.max(0, 1 - outcome.rung / 5);
      next.strength = approach(next.strength, GAIN * discount);
      next.hintedUses += 1;
      next.deepestHint = Math.max(next.deepestHint, outcome.rung);
      next.consecutiveFailures = 0;
      break;
    }

    case 'failed':
      next.strength = next.strength * 0.8;
      next.failures += 1;
      next.consecutiveFailures += 1;
      break;

    case 'predicted':
      // A prediction is retrieval even when the answer is wrong, so this is
      // credited on *making* one, never on being right.
      next.strength = approach(next.strength, 0.15);
      break;

    case 'corrected-chip':
      next.strength = approach(next.strength, 0.25);
      next.consecutiveFailures = 0;
      break;
  }

  const succeeded = outcome.kind !== 'failed';
  if (succeeded) {
    next.lastUsedAt = now.toISOString();
    if (state.lastSessionIndex !== sessionIndex) {
      next.sessions += 1;
      next.lastSessionIndex = sessionIndex;
    }
    if (outcome.kind === 'unaided' || outcome.kind === 'corrected-chip') {
      next.box = Math.min(HALF_LIFE_DAYS.length - 1, next.box + 1);
    }
  } else {
    // Drop two boxes on a failure, not one: getting it wrong means the
    // interval was too long, and being gentle here means the child keeps
    // meeting it at a spacing they cannot sustain.
    next.box = Math.max(0, next.box - 2);
  }
  next.dueAtSession = sessionIndex + dueInSessions(next.box);

  next.scaffold = nextScaffold(next, state.scaffold);
  return next;
}

/** Applies forgetting. Called once when a save is loaded. */
export function decay(state: ConceptState, now: Date): ConceptState {
  if (!state.lastUsedAt) return state;

  const days = (now.getTime() - Date.parse(state.lastUsedAt)) / 86_400_000;
  if (!Number.isFinite(days) || days <= 0) return state;

  const halfLife = HALF_LIFE_DAYS[Math.min(state.box, HALF_LIFE_DAYS.length - 1)]!;
  const decayed = state.strength * 0.5 ** (days / halfLife);

  const next = { ...state, strength: decayed };
  next.scaffold = nextScaffold(next, state.scaffold);
  return next;
}

/**
 * Mastery is deliberately hard to reach. Three unaided uses across two
 * separate sessions, with the help already faded, is the least that can
 * honestly be called "knows it".
 */
export function isMastered(state: ConceptState): boolean {
  return (
    state.strength >= 0.8 &&
    state.unaidedUses >= 3 &&
    state.sessions >= 2 &&
    state.scaffold !== 'guided'
  );
}

function targetScaffold(strength: number): Scaffold {
  if (strength < 0.5) return 'guided';
  if (strength < 0.8) return 'prompted';
  return 'open';
}

function nextScaffold(state: ConceptState, previous: Scaffold): Scaffold {
  const previousIndex = SCAFFOLD_ORDER.indexOf(previous);

  // Stranded: bring help back at once rather than a notch at a time.
  if (state.consecutiveFailures >= 2) {
    return SCAFFOLD_ORDER[Math.max(0, previousIndex - 1)]!;
  }

  // Help never shrinks inside a single sitting. One success is short-term
  // memory, not learning, and a child who is told "type ls" in step one and
  // then asked "what command could help?" in step two — ninety seconds
  // later — has been demoted for getting something right. Fading happens
  // between sessions, which is also where the evidence actually is.
  if (state.sessions < 2) return previous;

  const targetIndex = SCAFFOLD_ORDER.indexOf(targetScaffold(state.strength));
  // Never skip a rung upward: going from "type ls" straight to "investigate"
  // strands the child even when the numbers say they are ready.
  return SCAFFOLD_ORDER[Math.min(targetIndex, previousIndex + 1)]!;
}

/* ---- the whole-child view ------------------------------------------- */

export type ConceptBook = Record<string, ConceptState>;

export class Learner {
  constructor(
    private readonly book: ConceptBook,
    private sessionIndex: number,
  ) {}

  state(id: ConceptId): ConceptState {
    return this.book[id] ?? freshConceptState();
  }

  record(id: ConceptId, outcome: Outcome, now = new Date()): void {
    this.book[id] = applyOutcome(this.state(id), outcome, this.sessionIndex, now);
  }

  /** The scaffolding for a step is set by its *weakest* concept. */
  scaffoldFor(concepts: readonly ConceptId[]): Scaffold {
    if (concepts.length === 0) return 'open';
    let weakest = 2;
    for (const id of concepts) {
      weakest = Math.min(weakest, SCAFFOLD_ORDER.indexOf(this.state(id).scaffold));
    }
    return SCAFFOLD_ORDER[weakest]!;
  }

  mastered(id: ConceptId): boolean {
    return isMastered(this.state(id));
  }

  /**
   * The concept most worth revisiting: due, weakest, and used longest ago.
   * This is what the session warm-up exercises, and it is the mechanism
   * behind "if a command is repeatedly forgotten, work it into later
   * missions".
   */
  stalest(candidates: readonly ConceptId[] = ALL_CONCEPT_IDS): ConceptId | undefined {
    const seen = candidates.filter((id) => {
      const s = this.state(id);
      return s.unaidedUses + s.hintedUses > 0;
    });
    if (seen.length === 0) return undefined;

    const due = seen.filter((id) => this.state(id).dueAtSession <= this.sessionIndex);
    const pool = due.length > 0 ? due : seen;

    return [...pool].sort((a, b) => {
      const sa = this.state(a);
      const sb = this.state(b);
      if (sa.strength !== sb.strength) return sa.strength - sb.strength;
      return (sa.lastUsedAt ?? '').localeCompare(sb.lastUsedAt ?? '');
    })[0];
  }

  /** Concepts the child is struggling with, for the grown-up's journal. */
  shaky(): ConceptId[] {
    return ALL_CONCEPT_IDS.filter((id) => {
      const s = this.state(id);
      return s.unaidedUses + s.hintedUses > 0 && s.strength < 0.5;
    });
  }

  solid(): ConceptId[] {
    return ALL_CONCEPT_IDS.filter((id) => this.mastered(id));
  }

  snapshot(): ConceptBook {
    return this.book;
  }
}
