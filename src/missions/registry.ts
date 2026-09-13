/**
 * Every mission, in curriculum order.
 *
 * Order matters: the selector walks this list looking for the first thing the
 * child is ready for, so a mission's position is its place in the progression.
 */

import type { Mission } from './types.js';
import { m01 } from './m01-hello-explorer.js';
import { m02 } from './m02-where-am-i.js';
import { m03 } from './m03-the-message.js';
import { m04 } from './m04-three-doors.js';
import { m05 } from './m05-moon-crystal.js';
import { m06 } from './m06-build-your-base.js';
import { m07 } from './m07-empty-boxes.js';
import { m08 } from './m08-secret-note.js';
import { m09 } from './m09-invisible-ink.js';
import { m10 } from './m10-chips-diary.js';
import { m11 } from './m11-chips-bedroom.js';
import { m12 } from './m12-the-museum.js';
import { m13 } from './m13-the-spell-book.js';
import { m14 } from './m14-write-your-own-spell.js';
import { m15 } from './m15-the-broken-spell.js';
import { m16 } from './m16-the-envelope.js';
import { m17 } from './m17-is-anybody-there.js';
import { m18 } from './m18-names-and-numbers.js';
import { m19 } from './m19-the-long-journey.js';
import { g01 } from './g01-real-control-room.js';

export const MISSIONS: readonly Mission[] = [
  m01,
  m02,
  m03,
  m04,
  m05,
  m06,
  m07,
  m08,
  m09,
  m10,
  m11,
  m12,
  m13,
  m14,
  m15,
  m16,
  m17,
  m18,
  m19,
  g01,
];

const BY_ID = new Map(MISSIONS.map((m) => [m.id, m]));

export function mission(id: string): Mission | undefined {
  return BY_ID.get(id);
}

/** The stage a mission belongs to, as a number (graduation counts as its own). */
export function stageNumber(mission: Mission): number {
  return typeof mission.stage === 'number' ? mission.stage : 99;
}
