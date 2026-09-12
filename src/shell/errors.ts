/**
 * Error text.
 *
 * The brief is emphatic about this: when the child makes a mistake, show them
 * the *real* error, then have CHIP ask what the computer is trying to say.
 * Errors are clues, not failures. So these strings are modelled closely on
 * what a real shell prints — same shape, same vocabulary:
 *
 *   real bash:  ls: cannot access 'cave': No such file or directory
 *   ours:       ls: cannot access 'cave': No such file or directory
 *
 * The two exceptions are the jail messages (§ SANDBOX / TOO_DEEP / TOO_BIG),
 * which have no real-shell equivalent because no real shell has a world edge.
 * Those are written plainly and kindly, and CHIP explains them.
 */

export type ErrorCode =
  | 'ENOENT' // no such file or directory
  | 'ENOTDIR' // tried to walk into something that is not a room
  | 'EISDIR' // tried to read a room as if it were a file
  | 'EEXIST' // already there
  | 'EINVAL' // the name itself is not usable
  | 'ENOTEMPTY'
  | 'UNKNOWN_COMMAND'
  | 'MISSING_ARG'
  | 'TOO_MANY_ARGS'
  | 'SANDBOX' // the edge of the world
  | 'TOO_DEEP'
  | 'TOO_BIG'
  | 'TOO_MANY_FILES'
  | 'BAD_PROGRAM';

/** A command failure that the shell prints and then emits as an event. */
export class ShellError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly command: string,
    override readonly message: string,
  ) {
    super(message);
    this.name = 'ShellError';
  }
}

// These are all `function` declarations rather than arrow consts on purpose:
// TypeScript only applies never-returning control-flow analysis to calls of
// function declarations, so `if (x === undefined) noSuchThing(...)` narrows
// `x` at the call site only in this form.
export function fail(code: ErrorCode, command: string, message: string): never {
  throw new ShellError(code, command, message);
}

/* ---- the authentic ones, shaped like real shell output ---------------- */

export function noSuchThing(cmd: string, target: string): never {
  fail('ENOENT', cmd, `${cmd}: cannot access '${target}': No such file or directory`);
}

export function notARoom(cmd: string, target: string): never {
  fail('ENOTDIR', cmd, `${cmd}: ${target}: Not a directory`);
}

export function isARoom(cmd: string, target: string): never {
  fail('EISDIR', cmd, `${cmd}: ${target}: Is a directory`);
}

export function alreadyThere(cmd: string, target: string): never {
  fail('EEXIST', cmd, `${cmd}: cannot create '${target}': File exists`);
}

export function badName(cmd: string, target: string, why: string): never {
  fail('EINVAL', cmd, `${cmd}: cannot use the name '${target}': ${why}`);
}

export function notEmpty(cmd: string, target: string): never {
  fail('ENOTEMPTY', cmd, `${cmd}: cannot remove '${target}': Directory not empty`);
}

export function needsAnArgument(cmd: string, what: string): never {
  fail('MISSING_ARG', cmd, `${cmd}: missing ${what}`);
}

export function tooManyArguments(cmd: string): never {
  fail('TOO_MANY_ARGS', cmd, `${cmd}: too many things to work on`);
}

export function unknownCommand(typed: string): string {
  return `${typed}: command not found`;
}

/* ---- the jail ones, which have no real-shell equivalent -------------- */

export function outsideTheWorld(cmd: string): never {
  fail(
    'SANDBOX',
    cmd,
    `${cmd}: that is outside CHIP's world, and CHIP's world is all we can reach`,
  );
}

export function tooDeep(cmd: string, limit: number): never {
  fail('TOO_DEEP', cmd, `${cmd}: rooms cannot be nested more than ${limit} deep`);
}

export function tooBig(cmd: string): never {
  fail('TOO_BIG', cmd, `${cmd}: that message is too long to store here`);
}

export function tooManyFiles(cmd: string, limit: number): never {
  fail('TOO_MANY_FILES', cmd, `${cmd}: CHIP's world only has room for ${limit} things`);
}
