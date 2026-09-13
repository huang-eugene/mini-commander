/**
 * Spells — stage 7's "programs are stored instructions".
 *
 * A spell is a plain text file with one command per line. The child writes
 * one using `echo >>`, which is exactly the skill from stage 5, and runs it
 * with `run`. Nothing about the format is new; the only new idea is that the
 * instructions can be kept and replayed.
 *
 * Why not a real .sh or .ps1: it would need a shell, which means a second
 * execution path with its own safety boundary, and it would not be the same
 * file on Windows and macOS. A spell goes through the same parser and the
 * same jail as anything the child types, so there is exactly one way for a
 * command to run in this game. The real thing arrives in the graduation
 * mission, with a grown-up.
 *
 * Execution is visible and paced on purpose. Each line is echoed before it
 * runs, because watching the computer work through a list in order IS the
 * lesson, and because it makes a failure land on a specific line the child
 * can go and look at.
 */

import { parseLine } from './lexer.js';
import type { Screen } from '../ui/render.js';
import type { EventBus } from '../engine/events.js';
import type { World } from './fs-jail.js';
import type { VPath } from './vpath.js';

export const SPELL_SUFFIX = '.spell';

/** Caps, so a runaway spell cannot fill the disk or spin forever. */
export const MAX_SPELL_LINES = 20;
export const MAX_SPELL_STEPS = 50;

export interface SpellLine {
  /** 1-based, so it matches what the child counts when they look at the file. */
  number: number;
  text: string;
}

export interface SpellResult {
  ran: number;
  failedLine?: number;
}

/** Strips comments and blank lines, keeping the original line numbers. */
export function readSpell(text: string): SpellLine[] {
  return text
    .split('\n')
    .map((raw, index) => ({ number: index + 1, text: raw.trim() }))
    .filter((line) => line.text.length > 0 && !line.text.startsWith('#'));
}

export interface RunSpellOptions {
  world: World;
  screen: Screen;
  bus: EventBus;
  path: VPath;
  /** Runs one line exactly as if the child had typed it. */
  submit(line: string): Promise<boolean>;
  /** True when the last submitted line failed. */
  lastFailed(): boolean;
}

/**
 * The command word as the dispatcher will see it, or undefined when the line
 * does not parse. A line that will not parse cannot be a `run`, and letting it
 * through means the child gets the lexer's real error about what they actually
 * typed, which is the better message.
 */
function commandWordOf(line: string): string | undefined {
  try {
    return parseLine(line)?.name;
  } catch {
    return undefined;
  }
}

/**
 * Depth, not a boolean, purely so the invariant is stated as what it is: a
 * spell never runs while a spell is running.
 *
 * The check above is the one that produces a good error, pointing at the line
 * the child can go and count to. This is the backstop that makes the claim
 * structural — it holds no matter what the lexer, the command table, or a
 * future `run`-like command does, which the previous string comparison did
 * not.
 */
let depth = 0;

export async function runSpell(options: RunSpellOptions): Promise<SpellResult> {
  const { screen, bus, path } = options;

  if (depth > 0) {
    screen.error('run: a spell cannot run another spell');
    bus.emit({ kind: 'program-run', path, lines: 0, failedLine: 1 });
    return { ran: 0, failedLine: 1 };
  }

  depth += 1;
  try {
    return await runSpellLines(options);
  } finally {
    depth -= 1;
  }
}

async function runSpellLines(options: RunSpellOptions): Promise<SpellResult> {
  const { world, screen, bus, path, submit, lastFailed } = options;

  const text = await world.read(path, 'run');
  const lines = readSpell(text);

  if (lines.length === 0) {
    screen.note('That spell has nothing in it yet.');
    bus.emit({ kind: 'program-run', path, lines: 0 });
    return { ran: 0 };
  }

  if (lines.length > MAX_SPELL_LINES) {
    screen.error(`run: that spell is longer than ${MAX_SPELL_LINES} lines`);
    bus.emit({ kind: 'program-run', path, lines: lines.length, failedLine: MAX_SPELL_LINES + 1 });
    return { ran: 0, failedLine: MAX_SPELL_LINES + 1 };
  }

  let ran = 0;

  for (const line of lines) {
    if (ran >= MAX_SPELL_STEPS) break;

    // A spell may not call another spell. No recursion means no cycles, no
    // depth limit to explain, and no way to hang the game.
    //
    // Ask the LEXER what the command word is, rather than splitting the raw
    // text. Splitting compared the line as typed, so `"run" other.spell` read
    // as `"run"` here and did not match — while the lexer stripped the quotes
    // and the dispatcher ran it as `run`. One spell calling itself that way
    // recursed without limit (MAX_SPELL_STEPS is per invocation) until the
    // game hung. There is exactly one parser in this game and this check now
    // uses it.
    if (commandWordOf(line.text) === 'run') {
      screen.error(`run: line ${line.number}: a spell cannot run another spell`);
      bus.emit({ kind: 'program-run', path, lines: lines.length, failedLine: line.number });
      return { ran, failedLine: line.number };
    }

    // Echo the line before running it. The visible sequencing is the lesson.
    screen.output(`  ${line.number}  ${line.text}`);
    await submit(line.text);
    ran += 1;

    if (lastFailed()) {
      // Stop where it broke, and say which line. That number is what makes
      // the failure findable: the child can open the spell and count to it.
      screen.error(`run: stopped at line ${line.number}`);
      bus.emit({ kind: 'program-run', path, lines: lines.length, failedLine: line.number });
      return { ran, failedLine: line.number };
    }
  }

  bus.emit({ kind: 'program-run', path, lines: lines.length });
  return { ran };
}
