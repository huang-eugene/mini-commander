/**
 * The event spine.
 *
 * Commands know nothing about missions. They do their job and emit an event.
 * The mission runner, the learner model, the badge tracker, the journal and
 * the curiosity reactor are all just subscribers. Adding a new pedagogical
 * mechanism means adding a listener, not threading an argument through the
 * whole shell.
 */

import type { VPath } from '../shell/vpath.js';
import type { ErrorCode } from '../shell/errors.js';

export type ShellEvent =
  /** A command ran to completion. `ok` is false when it printed an error. */
  | { kind: 'command'; name: string; argv: string[]; raw: string; ok: boolean }
  /** Typed something that is not a command at all. */
  | { kind: 'unknown-command'; typed: string; nearest?: string }
  /** A command failed. The child has already seen the real error text. */
  | { kind: 'error'; command: string; code: ErrorCode; message: string }
  /** Typed a character the little language does not have. */
  | { kind: 'unsupported-syntax'; offender: string; raw: string }
  | { kind: 'cwd-changed'; from: VPath; to: VPath }
  | { kind: 'cwd-blocked'; at: VPath }
  | { kind: 'listed'; path: VPath; entries: string[]; showedHidden: boolean }
  | { kind: 'file-read'; path: VPath; text: string }
  | { kind: 'file-created'; path: VPath }
  | { kind: 'file-written'; path: VPath; appended: boolean; text: string }
  | { kind: 'dir-created'; path: VPath }
  | { kind: 'moved'; from: VPath; to: VPath; copy: boolean }
  | { kind: 'recycled'; path: VPath; ticket: string }
  | { kind: 'restored'; path: VPath }
  | { kind: 'said'; text: string }
  | { kind: 'program-run'; path: VPath; lines: number; failedLine?: number }
  | {
      kind: 'net';
      op: 'ping' | 'nslookup' | 'traceroute' | 'send';
      host: string;
      reachable: boolean;
    }
  /** One of the words only CHIP understands: help, hint, map, badges... */
  | { kind: 'chip-word'; name: string }
  /** Free prose: a prediction answer, or "no CHIP, you're wrong". */
  | { kind: 'free-text'; text: string };

export type ShellEventKind = ShellEvent['kind'];

export type Listener = (event: ShellEvent) => void;

export class EventBus {
  private readonly listeners = new Set<Listener>();
  private readonly log: ShellEvent[] = [];

  emit(event: ShellEvent): void {
    this.log.push(event);
    for (const listener of [...this.listeners]) listener(event);
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Everything emitted so far, for matchers that need a little history. */
  history(): readonly ShellEvent[] {
    return this.log;
  }

  /** How many commands the child has run — used for idle/nudge timing. */
  commandCount(): number {
    return this.log.filter((e) => e.kind === 'command' || e.kind === 'unknown-command').length;
  }
}
