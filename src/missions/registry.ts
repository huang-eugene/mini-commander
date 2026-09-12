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

export const MISSIONS: readonly Mission[] = [m01, m02, m03, m04, m05];

const BY_ID = new Map(MISSIONS.map((m) => [m.id, m]));

export function mission(id: string): Mission | undefined {
  return BY_ID.get(id);
}

/** The stage a mission belongs to, as a number (graduation counts as its own). */
export function stageNumber(mission: Mission): number {
  return typeof mission.stage === 'number' ? mission.stage : 99;
}
