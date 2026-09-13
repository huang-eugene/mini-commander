/**
 * Badges, cosmetics, artifacts and the map.
 *
 * The brief is firm about this: no grades, no points, no scores. Progress is
 * shown as places you have been and things you found, which is how a 7-year-old
 * already understands progress in a game.
 *
 * Badges are awarded for *demonstrated understanding* rather than for turning
 * up — each one is attached to a mission whose completion required the child to
 * use the idea unaided, so the badge is evidence rather than a participation
 * token.
 */

import type { BadgeId, Mission } from '../missions/types.js';
import type { SaveFile } from './save.js';
import type { Screen } from '../ui/render.js';
import type { World } from '../shell/fs-jail.js';
import { basename, depth, type VPath } from '../shell/vpath.js';

export interface Badge {
  id: BadgeId;
  name: string;
  /** What the child actually did to earn it, in their words. */
  earnedFor: string;
}

export const BADGES: readonly Badge[] = [
  { id: 'explorer', name: 'Explorer', earnedFor: 'You can walk anywhere in CHIP’s world.' },
  {
    id: 'file-finder',
    name: 'File Finder',
    earnedFor: 'You can write things down and read them back.',
  },
  {
    id: 'bug-detective',
    name: 'Bug Detective',
    // Worded to fit both ways it can be earned: catching CHIP out in m07, and
    // finding the broken line in a program in m15.
    earnedFor: 'You spotted something wrong and proved it.',
  },
  { id: 'robot-engineer', name: 'Robot Engineer', earnedFor: 'You wrote a program and ran it.' },
  {
    id: 'network-navigator',
    name: 'Network Navigator',
    earnedFor: 'You followed a message from one computer to another.',
  },
];

const BADGE_BY_ID = new Map(BADGES.map((b) => [b.id, b]));

/**
 * Cosmetic unlocks. These change CHIP's world rather than showing a number.
 *
 * A Map for the same reason as NOT_HERE in shell/commands.ts: it is indexed by
 * ids that come out of the save file, so an inherited Object.prototype key
 * would resolve to a function and be rendered as one.
 */
export const COSMETICS: ReadonlyMap<string, string> = new Map(
  Object.entries({
    torch: 'a torch on the control room wall',
    crystal: 'the Moon Crystal, humming on a shelf',
    'crystal-glow': 'a warm glow from the crystal',
    lamp: 'a little lamp',
    poster: 'a poster of a rocket',
    window: 'a window with stars outside',
    rocket: 'a model rocket, slightly broken',
    pet: 'a small metal dog called Bolt',
  }),
);

/** A thing to announce, split so the renderer can keep the box narrow. */
export interface Award {
  title: string;
  detail: string;
}

export function awardMission(save: SaveFile, mission: Mission, now = new Date()): Award[] {
  const announcements: Award[] = [];
  const rewards = mission.rewards;
  if (!rewards) return announcements;

  for (const id of rewards.badges ?? []) {
    if (save.badges.some((b) => b.id === id)) continue;
    save.badges.push({ id, earnedAt: now.toISOString(), missionId: mission.id });
    const badge = BADGE_BY_ID.get(id);
    if (badge) announcements.push({ title: `${badge.name} badge`, detail: badge.earnedFor });
  }

  for (const id of rewards.cosmetics ?? []) {
    if (save.cosmetics.includes(id)) continue;
    save.cosmetics.push(id);
    const description = COSMETICS.get(id);
    if (description) {
      announcements.push({ title: 'New in CHIP’s world', detail: description });
    }
  }

  for (const name of rewards.artifacts ?? []) {
    if (!save.artifacts.includes(name)) save.artifacts.push(name);
  }

  return announcements;
}

export function showBadges(save: SaveFile, screen: Screen): void {
  screen.heading('Your badges');
  screen.gap();

  if (save.badges.length === 0) {
    screen.note('None yet. They come from working things out, not from trying hard.');
    return;
  }

  for (const earned of save.badges) {
    const badge = BADGE_BY_ID.get(earned.id);
    if (!badge) continue;
    // A plain marker rather than a themed glyph: Screen deliberately does not
    // expose the theme, and `*` reads correctly in every terminal.
    screen.output(`* ${badge.name}`);
    screen.note(badge.earnedFor);
  }

  const remaining = BADGES.length - save.badges.length;
  if (remaining > 0) {
    screen.note(`${remaining} more to find.`);
  }
}

export function showArtifacts(save: SaveFile, screen: Screen): void {
  screen.heading('Things you found');
  screen.gap();

  if (save.artifacts.length === 0) {
    screen.note('Nothing yet. Go and look in some rooms.');
    return;
  }
  screen.output(save.artifacts.map((a) => `- ${a}`));
}

/**
 * An ASCII map of the world, so the child can see the shape of what they have
 * explored. Rooms they have actually stood in are marked; rooms they have only
 * seen the name of are not. That distinction is the point — the map is a record
 * of where *they* have been, which makes the world feel like a place.
 */
export async function showMap(
  world: World,
  save: SaveFile,
  currentCwd: VPath,
  screen: Screen,
): Promise<void> {
  screen.heading('CHIP’s world');
  screen.gap();

  const rooms = await world.allRooms();
  const visited = new Set(save.roomsVisited);

  const lines: string[] = ['/'];
  for (const room of rooms.sort((a, b) => a.localeCompare(b))) {
    const indent = '  '.repeat(depth(room));
    const name = basename(room);
    const here = room === currentCwd;
    const been = visited.has(room);

    // "you are here" beats any legend a child has to decode.
    const marker = here ? '  <-- you are here' : been ? '' : '   (not been in yet)';
    lines.push(`${indent}${name}/${marker}`);
  }

  screen.output(lines);

  if (save.cosmetics.length > 0) {
    screen.note(
      'In the control room: ' +
        save.cosmetics
          .map((c) => COSMETICS.get(c))
          .filter((c): c is string => Boolean(c))
          .join(', ') +
        '.',
    );
  }
}

/** Records a room as visited. Called on every move. */
export function noteVisit(save: SaveFile, room: VPath): void {
  if (!save.roomsVisited.includes(room)) save.roomsVisited.push(room);
}

/** How far through the whole curriculum the child is, for the grown-up. */
export function progressSummary(save: SaveFile, totalMissions: number): string {
  const done = Object.values(save.missions).filter((m) => m.completed).length;
  return `${done} of ${totalMissions} missions, ${save.badges.length} of ${BADGES.length} badges`;
}
