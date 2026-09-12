/**
 * Words only CHIP understands.
 *
 * These are not shell commands and `help` says so explicitly. The distinction
 * matters: the whole promise of the game is that what the child learns works
 * in a real terminal, and quietly mixing `hint` in with `ls` would break that
 * promise in a way they would only discover later, badly.
 *
 * So `help` has two headed lists: computer words, which work anywhere, and
 * CHIP words, which only work in here.
 */

import type { Screen } from '../ui/render.js';
import { unlockedCommands } from './commands.js';

export const CHIP_WORDS = [
  'help',
  'hint',
  'map',
  'badges',
  'things',
  'clear',
  'quit',
  'exit',
  'bye',
] as const;

export type ChipWord = (typeof CHIP_WORDS)[number];

export function isChipWord(name: string): name is ChipWord {
  return (CHIP_WORDS as readonly string[]).includes(name);
}

export function showHelp(stage: number, screen: Screen): void {
  screen.heading('Words the computer knows');
  screen.note('These work in any terminal, on any computer. Not just in here.');
  screen.gap();

  for (const command of unlockedCommands(stage)) {
    screen.output(`  ${command.name.padEnd(8)} ${command.blurb}`);
  }

  screen.gap();
  screen.heading('Words only CHIP knows');
  screen.note('These are just for our control room. They are not real commands.');
  screen.gap();
  screen.output([
    '  hint     ask CHIP for a clue',
    '  map      see the whole world',
    '  badges   see what you have earned',
    '  things   see what you have found',
    '  help     this list',
    '  quit     stop for now (everything is saved)',
  ]);
  screen.gap();
  screen.note('Tip: press Tab to finish a name, and the up arrow to get a line back.');
}
