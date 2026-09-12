/**
 * The commands.
 *
 * Each one does exactly what its real counterpart does, prints what a real
 * shell would print, and emits an event. Commands never reference missions,
 * badges, or hints.
 *
 * `unlockedAt` is the stage from which a command exists at all. Before that,
 * typing it gives "command not found" — the same answer a real shell gives
 * for a program you have not installed. This keeps the vocabulary small
 * enough for a 7-year-old to hold in their head, and it means the child
 * discovers commands rather than being handed a list of thirty.
 */

import type { World } from './fs-jail.js';
import type { Screen } from '../ui/render.js';
import type { EventBus } from '../engine/events.js';
import { ROOT, basename, resolve, type VPath } from './vpath.js';
import { needsAnArgument, noSuchThing, notARoom, tooManyArguments, ShellError } from './errors.js';

export interface ShellState {
  cwd: VPath;
  /** Highest stage the child has reached; gates the vocabulary. */
  stage: number;
}

export interface CommandContext {
  world: World;
  screen: Screen;
  bus: EventBus;
  state: ShellState;
  /** Set when the line ended in `> file` or `>> file`. */
  redirect?: { op: '>' | '>>'; target: string };
}

export interface Command {
  name: string;
  /** One short line for `help`, written for a 7-year-old. */
  blurb: string;
  /** The metaphor, used by CHIP and the hint ladder. */
  metaphor: string;
  unlockedAt: number;
  run(argv: string[], ctx: CommandContext): Promise<void>;
}

/* ------------------------------------------------------------------ */

const echo: Command = {
  name: 'echo',
  blurb: 'make the computer say something back',
  metaphor: 'talking to the computer',
  unlockedAt: 1,
  async run(argv, ctx) {
    const text = argv.join(' ');

    if (ctx.redirect) {
      const target = resolve(ctx.state.cwd, ctx.redirect.target);
      const mode = ctx.redirect.op === '>>' ? 'append' : 'replace';
      // A real shell adds the newline, so we do too. Without it, appending
      // twice would run the two messages together and the child would think
      // the second one had overwritten the first.
      await ctx.world.write(target, text + '\n', mode, 'echo');
      ctx.bus.emit({
        kind: 'file-written',
        path: target,
        appended: mode === 'append',
        text,
      });
      return;
    }

    ctx.screen.output(text);
    ctx.bus.emit({ kind: 'said', text });
  },
};

const pwd: Command = {
  name: 'pwd',
  blurb: 'ask the computer which room you are in',
  metaphor: 'which room am I in',
  unlockedAt: 2,
  async run(argv, ctx) {
    if (argv.length > 0) tooManyArguments('pwd');
    ctx.screen.output(ctx.state.cwd);
  },
};

const ls: Command = {
  name: 'ls',
  blurb: 'look around the room you are in',
  metaphor: 'looking around',
  unlockedAt: 2,
  async run(argv, ctx) {
    const flags = argv.filter((a) => a.startsWith('-'));
    const rest = argv.filter((a) => !a.startsWith('-'));
    if (rest.length > 1) tooManyArguments('ls');

    const showHidden = flags.some((f) => f.includes('a'));
    const target = rest[0] ? resolve(ctx.state.cwd, rest[0]) : ctx.state.cwd;

    const entries = await ctx.world.list(target, 'ls');
    const visible = showHidden ? entries : entries.filter((e) => !e.hidden);

    if (visible.length === 0) {
      // Real `ls` prints nothing at all here. That silence is genuinely
      // confusing for a child ("is it broken?"), so CHIP fills it in rather
      // than the command lying about what it found.
      ctx.screen.note('(nothing here)');
    } else {
      // Rooms get a trailing slash, exactly as real `ls` does with -F. It is
      // the first visual distinction between "a place" and "a thing", and the
      // child picks it up without being told.
      ctx.screen.output(visible.map((e) => (e.kind === 'room' ? e.name + '/' : e.name)));
    }

    ctx.bus.emit({
      kind: 'listed',
      path: target,
      entries: visible.map((e) => e.name),
      showedHidden: showHidden,
    });
  },
};

const cd: Command = {
  name: 'cd',
  blurb: 'walk into a room',
  metaphor: 'walking into a room',
  unlockedAt: 3,
  async run(argv, ctx) {
    if (argv.length > 1) tooManyArguments('cd');

    // Bare `cd` goes home, like a real shell. Home is the world root.
    const wanted = argv[0] ?? '/';
    const target = resolve(ctx.state.cwd, wanted);

    // Trying to climb above the root: the resolver clamps rather than
    // escaping, so we detect it as "nothing moved" on an upward request.
    if (wanted.includes('..') && target === ctx.state.cwd && ctx.state.cwd === ROOT) {
      ctx.bus.emit({ kind: 'cwd-blocked', at: ctx.state.cwd });
      ctx.screen.error('cd: this is as far up as CHIP can go');
      return;
    }

    const kind = await ctx.world.kindOf(target, 'cd');
    if (kind === 'nothing') noSuchThing('cd', wanted);
    if (kind === 'thing') notARoom('cd', wanted);

    const from = ctx.state.cwd;
    ctx.state.cwd = target;
    ctx.bus.emit({ kind: 'cwd-changed', from, to: target });
  },
};

const cat: Command = {
  name: 'cat',
  blurb: 'read what is written inside something',
  metaphor: 'reading',
  // Stage 2, not 5. The brief's own opening mission reads a file straight
  // away, and a message you found but cannot open is a much better hook than
  // one you have to wait three stages for. Stage 5 then covers *writing*.
  unlockedAt: 2,
  async run(argv, ctx) {
    if (argv.length === 0) needsAnArgument('cat', 'the name of something to read');
    if (argv.length > 1) tooManyArguments('cat');

    const target = resolve(ctx.state.cwd, argv[0]!);
    const text = await ctx.world.read(target, 'cat');

    const lines = text.split('\n');
    // A trailing newline produces a final empty element; real `cat` does not
    // print an extra blank line for it.
    if (lines[lines.length - 1] === '') lines.pop();

    if (lines.length === 0) ctx.screen.note('(this one is empty)');
    else ctx.screen.output(lines);

    ctx.bus.emit({ kind: 'file-read', path: target, text });
  },
};

const mkdir: Command = {
  name: 'mkdir',
  blurb: 'build a new room',
  metaphor: 'building a room',
  unlockedAt: 4,
  async run(argv, ctx) {
    if (argv.length === 0) needsAnArgument('mkdir', 'a name for the new room');

    for (const name of argv) {
      const target = resolve(ctx.state.cwd, name);
      await ctx.world.makeRoom(target, 'mkdir');
      ctx.bus.emit({ kind: 'dir-created', path: target });
    }
  },
};

const touch: Command = {
  name: 'touch',
  blurb: 'make a new empty thing',
  metaphor: 'making an empty thing',
  unlockedAt: 4,
  async run(argv, ctx) {
    if (argv.length === 0) needsAnArgument('touch', 'a name for the new thing');

    for (const name of argv) {
      const target = resolve(ctx.state.cwd, name);
      const what = await ctx.world.makeEmptyThing(target, 'touch');
      if (what === 'created') ctx.bus.emit({ kind: 'file-created', path: target });
    }
  },
};

const cp: Command = {
  name: 'cp',
  blurb: 'make a copy of something',
  metaphor: 'copying',
  unlockedAt: 6,
  async run(argv, ctx) {
    if (argv.length < 2) needsAnArgument('cp', 'what to copy, and what to call the copy');
    if (argv.length > 2) tooManyArguments('cp');

    const from = resolve(ctx.state.cwd, argv[0]!);
    const to = resolve(ctx.state.cwd, argv[1]!);
    await ctx.world.copy(from, to, 'cp');
    ctx.bus.emit({ kind: 'moved', from, to, copy: true });
  },
};

const mv: Command = {
  name: 'mv',
  blurb: 'move something somewhere else, or rename it',
  metaphor: 'moving',
  unlockedAt: 6,
  async run(argv, ctx) {
    if (argv.length < 2) needsAnArgument('mv', 'what to move, and where to put it');
    if (argv.length > 2) tooManyArguments('mv');

    const from = resolve(ctx.state.cwd, argv[0]!);
    let to = resolve(ctx.state.cwd, argv[1]!);

    // `mv note.txt cave` means "into cave", not "rename to cave", when cave
    // is a room. Matching real `mv` here avoids a baffling surprise.
    if ((await ctx.world.kindOf(to, 'mv')) === 'room') {
      to = resolve(to, basename(from));
    }

    await ctx.world.move(from, to, 'mv');
    ctx.bus.emit({ kind: 'moved', from, to, copy: false });
  },
};

const rm: Command = {
  name: 'rm',
  blurb: 'put something in the recycling (you can get it back)',
  metaphor: 'recycling',
  unlockedAt: 6,
  async run(argv, ctx) {
    if (argv.length === 0) needsAnArgument('rm', 'the name of something to recycle');
    if (argv.length > 1) tooManyArguments('rm');

    const target = resolve(ctx.state.cwd, argv[0]!);
    const ticket = await ctx.world.moveToRecycle(target, 'rm');

    ctx.bus.emit({ kind: 'recycled', path: target, ticket });
    // Real `rm` is silent and permanent. Ours is neither, and saying so out
    // loud is the whole point: nothing in CHIP's world is ever really lost.
    ctx.screen.note(`${basename(target)} is in the recycling. Type undo to get it back.`);
  },
};

const undo: Command = {
  name: 'undo',
  blurb: 'get back the last thing you recycled',
  metaphor: 'un-recycling',
  unlockedAt: 6,
  async run(argv, ctx) {
    if (argv.length > 0) tooManyArguments('undo');

    const recent = [...ctx.bus.history()]
      .reverse()
      .find((e): e is Extract<typeof e, { kind: 'recycled' }> => e.kind === 'recycled');

    if (!recent) {
      ctx.screen.error('undo: there is nothing in the recycling');
      return;
    }

    const restored = await ctx.world.restoreFromRecycle(recent.ticket, 'undo');
    ctx.bus.emit({ kind: 'restored', path: restored });
    ctx.screen.note(`${basename(restored)} is back.`);
  },
};

/* ------------------------------------------------------------------ */

export const COMMANDS: readonly Command[] = [
  echo,
  pwd,
  ls,
  cd,
  cat,
  mkdir,
  touch,
  cp,
  mv,
  rm,
  undo,
];

const BY_NAME = new Map(COMMANDS.map((c) => [c.name, c]));

/** Commands the child has met so far, for `help` and tab completion. */
export function unlockedCommands(stage: number): Command[] {
  return COMMANDS.filter((c) => c.unlockedAt <= stage);
}

export function findCommand(name: string, stage: number): Command | undefined {
  const command = BY_NAME.get(name);
  if (!command || command.unlockedAt > stage) return undefined;
  return command;
}

/**
 * Commands that exist in a real shell, are genuinely dangerous, and are
 * deliberately not implemented. Typing one gets "command not found" plus a
 * word from CHIP — never a lecture, and never a suggestion to try it.
 */
export const NOT_HERE: Record<string, string> = {
  sudo: 'that one asks the computer for special powers. We do not need them.',
  rmdir: 'CHIP uses rm for that, and rm here only recycles.',
  chmod: 'that changes who is allowed to touch things. Not today.',
  kill: 'that stops programs. Nothing here needs stopping.',
  del: 'CHIP calls that one rm.',
  dir: 'CHIP calls that one ls.',
  cls: 'CHIP calls that one clear.',
  type: 'CHIP calls that one cat.',
};

export const isShellError = (e: unknown): e is ShellError => e instanceof ShellError;
