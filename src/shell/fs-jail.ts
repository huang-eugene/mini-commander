/**
 * The jail. This is the one place in the codebase that touches the filesystem,
 * and the one place that decides what is reachable.
 *
 * Everything the child types funnels through `real()`. If a path cannot be
 * proven to sit inside the world root, nothing happens. There is no escape
 * hatch, no "trusted" caller, no absolute-path mode.
 *
 * The threats it is built against, each with a test in test/unit/fs-jail.test.ts:
 *
 *   1. `..` climbing above the root                 -> vpath.resolve() clamps at root
 *   2. machine-absolute paths (`/etc/passwd`, `C:\`) -> treated as world-absolute
 *   3. UNC paths (`\\?\C:\`, `\\server\share`)       -> backslashes normalised, drive stripped
 *   4. `~` expansion to the real home                -> `~` means the world root
 *   5. symlink escape                                -> realpath check AFTER resolution
 *   6. symlink creation                              -> never implemented at all
 *   7. Windows reserved device names (CON, NUL, ...) -> rejected as names
 *   8. reserved/illegal characters in names          -> rejected
 *   9. NTFS alternate data streams (`x.txt:stream`)  -> `:` rejected in names
 *  10. control characters, newlines, NUL bytes       -> rejected
 *  11. over-long names                               -> capped at MAX_NAME
 *  12. unbounded nesting                             -> capped at MAX_DEPTH
 *  13. filling the disk                              -> capped at MAX_FILES / MAX_WORLD_BYTES
 *  14. a world root that is itself a symlink         -> checked once at open()
 *  15. hard links (realpath cannot see them)         -> refuse to write through nlink > 1
 *  16. adopting a directory full of someone's files  -> marker file required at open()
 *  17. macOS NFD vs typed NFC names                  -> all names normalised to NFC
 *
 * Note what is NOT here: there is no `unlink`, and no `rmdir` that deletes.
 * `rm` is implemented in terms of `moveToRecycle`. Nothing in this game ever
 * truly destroys a file.
 */

import { promises as fs } from 'node:fs';
import * as nodePath from 'node:path';
import { ROOT, basename, depth, dirname, fromSegments, segments, type VPath } from './vpath.js';
import {
  alreadyThere,
  badName,
  isARoom,
  noSuchThing,
  notARoom,
  outsideTheWorld,
  tooBig,
  tooDeep,
  tooManyFiles,
} from './errors.js';

export const MAX_NAME = 40;
export const MAX_DEPTH = 12;
export const MAX_FILES = 2000;
export const MAX_WORLD_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_BYTES = 64 * 1024;

const WINDOWS_DEVICE_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

// `/` and `\` never reach here (vpath splits on them). The rest are either
// illegal on Windows, or meaningful to a shell in a way that would confuse.
const ILLEGAL_IN_NAME = /[<>:"|?*\u0000-\u001f\u007f]/;

export interface Entry {
  name: string;
  kind: 'room' | 'thing';
  hidden: boolean;
  bytes: number;
}

/** A single mounted world. Construct with `openWorld`. */
export class World {
  private constructor(
    /** Real, fully-resolved path of the world root. Never shown to the child. */
    readonly rootReal: string,
  ) {}

  /**
   * Opens (creating if needed) a world at `rootReal`.
   *
   * `expectedParent` is the directory the world is *allowed* to live under —
   * normally `~/.mini-commander`. If the resolved root escapes it, we refuse
   * to start rather than operate on an unknown directory. Tests pass their
   * own temp dir as both.
   */
  static async open(rootReal: string, expectedParent: string): Promise<World> {
    const existedBefore = await fs
      .readdir(rootReal)
      .then((names) => names.length > 0)
      .catch(() => false);

    await fs.mkdir(rootReal, { recursive: true });

    // realpath AFTER mkdir: if the root (or anything above it) is a symlink,
    // we want the resolved target, and we want to check *that*.
    const resolvedRoot = await fs.realpath(rootReal);
    const resolvedParent = await fs.realpath(expectedParent);

    const rel = nodePath.relative(resolvedParent, resolvedRoot);
    const inside = rel === '' || (!rel.startsWith('..') && !nodePath.isAbsolute(rel));
    if (!inside) {
      throw new Error(
        `refusing to start: the world at ${rootReal} resolves to ${resolvedRoot}, ` +
          `which is outside ${resolvedParent}`,
      );
    }

    // The likeliest route to real harm is not a clever traversal — it is the
    // game being pointed at a directory that already holds someone's files
    // (say, via MINI_COMMANDER_HOME=~/Documents) and then treating them as
    // toys. A world must be a directory this game created. The marker proves
    // it, and we refuse to adopt a populated directory that lacks one.
    const marker = nodePath.join(resolvedRoot, MARKER_FILE);
    const hasMarker = await fs
      .access(marker)
      .then(() => true)
      .catch(() => false);

    if (!hasMarker) {
      if (existedBefore) {
        throw new Error(
          `refusing to start: ${resolvedRoot} already has files in it and was not ` +
            `created by mini-commander. Point MINI_COMMANDER_HOME somewhere empty instead.`,
        );
      }
      await fs.writeFile(marker, MARKER_TEXT, 'utf8');
    }

    return new World(resolvedRoot);
  }

  /* ---- the choke point ------------------------------------------------ */

  /**
   * Maps a VPath to a real path, or refuses.
   *
   * Two checks, and both matter:
   *   - a lexical check on the joined path, which catches everything that
   *     vpath.resolve() somehow let through;
   *   - a realpath check on the nearest existing ancestor, which is what
   *     actually catches symlink escapes. We cannot realpath the target
   *     itself (it may not exist yet), so we resolve the deepest part that
   *     does exist and verify that.
   */
  async real(vpath: VPath, command: string): Promise<string> {
    const parts = segments(vpath).map((s) => s.normalize('NFC'));
    for (const name of parts) this.checkName(name, command, vpath);

    const joined = nodePath.resolve(this.rootReal, ...parts);
    if (!this.isInsideLexically(joined)) outsideTheWorld(command);

    // Walk up to the nearest thing that exists, resolve it for real, and
    // confirm the resolution did not leave the world.
    //
    // The containment check deliberately sits OUTSIDE the try: it throws a
    // ShellError, and an earlier version of this loop had it inside, where
    // its own catch swallowed the refusal and then walked up to a parent that
    // passed. That made the symlink check silently inert.
    let probe = joined;
    for (;;) {
      let resolved: string;
      try {
        resolved = await fs.realpath(probe);
      } catch {
        const parent = nodePath.dirname(probe);
        if (parent === probe) break; // hit the filesystem root; lexical check stands
        probe = parent;
        continue;
      }
      if (!this.isInsideLexically(resolved)) outsideTheWorld(command);
      break;
    }

    return joined;
  }

  /**
   * A hard link has no symlink to follow — `realpath` returns the path itself,
   * so the containment check passes while the inode is shared with a file
   * outside the world. We never create links, but a grown-up experimenting in
   * the world folder might, so refuse to write through one.
   */
  private async assertNotHardLinked(real: string, command: string): Promise<void> {
    try {
      const st = await fs.lstat(real);
      if (st.isFile() && st.nlink > 1) outsideTheWorld(command);
    } catch {
      // Does not exist yet: nothing to share an inode with.
    }
  }

  private isInsideLexically(candidate: string): boolean {
    const rel = nodePath.relative(this.rootReal, candidate);
    return rel === '' || (!rel.startsWith('..') && !nodePath.isAbsolute(rel));
  }

  /** Validates a single path segment as a usable room or thing name. */
  checkName(rawName: string, command: string, shownAs: string = rawName): void {
    // macOS stores names decomposed (NFD) while a keyboard produces composed
    // (NFC), so `café` typed by the child and `café` on disk can differ byte
    // for byte. Everything is compared in NFC.
    const name = rawName.normalize('NFC');

    if (name.length === 0) badName(command, shownAs, 'it is empty');
    if (name.length > MAX_NAME) {
      badName(command, shownAs, `names have to be shorter than ${MAX_NAME} letters`);
    }
    if (ILLEGAL_IN_NAME.test(name)) {
      badName(command, shownAs, 'it has a character that cannot go in a name');
    }
    if (name === '.' || name === '..') {
      badName(command, shownAs, 'that name means something special');
    }
    // Windows refuses these regardless of extension, so we refuse them
    // everywhere — a world built on a Mac must still open on a PC.
    const stem = (name.split('.')[0] ?? '').toLowerCase();
    if (WINDOWS_DEVICE_NAMES.has(stem)) {
      badName(command, shownAs, 'some computers keep that name for themselves');
    }
    // Trailing dots and spaces are silently dropped by Windows, which would
    // desync the save file from the disk.
    if (/[. ]$/.test(name)) {
      badName(command, shownAs, 'names cannot end with a dot or a space');
    }
  }

  /* ---- reading -------------------------------------------------------- */

  async kindOf(vpath: VPath, command: string): Promise<'room' | 'thing' | 'nothing'> {
    const real = await this.real(vpath, command);
    try {
      // lstat, not stat: a symlink should never be silently followed. We
      // never create them, but a grown-up poking at the world folder might.
      const st = await fs.lstat(real);
      if (st.isDirectory()) return 'room';
      if (st.isFile()) return 'thing';
      return 'nothing';
    } catch {
      return 'nothing';
    }
  }

  async list(vpath: VPath, command: string): Promise<Entry[]> {
    const kind = await this.kindOf(vpath, command);
    if (kind === 'nothing') noSuchThing(command, basename(vpath) || '/');
    if (kind === 'thing') notARoom(command, basename(vpath));

    const real = await this.real(vpath, command);
    const names = await fs.readdir(real);
    const entries: Entry[] = [];

    for (const name of names) {
      // The recycling bin and the world marker are CHIP's bookkeeping. They
      // stay hidden even from `ls -a`, so that the hidden-file mission has
      // exactly one interesting thing to find instead of three.
      if (name === RECYCLE_DIR || name === MARKER_FILE) continue;
      let st;
      try {
        st = await fs.lstat(nodePath.join(real, name));
      } catch {
        continue;
      }
      if (!st.isDirectory() && !st.isFile()) continue; // skip anything exotic
      entries.push({
        name,
        kind: st.isDirectory() ? 'room' : 'thing',
        hidden: name.startsWith('.'),
        bytes: st.isFile() ? st.size : 0,
      });
    }

    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    return entries;
  }

  /**
   * Raw bytes, for a file the child may have written in a REAL shell.
   *
   * The graduation missions need this: PowerShell 5.1 writes redirected
   * output as UTF-16LE with a BOM, so a utf8 read would mangle it. Decoding
   * lives in missions/graduation.ts; the jail keeps the only filesystem
   * access, which is what makes the containment claim a property of the code
   * rather than a promise.
   *
   * Returns undefined rather than throwing when it is not there, because the
   * caller is asking "did they do it yet?".
   */
  async readBytes(vpath: VPath, command: string): Promise<Buffer | undefined> {
    if ((await this.kindOf(vpath, command)) !== 'thing') return undefined;
    return fs.readFile(await this.real(vpath, command));
  }

  async read(vpath: VPath, command: string): Promise<string> {
    const kind = await this.kindOf(vpath, command);
    if (kind === 'nothing') noSuchThing(command, basename(vpath));
    if (kind === 'room') isARoom(command, basename(vpath));

    const real = await this.real(vpath, command);
    return fs.readFile(real, 'utf8');
  }

  /* ---- writing -------------------------------------------------------- */

  async makeRoom(vpath: VPath, command: string): Promise<void> {
    if (vpath === ROOT) alreadyThere(command, '/');
    if (depth(vpath) > MAX_DEPTH) tooDeep(command, MAX_DEPTH);

    const parent = dirname(vpath);
    if ((await this.kindOf(parent, command)) !== 'room') {
      noSuchThing(command, basename(parent) || '/');
    }
    if ((await this.kindOf(vpath, command)) !== 'nothing') {
      alreadyThere(command, basename(vpath));
    }
    await this.assertRoomForOneMore(command);

    await fs.mkdir(await this.real(vpath, command));
  }

  async makeEmptyThing(vpath: VPath, command: string): Promise<'created' | 'touched'> {
    if (depth(vpath) > MAX_DEPTH) tooDeep(command, MAX_DEPTH);

    const parent = dirname(vpath);
    if ((await this.kindOf(parent, command)) !== 'room') {
      noSuchThing(command, basename(parent) || '/');
    }

    const existing = await this.kindOf(vpath, command);
    if (existing === 'room') isARoom(command, basename(vpath));
    if (existing === 'thing') {
      // Real `touch` updates the timestamp and says nothing. Same here.
      const real = await this.real(vpath, command);
      const now = new Date();
      await fs.utimes(real, now, now);
      return 'touched';
    }

    await this.assertRoomForOneMore(command);
    await fs.writeFile(await this.real(vpath, command), '', 'utf8');
    return 'created';
  }

  async write(
    vpath: VPath,
    text: string,
    mode: 'replace' | 'append',
    command: string,
  ): Promise<void> {
    if (depth(vpath) > MAX_DEPTH) tooDeep(command, MAX_DEPTH);
    if (Buffer.byteLength(text, 'utf8') > MAX_FILE_BYTES) tooBig(command);

    const parent = dirname(vpath);
    if ((await this.kindOf(parent, command)) !== 'room') {
      noSuchThing(command, basename(parent) || '/');
    }

    const existing = await this.kindOf(vpath, command);
    if (existing === 'room') isARoom(command, basename(vpath));
    if (existing === 'nothing') await this.assertRoomForOneMore(command);

    const real = await this.real(vpath, command);
    await this.assertNotHardLinked(real, command);

    if (mode === 'append') {
      const current = existing === 'thing' ? await fs.readFile(real, 'utf8') : '';
      if (Buffer.byteLength(current + text, 'utf8') > MAX_FILE_BYTES) tooBig(command);
      await fs.appendFile(real, text, 'utf8');
    } else {
      await fs.writeFile(real, text, 'utf8');
    }
  }

  async copy(from: VPath, to: VPath, command: string): Promise<void> {
    const kind = await this.kindOf(from, command);
    if (kind === 'nothing') noSuchThing(command, basename(from));
    if (kind === 'room') isARoom(command, basename(from));
    if ((await this.kindOf(to, command)) === 'room') isARoom(command, basename(to));

    await this.assertRoomForOneMore(command);
    const text = await fs.readFile(await this.real(from, command), 'utf8');
    await fs.writeFile(await this.real(to, command), text, 'utf8');
  }

  async move(from: VPath, to: VPath, command: string): Promise<void> {
    const kind = await this.kindOf(from, command);
    if (kind === 'nothing') noSuchThing(command, basename(from));
    if ((await this.kindOf(to, command)) !== 'nothing') alreadyThere(command, basename(to));

    // Moving a room into itself would detach it from the world entirely.
    if (kind === 'room' && (to === from || to.startsWith(from + '/'))) {
      badName(command, basename(to), 'a room cannot be moved inside itself');
    }

    const parent = dirname(to);
    if ((await this.kindOf(parent, command)) !== 'room') {
      noSuchThing(command, basename(parent) || '/');
    }

    await fs.rename(await this.real(from, command), await this.real(to, command));
  }

  /* ---- the safe delete ------------------------------------------------ */

  /**
   * `rm` moves things here instead of deleting them, and `undo` moves them
   * back. The brief asks for "a safe simulated delete system" before real
   * deletion is ever taught; this is it, and the real one never arrives.
   */
  async moveToRecycle(vpath: VPath, command: string): Promise<string> {
    const kind = await this.kindOf(vpath, command);
    if (kind === 'nothing') noSuchThing(command, basename(vpath));
    if (vpath === ROOT) outsideTheWorld(command);

    const ticket = `${Date.now().toString(36)}-${basename(vpath)}`;
    const binReal = nodePath.join(this.rootReal, RECYCLE_DIR);
    await fs.mkdir(binReal, { recursive: true });

    const destReal = nodePath.join(binReal, ticket);
    await fs.rename(await this.real(vpath, command), destReal);
    await fs.writeFile(nodePath.join(binReal, ticket + '.from'), vpath, 'utf8');
    return ticket;
  }

  async restoreFromRecycle(ticket: string, command: string): Promise<VPath> {
    const binReal = nodePath.join(this.rootReal, RECYCLE_DIR);
    const fromFile = nodePath.join(binReal, ticket + '.from');

    const original = await fs
      .readFile(fromFile, 'utf8')
      .then((text) => text.trim())
      .catch(() => undefined);

    if (original === undefined) noSuchThing(command, ticket);

    const target = fromSegments(original.split('/'));
    if ((await this.kindOf(target, command)) !== 'nothing') {
      alreadyThere(command, basename(target));
    }

    await fs.rename(nodePath.join(binReal, ticket), await this.real(target, command));
    await fs.rm(fromFile, { force: true });
    return target;
  }

  /* ---- resource caps -------------------------------------------------- */

  private async assertRoomForOneMore(command: string): Promise<void> {
    const { files, bytes } = await this.measure();
    if (files >= MAX_FILES) tooManyFiles(command, MAX_FILES);
    if (bytes >= MAX_WORLD_BYTES) tooBig(command);
  }

  /** Counts everything in the world. Small worlds, so a full walk is fine. */
  async measure(): Promise<{ files: number; bytes: number }> {
    let files = 0;
    let bytes = 0;

    const walk = async (real: string, level: number): Promise<void> => {
      if (level > MAX_DEPTH + 2) return;
      let names: string[];
      try {
        names = await fs.readdir(real);
      } catch {
        return;
      }
      for (const name of names) {
        const child = nodePath.join(real, name);
        let st;
        try {
          st = await fs.lstat(child);
        } catch {
          continue;
        }
        files += 1;
        if (st.isFile()) bytes += st.size;
        else if (st.isDirectory()) await walk(child, level + 1);
      }
    };

    await walk(this.rootReal, 0);
    return { files, bytes };
  }

  /** Every room in the world, for the ASCII map. */
  async allRooms(): Promise<VPath[]> {
    const found: VPath[] = [];

    const walk = async (vpath: VPath, level: number): Promise<void> => {
      if (level > MAX_DEPTH) return;
      let entries: Entry[];
      try {
        entries = await this.list(vpath, 'map');
      } catch {
        return;
      }
      for (const e of entries) {
        if (e.kind !== 'room') continue;
        const child = fromSegments([...segments(vpath), e.name]);
        found.push(child);
        await walk(child, level + 1);
      }
    };

    await walk(ROOT, 0);
    return found;
  }
}

export const RECYCLE_DIR = '.recycle';

/**
 * Proof that a directory is a mini-commander world rather than someone's
 * documents folder. Written on creation, required before adopting anything
 * that already has files in it.
 */
export const MARKER_FILE = '.mini-commander-world';
export const MARKER_TEXT =
  "This folder is CHIP's world, created by the mini-commander game.\n" +
  'Everything in here belongs to the game and is safe to delete.\n';

/** Convenience for the common case: a world under `~/.mini-commander`. */
export async function openWorld(home: string): Promise<World> {
  return World.open(nodePath.join(home, 'chip-world'), home);
}
