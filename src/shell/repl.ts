/**
 * Reading what the child types.
 *
 * This is behind an interface with two implementations: one wrapping Node's
 * readline for real play, one fed from a list of strings for tests. Golden
 * transcripts depend on the second, and nothing else in the game knows which
 * it is talking to.
 *
 * The typing accommodations the brief asks for come from readline itself:
 * arrow-key history and tab completion are free once the completer is wired
 * up. What we add is completion over *room and file names in the current
 * room*, which is what actually saves a 7-year-old from typing
 * `message-from-chip.txt` by hand.
 */

import * as readline from 'node:readline';
import type { World } from './fs-jail.js';
import type { ShellState } from './commands.js';
import type { VPath } from './vpath.js';
import { basename } from './vpath.js';

export interface Input {
  /** One line from the child. `undefined` means they are done (Ctrl-D). */
  line(prompt: string): Promise<string | undefined>;
  /**
   * A single keypress from a short list, for menus and predictions. Typing is
   * the hard part for this age, so anything that is not itself the lesson
   * costs one key.
   */
  choose(prompt: string, options: string[]): Promise<string>;
  close(): void;
}

export interface TerminalInputOptions {
  world: World;
  state: ShellState;
  /** Words that can be completed at the start of a line. */
  vocabulary(): string[];
  write(text: string): void;
  /** Called on the first Ctrl-C. A second one exits. */
  onInterrupt?: () => void;
  /**
   * The streams to talk over. Default to the real terminal; a test supplies
   * its own so it can drive this for real rather than reaching into `process`.
   */
  input?: NodeJS.ReadableStream & { isTTY?: boolean };
  output?: NodeJS.WritableStream;
}

export function makeTerminalInput(options: TerminalInputOptions): Input {
  const { world, state, vocabulary, write } = options;

  // Completion has to be synchronous for readline, but listing a room is
  // async. So the current room's contents are cached and refreshed after
  // every line — good enough, since the only thing that changes it is a
  // command the child just ran.
  let roomCache: string[] = [];

  const refreshCache = async (): Promise<void> => {
    try {
      roomCache = (await world.list(state.cwd, 'ls')).map((e) => e.name);
    } catch {
      roomCache = [];
    }
  };

  const completer = (line: string): [string[], string] => {
    const parts = line.split(/\s+/);
    const last = parts[parts.length - 1] ?? '';

    // First word: complete a command name.
    if (parts.length <= 1) {
      const hits = vocabulary().filter((v) => v.startsWith(last));
      return [hits.length > 0 ? hits : vocabulary(), last];
    }

    // Later words: complete a name from the current room. Also handle a
    // partial path like `cave/tor`, because the child will type those.
    const slash = last.lastIndexOf('/');
    if (slash === -1) {
      const hits = roomCache.filter((n) => n.startsWith(last));
      return [hits, last];
    }

    const prefix = last.slice(0, slash + 1);
    const stem = last.slice(slash + 1);
    return [roomCache.filter((n) => n.startsWith(stem)).map((n) => prefix + n), last];
  };

  const source = options.input ?? process.stdin;
  const sink = options.output ?? process.stdout;

  const rl = readline.createInterface({
    input: source,
    output: sink,
    completer,
    // Long enough that a child can scroll back through a whole session.
    historySize: 200,
    terminal: source.isTTY === true,
  });

  let interrupted = false;
  rl.on('SIGINT', () => {
    if (interrupted) {
      rl.close();
      return;
    }
    interrupted = true;
    options.onInterrupt?.();
    rl.prompt();
  });

  /**
   * Asks one question, resolving to undefined if the interface closes first
   * (Ctrl-D, or a second Ctrl-C).
   *
   * ONE 'close' listener for the life of the interface, not one per question.
   * Registering `rl.once('close', ...)` inside each ask added a listener that
   * was only ever removed by the close that never came, so Node printed
   *
   *   MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
   *   11 close listeners added to [Interface].
   *
   * on the eleventh line of every real session — into the middle of a
   * seven-year-old's game. Waiters are tracked here instead and released
   * together when close does arrive.
   */
  let closed = false;
  const waiting = new Set<(answer: string | undefined) => void>();

  rl.on('close', () => {
    closed = true;
    for (const release of waiting) release(undefined);
    waiting.clear();
  });

  const ask = async (prompt: string): Promise<string | undefined> => {
    if (closed) return undefined;
    return new Promise<string | undefined>((done) => {
      waiting.add(done);
      const settle = (answer: string | undefined): void => {
        waiting.delete(done);
        done(answer);
      };
      rl.question(prompt, settle);
    });
  };

  void refreshCache();

  return {
    async line(prompt) {
      const answer = await ask(prompt);

      interrupted = false;
      await refreshCache();
      return answer;
    },

    async choose(prompt, choiceList) {
      // Question first, then numbered options, so the answer is one keypress.
      write(`\n${prompt}\n\n`);
      choiceList.forEach((option, index) => write(`   ${index + 1}. ${option}\n`));
      write('\n');

      for (;;) {
        const answer = await ask(`(1-${choiceList.length}, or just press Enter) `);

        if (answer === undefined) return '';
        const trimmed = answer.trim();
        if (trimmed === '') return '';

        const index = Number.parseInt(trimmed, 10);
        if (Number.isInteger(index) && index >= 1 && index <= choiceList.length) {
          return choiceList[index - 1]!;
        }

        // Accept the text of an option too, in case they type it out.
        const matched = choiceList.find((o) => o.toLowerCase() === trimmed.toLowerCase());
        if (matched) return matched;

        write(`   Just a number from 1 to ${choiceList.length}.\n`);
      }
    },

    close() {
      rl.close();
    },
  };
}

/**
 * Drives the game from a fixed list of lines. Used by the test harness.
 *
 * It echoes the prompt and the typed answer, because a real terminal does
 * and a golden transcript that omits them is not a record of the session.
 * Without the echo, the prediction questions — the most important beat in
 * the whole design — are invisible in every transcript, and a regression
 * that stopped asking them would pass unnoticed.
 */
export function makeScriptedInput(
  lines: readonly string[],
  write?: (text: string) => void,
): Input & { remaining(): number } {
  let index = 0;
  const echo = write ?? ((): void => undefined);

  const take = (): string | undefined => (index >= lines.length ? undefined : lines[index++]!);

  return {
    async line(prompt) {
      const answer = take();
      if (answer === undefined) return undefined;
      echo(`${prompt}${answer}\n`);
      return answer;
    },

    async choose(prompt, options) {
      echo(`\n${prompt}\n\n`);
      options.forEach((option, i) => echo(`   ${i + 1}. ${option}\n`));
      echo('\n');

      const answer = take();
      if (answer === undefined) return '';
      echo(`(1-${options.length}, or just press Enter) ${answer}\n`);

      const asNumber = Number.parseInt(answer.trim(), 10);
      if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= options.length) {
        return options[asNumber - 1]!;
      }
      return answer;
    },

    close() {
      index = lines.length;
    },

    remaining() {
      return Math.max(0, lines.length - index);
    },
  };
}

/** The prompt string. Short, and it shows where they are standing. */
export function promptFor(cwd: VPath): string {
  const here = basename(cwd);
  const label = here === '' ? '/' : here;
  return `${label} > `;
}
