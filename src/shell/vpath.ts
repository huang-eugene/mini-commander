/**
 * Virtual paths.
 *
 * The child never sees a real filesystem path. They see `/cave/crystal.txt`.
 * The real path might be `/home/eugene/.mini-commander/chip-world/cave/crystal.txt`,
 * which is long, scary, and leaks the machine's guts.
 *
 * A VPath is always:
 *   - absolute within the world (starts with `/`)
 *   - `/`-separated, even on Windows
 *   - already normalised (no `.`, no `..`, no empty or repeated separators)
 *
 * Resolution of user input into a VPath happens here. Turning a VPath into a
 * real path on disk happens in fs-jail.ts, which is the only module allowed
 * to touch the filesystem.
 */

/** An absolute, normalised, `/`-separated path inside the world. */
export type VPath = string & { readonly __vpath: unique symbol };

export const ROOT = '/' as VPath;

/** Asserts-by-construction: the only sanctioned way to mint a VPath. */
function asVPath(normalised: string): VPath {
  return normalised as VPath;
}

/** Splits a VPath into its segments. `/` yields `[]`. */
export function segments(p: VPath): string[] {
  return p.split('/').filter((s) => s.length > 0);
}

/** Joins segments back into a VPath. */
export function fromSegments(parts: readonly string[]): VPath {
  const kept = parts.filter((s) => s.length > 0);
  return asVPath(kept.length === 0 ? '/' : '/' + kept.join('/'));
}

/** The last segment — a file or room name. `/` yields `''`. */
export function basename(p: VPath): string {
  const parts = segments(p);
  return parts.length === 0 ? '' : parts[parts.length - 1]!;
}

/** The containing room. `/` is its own parent (the world has no outside). */
export function dirname(p: VPath): VPath {
  const parts = segments(p);
  parts.pop();
  return fromSegments(parts);
}

/** True when `child` is `ancestor` or sits somewhere beneath it. */
export function contains(ancestor: VPath, child: VPath): boolean {
  if (ancestor === ROOT) return true;
  return child === ancestor || child.startsWith(ancestor + '/');
}

/** How deep a path sits. `/` is 0, `/cave` is 1. */
export function depth(p: VPath): number {
  return segments(p).length;
}

/**
 * Resolves whatever the child typed, relative to where they are standing.
 *
 * Deliberately forgiving about *shape* — backslashes, doubled slashes,
 * trailing slashes, `.` and `..` are all normalised rather than rejected,
 * because a 7-year-old's typing is messy and shape is not the lesson.
 * Deliberately unforgiving about *escape*: `..` can never climb above the
 * world root, it just stops there, and any absolute-looking input is treated
 * as world-absolute rather than machine-absolute. So `cd /etc` lands on a
 * room called `etc` inside the world (which will simply not exist), never on
 * the real `/etc`.
 */
export function resolve(cwd: VPath, input: string): VPath {
  // Windows-style separators become `/`. A child on PowerShell may well
  // type `cave\crystal.txt` because that is what they see elsewhere.
  const raw = input.replace(/\\/g, '/').trim();

  // Strip a Windows drive prefix (`C:`) so `C:\Users` cannot mean anything
  // outside the world. What is left (`/Users`) is world-absolute.
  const noDrive = raw.replace(/^[A-Za-z]:/, '');

  // `~` means "home", and the child's home is the world root.
  const homeless = noDrive === '~' || noDrive.startsWith('~/') ? noDrive.slice(1) : noDrive;

  const startFromRoot = homeless.startsWith('/');
  const parts = startFromRoot ? [] : segments(cwd);

  for (const piece of homeless.split('/')) {
    if (piece === '' || piece === '.') continue;
    if (piece === '..') {
      // Climbing at the root is a no-op, not an escape. The caller can
      // notice `resolve(ROOT, '..') === ROOT` and have CHIP say something
      // about the edge of the world.
      parts.pop();
      continue;
    }
    parts.push(piece);
  }

  return fromSegments(parts);
}

/** How a path is shown to the child: the world root reads as `/`. */
export function display(p: VPath): string {
  return p;
}
