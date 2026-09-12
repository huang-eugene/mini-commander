/**
 * The command line.
 *
 * `npx mini-commander` starts a session. The other subcommands are for the
 * grown-up: the facilitator guide, the journal, and a reset.
 */

import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as nodePath from 'node:path';

import { openWorld } from './shell/fs-jail.js';
import { detectThemeOptions, makeTheme, type ThemeName } from './ui/theme.js';
import { makeScreen } from './ui/render.js';
import { makeScriptedInput, makeTerminalInput } from './shell/repl.js';
import { loadSave, writeSave } from './engine/save.js';
import { runSession } from './session.js';
import { GROWN_UP_GUIDE } from './grown-ups.js';
import { MISSIONS } from './missions/registry.js';
import { progressSummary } from './engine/progress.js';
import type { ShellState } from './shell/commands.js';
import { ROOT } from './shell/vpath.js';

const USAGE = `
mini-commander — a terminal adventure for a 7-year-old

  npx mini-commander              play (this is the one you want)
  npx mini-commander grown-ups    how to sit with your child
  npx mini-commander journal      what happened in past sessions
  npx mini-commander reset        start the world over (asks first)

Options
  --theme <name>    default, high-contrast or mono
  --no-color        no colour at all
  --ascii           plain characters only (for older Windows consoles)
  --speak           read CHIP's lines aloud, if the computer can
  --self-check      play a scripted mission and exit (used by CI)
  --help
`;

export function homeDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.MINI_COMMANDER_HOME ?? nodePath.join(os.homedir(), '.mini-commander');
}

export async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      theme: { type: 'string' },
      'no-color': { type: 'boolean' },
      ascii: { type: 'boolean' },
      speak: { type: 'boolean' },
      'self-check': { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });

  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  const home = homeDir();
  const command = positionals[0] ?? 'play';

  if (command === 'grown-ups' || command === 'grownups' || command === 'parents') {
    process.stdout.write(GROWN_UP_GUIDE.replace('{{HOME}}', home));
    return 0;
  }

  if (command === 'journal') {
    return showJournal(home);
  }

  if (command === 'reset') {
    return resetWorld(home);
  }

  if (values['self-check']) {
    return selfCheck();
  }

  if (command !== 'play') {
    process.stderr.write(`Unknown command: ${command}\n${USAGE}`);
    return 1;
  }

  return play(home, {
    theme: values.theme as ThemeName | undefined,
    noColor: values['no-color'] === true,
    ascii: values.ascii === true,
    speak: values.speak === true,
  });
}

interface PlayOptions {
  theme?: ThemeName;
  noColor: boolean;
  ascii: boolean;
  speak: boolean;
}

async function play(home: string, options: PlayOptions): Promise<number> {
  await fs.mkdir(home, { recursive: true });

  const save = await loadSave(home);
  if (options.theme) save.prefs.theme = options.theme;
  if (options.ascii) save.prefs.ascii = true;
  if (options.speak) save.prefs.speak = true;

  const detected = detectThemeOptions(process.env, process.stdout.isTTY === true);
  const theme = makeTheme({
    name: save.prefs.theme,
    colour: options.noColor ? false : detected.colour,
    ascii: save.prefs.ascii || detected.ascii === true,
  });

  const screen = makeScreen({ theme, write: (text) => process.stdout.write(text) });
  const world = await openWorld(home);

  const state: ShellState = { cwd: ROOT, stage: save.stage };
  const input = makeTerminalInput({
    world,
    state,
    vocabulary: () => [],
    write: (text) => process.stdout.write(text),
    onInterrupt: () => {
      screen.gap();
      screen.chip('Want a break? Type quit, or press Ctrl-C again.');
    },
  });

  try {
    await runSession({ home, world, screen, input, save });
  } finally {
    input.close();
  }

  return 0;
}

/**
 * Boots a throwaway world and plays the first mission from a script. Proves
 * the whole stack works on this machine — used by CI on all three platforms,
 * and by anyone who wants to check an install without handing the computer
 * to a child first.
 */
async function selfCheck(): Promise<number> {
  const temp = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'mini-commander-check-'));

  try {
    const theme = makeTheme({ colour: false, ascii: true });
    let out = '';
    const screen = makeScreen({ theme, write: (text) => (out += text), roomy: false });

    const world = await openWorld(temp);
    const save = await loadSave(temp);

    // Mission 1 asks for a prediction, then two echoes.
    const input = makeScriptedInput(
      ['1', 'echo hello', 'echo Explorer', ''],
      (text) => (out += text),
    );

    const result = await runSession({ home: temp, world, screen, input, save, seed: 42 });

    if (!result.completed) {
      process.stderr.write('self-check FAILED: the first mission did not complete\n');
      process.stderr.write(out);
      return 1;
    }

    if (!out.includes('THE COMPUTER LISTENED')) {
      process.stderr.write('self-check FAILED: no celebration in the transcript\n');
      process.stderr.write(out);
      return 1;
    }

    process.stdout.write(`self-check OK (${MISSIONS.length} missions loaded)\n`);
    return 0;
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}

async function showJournal(home: string): Promise<number> {
  const file = nodePath.join(home, 'journal.md');
  try {
    process.stdout.write(await fs.readFile(file, 'utf8'));
  } catch {
    process.stdout.write('No sessions yet.\n');
    return 0;
  }

  const save = await loadSave(home);
  process.stdout.write(`\n${progressSummary(save, MISSIONS.length)}\n`);
  return 0;
}

/**
 * Resets the world but keeps the badges. Losing a 7-year-old's badges because
 * a grown-up wanted a tidy folder is not a trade worth offering, so this
 * takes the world back to the start and leaves the record of what they did.
 */
async function resetWorld(home: string): Promise<number> {
  const worldDir = nodePath.join(home, 'chip-world');
  const backup = `${worldDir}-old-${Date.now()}`;

  const exists = await fs
    .access(worldDir)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    process.stdout.write('There is no world to reset yet.\n');
    return 0;
  }

  await fs.rename(worldDir, backup);

  const save = await loadSave(home);
  save.missions = {};
  save.roomsVisited = [];
  save.stage = 1;
  // Badges, artifacts, cosmetics and the learner model all survive on purpose.
  await writeSave(home, save);

  process.stdout.write(
    `The world is fresh again.\nThe old one is still here if you want it: ${backup}\n` +
      'Badges and progress were kept.\n',
  );
  return 0;
}
