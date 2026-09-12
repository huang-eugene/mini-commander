/**
 * One typed line in, one set of events out.
 *
 * This is where the brief's "productive mistakes" rule is implemented. When
 * something goes wrong we print the *real* error text first, unchanged, and
 * only then emit an event that lets CHIP ask what the computer was trying to
 * say. The error is never swallowed, never softened, and never pre-explained.
 */

import type { World } from './fs-jail.js';
import type { Screen } from '../ui/render.js';
import type { EventBus } from '../engine/events.js';
import { ParseProblem, nearestWord, parseLine } from './lexer.js';
import {
  COMMANDS,
  NOT_HERE,
  findCommand,
  isShellError,
  unlockedCommands,
  type CommandContext,
  type ShellState,
} from './commands.js';
import { unknownCommand } from './errors.js';

export interface Dispatcher {
  /** Runs one line. Returns false if the line was blank. */
  submit(raw: string): Promise<boolean>;
  /** Names available for tab completion and `help`. */
  vocabulary(): string[];
}

export interface DispatchOptions {
  world: World;
  screen: Screen;
  bus: EventBus;
  state: ShellState;
  /** Words only CHIP understands (hint, map, badges...). Handled upstream. */
  chipWords: readonly string[];
  /** Called for a CHIP word instead of running a command. */
  onChipWord: (name: string, argv: string[]) => Promise<void>;
  /** Called for prose that is not a command at all, e.g. a prediction. */
  onFreeText?: (text: string) => Promise<boolean>;
}

/** Prose the child might type at CHIP rather than at the computer. */
const LOOKS_LIKE_TALKING = /^(yes|yeah|no|nope|nah|wrong|maybe|dunno|i don'?t know|ok|okay)\b/i;

export function makeDispatcher(options: DispatchOptions): Dispatcher {
  const { world, screen, bus, state, chipWords, onChipWord, onFreeText } = options;

  const vocabulary = (): string[] => [
    ...unlockedCommands(state.stage).map((c) => c.name),
    ...chipWords,
  ];

  return {
    vocabulary,

    async submit(raw: string): Promise<boolean> {
      let parsed;
      try {
        parsed = parseLine(raw);
      } catch (problem) {
        if (problem instanceof ParseProblem) {
          screen.error(`${raw.trim()}: ${problem.message}`);
          bus.emit({
            kind: 'unsupported-syntax',
            offender: problem.offender ?? '',
            raw: raw.trim(),
          });
          return true;
        }
        throw problem;
      }

      if (!parsed) return false;

      // CHIP's own words first: they are not commands and must not be
      // shadowed by one.
      if (chipWords.includes(parsed.name)) {
        bus.emit({ kind: 'chip-word', name: parsed.name });
        await onChipWord(parsed.name, parsed.args);
        return true;
      }

      const command = findCommand(parsed.name, state.stage);

      if (!command) {
        // Talking to CHIP rather than to the computer. Worth catching before
        // "command not found", which would read as CHIP ignoring them.
        if (onFreeText && LOOKS_LIKE_TALKING.test(parsed.raw)) {
          const handled = await onFreeText(parsed.raw);
          if (handled) {
            bus.emit({ kind: 'free-text', text: parsed.raw });
            return true;
          }
        }

        screen.error(unknownCommand(parsed.spelling));

        const excuse = NOT_HERE[parsed.name];
        if (excuse) {
          screen.chip(excuse);
          bus.emit({ kind: 'unknown-command', typed: parsed.spelling });
          return true;
        }

        // A locked command is a real command the child has not met yet, so
        // it makes a poor suggestion — leave it out of the candidates.
        const nearest = nearestWord(parsed.name, vocabulary());
        bus.emit(
          nearest
            ? { kind: 'unknown-command', typed: parsed.spelling, nearest }
            : { kind: 'unknown-command', typed: parsed.spelling },
        );
        return true;
      }

      const ctx: CommandContext = { world, screen, bus, state };
      if (parsed.redirect) {
        // Only `echo` writes through a redirect. Anything else would need a
        // notion of piping output around, which this language does not have.
        if (command.name !== 'echo') {
          screen.error(`${command.name}: ${parsed.redirect.op} only works with echo here`);
          bus.emit({ kind: 'unsupported-syntax', offender: parsed.redirect.op, raw: parsed.raw });
          return true;
        }
        ctx.redirect = parsed.redirect;
      }

      try {
        await command.run(parsed.args, ctx);
        bus.emit({
          kind: 'command',
          name: command.name,
          argv: parsed.args,
          raw: parsed.raw,
          ok: true,
        });
      } catch (err) {
        if (!isShellError(err)) throw err;

        // The real error, verbatim and first. This is the clue.
        screen.error(err.message);
        bus.emit({ kind: 'error', command: err.command, code: err.code, message: err.message });
        bus.emit({
          kind: 'command',
          name: command.name,
          argv: parsed.args,
          raw: parsed.raw,
          ok: false,
        });
      }

      return true;
    },
  };
}

/** Every command name, locked or not — used by the mission lint. */
export const ALL_COMMAND_NAMES: readonly string[] = COMMANDS.map((c) => c.name);
