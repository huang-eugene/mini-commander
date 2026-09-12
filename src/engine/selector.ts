/**
 * Choosing what to play.
 *
 * Two jobs:
 *
 * 1. Pick the next mission — the earliest one not yet completed whose
 *    prerequisites the child can actually handle. A mission is *not* offered
 *    just because it is next in the list; if the concepts it leans on have
 *    decayed, an earlier mission gets replayed instead. That is the
 *    "optimise for mastery, not speed" rule.
 *
 * 2. Produce a warm-up: one short retrieval beat on the single stalest
 *    concept, before the mission proper. This is the mechanism behind "if a
 *    command is repeatedly forgotten, incorporate it naturally into future
 *    missions" — it happens automatically, and no mission author has to
 *    remember to do it.
 */

import type { Mission } from '../missions/types.js';
import { MISSIONS } from '../missions/registry.js';
import { concept, type ConceptId } from './concepts.js';
import type { Learner } from './learner.js';
import type { SaveFile } from './save.js';

/** Below this, a prerequisite is too shaky to build on. */
const READY_THRESHOLD = 0.35;

export interface Choice {
  mission: Mission;
  /** True when this is a replay for practice rather than new material. */
  replay: boolean;
  warmUp?: WarmUp;
}

/**
 * A single retrieval question, asked before the mission. Deliberately tiny —
 * under a minute, one concept, and it never blocks: if the child cannot
 * remember, CHIP says the answer and the mission starts anyway.
 */
export interface WarmUp {
  concept: ConceptId;
  question: string;
  /** What the child should type. Checked loosely. */
  expect: string;
  /** Said whether or not they get it. Forgetting is not failure. */
  reassure: string;
}

export function chooseMission(save: SaveFile, learner: Learner): Choice | undefined {
  const ready = (mission: Mission): boolean =>
    mission.requires.every((id) => learner.state(id).strength >= READY_THRESHOLD);

  const completed = (mission: Mission): boolean => save.missions[mission.id]?.completed === true;

  // First pass: the next new mission the child is ready for.
  for (const mission of MISSIONS) {
    if (completed(mission)) continue;
    if (ready(mission)) {
      return withWarmUp({ mission, replay: false }, learner);
    }

    // Not ready: find the completed mission that taught the weakest
    // prerequisite and offer that again instead. Replaying something they
    // already beat is far kinder than being stuck on something they cannot.
    const weakest = [...mission.requires].sort(
      (a, b) => learner.state(a).strength - learner.state(b).strength,
    )[0];

    if (weakest) {
      const refresher = MISSIONS.find((m) => completed(m) && m.teaches.includes(weakest));
      if (refresher) return withWarmUp({ mission: refresher, replay: true }, learner);
    }

    // Nothing to fall back on (very early on): just play it.
    return withWarmUp({ mission, replay: false }, learner);
  }

  // Everything is done. Offer the mission whose concepts are stalest, so the
  // world stays worth returning to after the curriculum runs out.
  const stalest = learner.stalest();
  if (stalest) {
    const found = MISSIONS.find((m) => m.teaches.includes(stalest));
    if (found) return withWarmUp({ mission: found, replay: true }, learner);
  }

  return undefined;
}

function withWarmUp(choice: Choice, learner: Learner): Choice {
  // No warm-up on a replay: the whole mission is already practice.
  if (choice.replay) return choice;

  const stale = learner.stalest();
  if (!stale) return choice;

  // Do not warm up on something the mission is about to teach from scratch.
  if (choice.mission.teaches.includes(stale)) return choice;

  const warmUp = makeWarmUp(stale);
  return warmUp ? { ...choice, warmUp } : choice;
}

function makeWarmUp(id: ConceptId): WarmUp | undefined {
  const c = concept(id);
  if (!c.command) return undefined;

  return {
    concept: id,
    question: `Before we start — do you remember the word for ${c.metaphor}?`,
    expect: c.command,
    reassure: `It is ${c.command}. It comes back quickly once you use it.`,
  };
}

/** Loose check on a warm-up answer: they typed the command, or named it. */
export function warmUpSatisfied(warmUp: WarmUp, answer: string): boolean {
  const said = answer.trim().toLowerCase();
  if (said.length === 0) return false;
  return said === warmUp.expect || said.startsWith(warmUp.expect + ' ');
}
