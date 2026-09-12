/**
 * Concepts are what the learner model actually tracks — finer-grained than
 * commands, because "walks into a room" and "goes back up" are learned
 * separately and forgotten separately. A child can be fluent with `cd cave`
 * and still have no idea how to get back out.
 *
 * Every concept must be taught by at least one mission and retrieved by at
 * least one *later* mission. That is checked by the mission lint, and it is
 * how "repetition with variation" stops being a good intention.
 */

export type ConceptId =
  // stage 1 — the computer listens
  | 'echo.say'
  // stage 2 — looking around
  | 'pwd.where'
  | 'ls.look'
  | 'ls.read-output'
  // stage 3 — moving around
  | 'cat.read'
  | 'cd.into'
  | 'cd.up'
  // stage 4 — creating things
  | 'mkdir.make'
  | 'touch.make'
  // stage 5 — messages and secrets
  | 'redirect.write'
  | 'redirect.append'
  | 'ls.hidden'
  // stage 6 — combining
  | 'combine.plan'
  | 'move.rename'
  // stage 7 — programs
  | 'program.run'
  | 'program.write'
  | 'program.debug'
  // stage 8 — networking
  | 'net.envelope'
  | 'net.reach'
  | 'net.name'
  | 'net.route';

export interface Concept {
  id: ConceptId;
  /** Which stage introduces it. */
  stage: number;
  /** The command word, if there is one. Used by the hint ladder. */
  command?: string;
  /** How CHIP refers to it, in the child's language. */
  metaphor: string;
  /** Concepts that must be somewhat known first. */
  needs: ConceptId[];
}

export const CONCEPTS: readonly Concept[] = [
  {
    id: 'echo.say',
    stage: 1,
    command: 'echo',
    metaphor: 'making the computer say something',
    needs: [],
  },

  { id: 'pwd.where', stage: 2, command: 'pwd', metaphor: 'asking which room we are in', needs: [] },
  { id: 'ls.look', stage: 2, command: 'ls', metaphor: 'looking around a room', needs: [] },
  {
    id: 'ls.read-output',
    stage: 2,
    metaphor: 'reading a list of what is in a room',
    needs: ['ls.look'],
  },

  {
    id: 'cat.read',
    stage: 2,
    command: 'cat',
    metaphor: 'reading what is inside something',
    needs: ['ls.look'],
  },

  { id: 'cd.into', stage: 3, command: 'cd', metaphor: 'walking into a room', needs: ['ls.look'] },
  {
    id: 'cd.up',
    stage: 3,
    command: 'cd',
    metaphor: 'going back out of a room',
    needs: ['cd.into'],
  },

  {
    id: 'mkdir.make',
    stage: 4,
    command: 'mkdir',
    metaphor: 'building a new room',
    needs: ['cd.into'],
  },
  {
    id: 'touch.make',
    stage: 4,
    command: 'touch',
    metaphor: 'making a new empty thing',
    needs: ['ls.look'],
  },

  {
    id: 'redirect.write',
    stage: 5,
    command: 'echo',
    metaphor: 'writing a message into something',
    needs: ['echo.say', 'cat.read'],
  },
  {
    id: 'redirect.append',
    stage: 5,
    command: 'echo',
    metaphor: 'adding another line to something',
    needs: ['redirect.write'],
  },
  {
    id: 'ls.hidden',
    stage: 5,
    command: 'ls',
    metaphor: 'finding things that are hidden',
    needs: ['ls.look'],
  },

  {
    id: 'combine.plan',
    stage: 6,
    metaphor: 'putting commands together to get something done',
    needs: ['mkdir.make', 'redirect.write', 'cd.into'],
  },
  {
    id: 'move.rename',
    stage: 6,
    command: 'mv',
    metaphor: 'moving something somewhere else',
    needs: ['cd.into'],
  },

  {
    id: 'program.run',
    stage: 7,
    command: 'run',
    metaphor: 'a list of instructions the computer can follow on its own',
    needs: ['cat.read'],
  },
  {
    id: 'program.write',
    stage: 7,
    metaphor: 'writing our own list of instructions',
    needs: ['program.run', 'redirect.append'],
  },
  {
    id: 'program.debug',
    stage: 7,
    metaphor: 'finding the line that went wrong',
    needs: ['program.write'],
  },

  {
    id: 'net.envelope',
    stage: 8,
    metaphor: 'a message with a from and a to on it',
    needs: ['redirect.write'],
  },
  {
    id: 'net.reach',
    stage: 8,
    command: 'ping',
    metaphor: 'checking if another computer is there',
    needs: ['net.envelope'],
  },
  {
    id: 'net.name',
    stage: 8,
    command: 'nslookup',
    metaphor: 'a computer name and its number',
    needs: ['net.reach'],
  },
  {
    id: 'net.route',
    stage: 8,
    command: 'traceroute',
    metaphor: 'the computers a message hops through on the way',
    needs: ['net.name'],
  },
];

const BY_ID = new Map(CONCEPTS.map((c) => [c.id, c]));

export function concept(id: ConceptId): Concept {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`unknown concept: ${id}`);
  return found;
}

export const ALL_CONCEPT_IDS: readonly ConceptId[] = CONCEPTS.map((c) => c.id);
