/**
 * Driving the game from a script.
 *
 * Nothing about this game is testable without it: the state is spread across
 * a filesystem, a save file, a learner model and a mission runner, and the
 * output is prose. So the harness plays a real session against a temp world
 * and hands back the transcript as plain text.
 *
 * Determinism comes from three places: a fixed RNG seed, an injected clock,
 * and colour/glyphs forced off. Without all three, transcripts would differ
 * run to run and the goldens would be worthless.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as nodePath from 'node:path';

import { World } from '../../src/shell/fs-jail.js';
import { makeTheme } from '../../src/ui/theme.js';
import { makeScreen } from '../../src/ui/render.js';
import { makeScriptedInput } from '../../src/shell/repl.js';
import { freshSave, loadSave, type SaveFile } from '../../src/engine/save.js';
import { runSession, type SessionResult } from '../../src/session.js';
import { EventBus } from '../../src/engine/events.js';
import { makeDispatcher } from '../../src/shell/dispatch.js';
import { CHIP_WORDS } from '../../src/shell/chip-words.js';
import type { ShellState } from '../../src/shell/commands.js';
import { ROOT } from '../../src/shell/vpath.js';

export interface PlayOptions {
  /** Lines the child types, in order. */
  inputs: readonly string[];
  /** Starting save state, for testing decay, replays and fading. */
  save?: SaveFile;
  seed?: number;
  /** Fixed clock. Defaults to a constant so transcripts never drift. */
  now?: Date;
  /**
   * Where the world lives. Defaults to a fresh temp directory; supplied only
   * by the test that checks a transcript does not depend on the path's length.
   */
  home?: string;
}

export interface PlayResult {
  transcript: string;
  result: SessionResult;
  save: SaveFile;
  home: string;
  world: World;
  /** Call when done, unless you need to inspect the world afterwards. */
  cleanup(): Promise<void>;
}

const FIXED_NOW = new Date('2026-03-14T10:00:00.000Z');

export async function makeTempHome(prefix = 'mc-test-'): Promise<string> {
  return fs.mkdtemp(nodePath.join(os.tmpdir(), prefix));
}

/** Plays a whole session and returns the transcript. */
export async function play(options: PlayOptions): Promise<PlayResult> {
  const home = options.home ?? (await makeTempHome());
  const world = await World.open(nodePath.join(home, 'chip-world'), home);

  const theme = makeTheme({ colour: false, ascii: true });
  let transcript = '';
  const write = (text: string): void => {
    transcript += text;
  };

  const screen = makeScreen({ theme, write });
  const input = makeScriptedInput(options.inputs, write);

  const save = options.save ?? (await loadSave(home, options.now ?? FIXED_NOW));

  const result = await runSession({
    home,
    world,
    screen,
    input,
    save,
    seed: options.seed ?? 42,
    now: () => options.now ?? FIXED_NOW,
  });

  return {
    transcript,
    result,
    save,
    home,
    world,
    cleanup: () => fs.rm(home, { recursive: true, force: true }),
  };
}

/**
 * Runs bare commands against a world, with no mission attached. Used by the
 * mission lint to execute a step's declared solution, and by command tests.
 */
export interface ShellHarness {
  run(line: string): Promise<void>;
  bus: EventBus;
  state: ShellState;
  world: World;
  output(): string;
  cleanup(): Promise<void>;
}

export async function makeShell(startStage = 8): Promise<ShellHarness> {
  const home = await makeTempHome('mc-shell-');
  const world = await World.open(nodePath.join(home, 'chip-world'), home);

  const theme = makeTheme({ colour: false, ascii: true });
  let out = '';
  const screen = makeScreen({ theme, write: (t) => (out += t), roomy: false });

  const bus = new EventBus();
  const state: ShellState = { cwd: ROOT, stage: startStage };

  const dispatcher = makeDispatcher({
    world,
    screen,
    bus,
    state,
    chipWords: [...CHIP_WORDS],
    async onChipWord() {
      /* the lint never uses CHIP words */
    },
  });

  return {
    run: async (line) => {
      await dispatcher.submit(line);
    },
    bus,
    state,
    world,
    output: () => out,
    cleanup: () => fs.rm(home, { recursive: true, force: true }),
  };
}

export { freshSave, FIXED_NOW };

/* ---- golden transcripts --------------------------------------------- */

const TRANSCRIPT_DIR = nodePath.join(process.cwd(), 'test', 'transcripts');

/**
 * Compares a transcript to the recorded one, or records it when
 * UPDATE_TRANSCRIPTS=1. Hand-rolled rather than using node:test's snapshot
 * support, which still needs an experimental flag and has moved between
 * releases.
 *
 * The temp directory path is scrubbed, since it changes every run.
 *
 * Both spellings of it, because they are not always the same string. The jail
 * resolves its root with realpath, and on macOS os.tmpdir() sits under /var,
 * which is a symlink to /private/var — so anything the game prints from
 * `world.rootReal` carries the /private form while `home` does not. Scrubbing
 * only one of them leaves a machine-specific path in the golden.
 *
 * Note that scrubbing happens after rendering, so it can only make a path
 * stable, never its LENGTH. Nothing may print a temp path inside prose that
 * gets wrapped — see the welcome block in session.ts.
 */
export async function scrubHome(transcript: string, home: string): Promise<string> {
  const realHome = await fs.realpath(home).catch(() => home);
  // Longest first, so the /private form is replaced before its prefix is.
  const paths = [...new Set([home, realHome])].sort((a, b) => b.length - a.length);

  let scrubbed = transcript;
  for (const path of paths) scrubbed = scrubbed.split(path).join('<HOME>');
  return scrubbed;
}

export async function matchGolden(
  name: string,
  transcript: string,
  home: string,
): Promise<{ ok: boolean; expected?: string; actual: string }> {
  const scrubbed = await scrubHome(transcript, home);
  const file = nodePath.join(TRANSCRIPT_DIR, `${name}.txt`);

  if (process.env.UPDATE_TRANSCRIPTS === '1') {
    await fs.mkdir(TRANSCRIPT_DIR, { recursive: true });
    await fs.writeFile(file, scrubbed, 'utf8');
    return { ok: true, actual: scrubbed };
  }

  const expected = await fs.readFile(file, 'utf8').catch(() => undefined);
  if (expected === undefined) {
    return { ok: false, actual: scrubbed };
  }

  // Normalise line endings so a Windows checkout does not fail every golden.
  const normalise = (text: string): string => text.replace(/\r\n/g, '\n');
  return {
    ok: normalise(expected) === normalise(scrubbed),
    expected,
    actual: scrubbed,
  };
}
