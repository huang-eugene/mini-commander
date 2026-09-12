/**
 * The hint ladder.
 *
 * Rules, straight from the brief:
 *   - the child is asked before being told
 *   - hints get stronger, one rung at a time, never skipping
 *   - the ladder is offered after a few attempts, never forced
 *   - forgetting is never framed as failure
 *
 * The engine only ever *offers*. A rung is shown when the child asks for it
 * with `hint`, or accepts an offer. Nothing auto-reveals, because a child who
 * is thinking looks exactly like a child who is stuck, and interrupting the
 * first is worse than waiting on the second.
 */

import type { Hints, Line } from '../missions/types.js';

export const MAX_RUNG = 5;

/** Attempts on one step before CHIP offers a clue. */
export const OFFER_AFTER_ATTEMPTS = 3;

export class HintLadder {
  private rung = 0;
  private offered = false;

  constructor(private readonly hints: Hints) {}

  get current(): number {
    return this.rung;
  }

  get exhausted(): boolean {
    return this.rung >= MAX_RUNG;
  }

  /** Whether CHIP should offer a clue now, given how it is going. */
  shouldOffer(attempts: number): boolean {
    if (this.offered || this.rung > 0) return false;
    return attempts >= OFFER_AFTER_ATTEMPTS;
  }

  markOffered(): void {
    this.offered = true;
  }

  /** Steps up one rung and returns what CHIP says. */
  next(): { rung: number; lines: Line[]; command?: string } {
    this.rung = Math.min(MAX_RUNG, this.rung + 1);
    const h = this.hints;

    switch (this.rung) {
      case 1:
        return { rung: 1, lines: [h.ask] };
      case 2:
        return { rung: 2, lines: [h.concept] };
      case 3:
        return { rung: 3, lines: [h.firstLetter] };
      case 4:
        return {
          rung: 4,
          lines: [h.choice.line, `Is it ${h.choice.options[0]} or ${h.choice.options[1]}?`],
        };
      default:
        return {
          rung: 5,
          lines: [h.reveal.line],
          command: h.reveal.command,
        };
    }
  }

  reset(): void {
    this.rung = 0;
    this.offered = false;
  }
}

/**
 * Lines CHIP uses when the ladder runs out. Notably none of these say the
 * child got anything wrong — at rung 5 the answer is simply given, warmly,
 * and we move on.
 */
export const LADDER_BOTTOM: readonly Line[] = [
  'Here, let me just show you this one.',
  "I'll show you. You can remember it next time.",
  'This one is easier to see than to explain.',
];
