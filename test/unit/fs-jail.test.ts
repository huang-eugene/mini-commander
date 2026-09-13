/**
 * The containment proof.
 *
 * Every entry in HOSTILE must either be refused or land inside the world.
 * There is no third acceptable outcome. If this file is green, a child cannot
 * reach the real machine through any path the shell accepts.
 *
 * The second half of the file checks the same property from the other side:
 * an instrumented walk of the temp directory confirms nothing was written
 * outside it, which catches a future command that somehow skips the jail.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as nodePath from 'node:path';

import { World, MARKER_FILE, MAX_FILE_BYTES, MAX_WORLD_BYTES } from '../../src/shell/fs-jail.js';
import { ROOT, resolve, type VPath } from '../../src/shell/vpath.js';
import { ShellError } from '../../src/shell/errors.js';

async function freshWorld(): Promise<{ world: World; home: string; root: string }> {
  const home = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'mc-jail-'));
  const root = nodePath.join(home, 'chip-world');
  const world = await World.open(root, home);
  return { world, home, root: await fs.realpath(root) };
}

/**
 * Inputs a child could plausibly type, plus everything a determined adult
 * might try. Grouped by the threat they represent.
 */
const HOSTILE: readonly string[] = [
  // climbing out
  '..',
  '../..',
  '../../../../../../../../etc/passwd',
  'cave/../../..',
  'a/b/../../../../..',
  './../..',
  // machine-absolute
  '/etc/passwd',
  '/etc/shadow',
  '/root/.ssh/id_rsa',
  '/Users/someone/Documents',
  'C:\\Windows\\System32',
  'C:/Windows/System32',
  'D:\\',
  'C:relative',
  // UNC and device namespaces
  '\\\\server\\share',
  '//server/share',
  '\\\\?\\C:\\Windows',
  '\\\\.\\PhysicalDrive0',
  // home expansion
  '~',
  '~/',
  '~/.ssh',
  '~root',
  '~/../../etc',
  // separators mixed
  'cave\\..\\..\\..',
  'a/b\\..\\..\\..\\..',
  // windows reserved device names
  'CON',
  'con',
  'NUL',
  'nul.txt',
  'AUX',
  'COM1',
  'LPT1',
  'PRN.log',
  // alternate data streams / illegal characters
  'note.txt:secret',
  'a:b',
  'we<ird',
  'we>ird',
  'pi|pe',
  'quo"te',
  'sta*r',
  'quest?ion',
  // trailing dots and spaces (silently stripped by Windows)
  'trailing.',
  'trailing ',
  'trailing. ',
  // control characters
  'null\u0000byte',
  'bell\u0007',
  'newline\nhere',
  'tab\there',
  'del\u007f',
  // absurd lengths
  'x'.repeat(41),
  'x'.repeat(5000),
];

test('every hostile path is refused or contained', async () => {
  const { world, root } = await freshWorld();

  for (const input of HOSTILE) {
    const vpath = resolve(ROOT, input);

    // First invariant: resolution never produces a path that leaves the world.
    assert.ok(
      vpath.startsWith('/'),
      `resolve() produced a non-absolute vpath for ${JSON.stringify(input)}: ${vpath}`,
    );
    assert.ok(
      !vpath.includes('..'),
      `resolve() left a .. segment for ${JSON.stringify(input)}: ${vpath}`,
    );

    // Second invariant: real() either throws a ShellError, or returns a real
    // path underneath the world root. Never anything else, and never a throw
    // of some other kind.
    let real: string | undefined;
    try {
      real = await world.real(vpath, 'test');
    } catch (err) {
      assert.ok(
        err instanceof ShellError,
        `real() threw a non-ShellError for ${JSON.stringify(input)}: ${String(err)}`,
      );
      continue;
    }

    const rel = nodePath.relative(root, real);
    assert.ok(
      rel === '' || (!rel.startsWith('..') && !nodePath.isAbsolute(rel)),
      `real() escaped the world for ${JSON.stringify(input)}: ${real}`,
    );
  }
});

test('a hostile path never writes anything outside the world', async () => {
  const { world, home, root } = await freshWorld();

  for (const input of HOSTILE) {
    const vpath = resolve(ROOT, input);
    // Try every mutating operation. Each must either refuse, or act strictly
    // inside the world. Some of these legitimately succeed: `mkdir /etc`
    // builds a room called `etc` in CHIP's world, which is the intended
    // reading of a machine-absolute path and is entirely harmless.
    for (const attempt of [
      () => world.makeRoom(vpath, 'mkdir'),
      () => world.makeEmptyThing(vpath, 'touch'),
      () => world.write(vpath, 'pwned', 'replace', 'echo'),
    ]) {
      await attempt().catch((err) => {
        assert.ok(err instanceof ShellError, `unexpected error type: ${String(err)}`);
      });
    }
  }

  // The real invariant: the world's parent directory gained nothing. If any
  // hostile path had escaped, it would have landed here or higher.
  const siblings = await fs.readdir(home);
  assert.deepEqual(siblings, ['chip-world'], 'something was written outside the world');

  // And every single thing that did get created sits under the world root.
  const strays: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const name of await fs.readdir(dir)) {
      const child = nodePath.join(dir, name);
      const rel = nodePath.relative(root, child);
      if (rel.startsWith('..') || nodePath.isAbsolute(rel)) strays.push(child);
      const st = await fs.lstat(child);
      if (st.isDirectory()) await walk(child);
    }
  };
  await walk(root);
  assert.deepEqual(strays, [], 'these paths escaped the world root');

  // The marker survived all of it — nothing clobbered the proof of ownership.
  assert.ok(
    (await fs.readdir(root)).includes(MARKER_FILE),
    'the world marker must not be destroyable from inside the game',
  );
});

test('machine-absolute paths are read as world-absolute, not as the real disk', async () => {
  const { world, root } = await freshWorld();

  // This is the intended behaviour, and it is what makes `cd /etc` safe:
  // the child lands on a room called `etc` that does not exist, gets the
  // ordinary "No such file or directory", and learns something.
  assert.equal(resolve(ROOT, '/etc/passwd'), '/etc/passwd');

  await world.makeRoom(resolve(ROOT, '/etc'), 'mkdir');
  assert.ok(
    await fs.stat(nodePath.join(root, 'etc')).then(
      () => true,
      () => false,
    ),
    'it should have been created inside the world',
  );
  assert.equal(await world.kindOf(resolve(ROOT, '/etc/passwd'), 'cat'), 'nothing');
});

test('cd .. at the root stays at the root instead of escaping', () => {
  assert.equal(resolve(ROOT, '..'), ROOT);
  assert.equal(resolve(ROOT, '../../..'), ROOT);
  assert.equal(resolve('/cave' as VPath, '..'), ROOT);
  assert.equal(resolve('/cave/deep' as VPath, '../..'), ROOT);
});

test('a symlink pointing out of the world is refused', async (t) => {
  if (process.platform === 'win32') {
    t.skip('symlink creation needs elevation on Windows');
    return;
  }

  const { world, root } = await freshWorld();
  const secretDir = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'mc-secret-'));
  await fs.writeFile(nodePath.join(secretDir, 'treasure.txt'), 'top secret', 'utf8');

  // A grown-up (or a stray process) creates an escape hatch inside the world.
  await fs.symlink(secretDir, nodePath.join(root, 'hatch'));

  await assert.rejects(
    () => world.read(resolve(ROOT, 'hatch/treasure.txt'), 'cat'),
    (err: unknown) => err instanceof ShellError && err.code === 'SANDBOX',
    'reading through a symlink out of the world should be refused',
  );

  // And it is not listed as a room or a thing, because lstat says neither.
  const entries = await world.list(ROOT, 'ls');
  assert.equal(
    entries.find((e) => e.name === 'hatch'),
    undefined,
    'a symlink should not appear as a room or a thing',
  );
});

test('a world root that is itself a symlink is resolved, not rejected', async (t) => {
  if (process.platform === 'win32') {
    t.skip('symlink creation needs elevation on Windows');
    return;
  }

  // macOS puts /tmp behind a symlink to /private/tmp, so this is the normal
  // case there, not an edge case. It must work.
  const home = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'mc-link-'));
  const actual = nodePath.join(home, 'actual-world');
  const link = nodePath.join(home, 'chip-world');
  await fs.mkdir(actual);
  await fs.symlink(actual, link);

  const world = await World.open(link, home);
  await world.makeRoom(resolve(ROOT, 'cave'), 'mkdir');

  assert.ok(
    await fs.stat(nodePath.join(actual, 'cave')).then(
      () => true,
      () => false,
    ),
    'the room should have been created through the symlinked root',
  );
});

test('refuses to adopt a directory it did not create', async () => {
  const home = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'mc-adopt-'));
  const root = nodePath.join(home, 'chip-world');
  await fs.mkdir(root);
  await fs.writeFile(nodePath.join(root, 'tax-return-2025.pdf'), 'important', 'utf8');

  await assert.rejects(
    () => World.open(root, home),
    /already has files in it/,
    'a populated directory without a marker must not become a world',
  );

  // The file is untouched.
  assert.equal(await fs.readFile(nodePath.join(root, 'tax-return-2025.pdf'), 'utf8'), 'important');
});

test('refuses a world that resolves outside its expected parent', async (t) => {
  if (process.platform === 'win32') {
    t.skip('symlink creation needs elevation on Windows');
    return;
  }

  const home = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'mc-outside-'));
  const elsewhere = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'mc-elsewhere-'));
  const link = nodePath.join(home, 'chip-world');
  await fs.symlink(elsewhere, link);

  await assert.rejects(() => World.open(link, home), /outside/);
});

test('resource caps hold', async () => {
  const { world } = await freshWorld();

  // Depth.
  let deep = ROOT;
  for (let i = 0; i < 12; i += 1) {
    deep = resolve(deep, `r${i}`);
    await world.makeRoom(deep, 'mkdir');
  }
  await assert.rejects(
    () => world.makeRoom(resolve(deep, 'toofar'), 'mkdir'),
    (err: unknown) => err instanceof ShellError && err.code === 'TOO_DEEP',
  );

  // Per-file size.
  await assert.rejects(
    () => world.write(resolve(ROOT, 'big.txt'), 'x'.repeat(70_000), 'replace', 'echo'),
    (err: unknown) => err instanceof ShellError && err.code === 'TOO_BIG',
  );
});

test('the whole-world byte cap survives rewrites of existing files', async () => {
  // The cap used to be checked only when a file was CREATED, so an existing
  // file could be refilled to MAX_FILE_BYTES for free. Enough files created
  // while the world was small could then each be grown to 64KB, reaching about
  // 128MB against a documented 10MB cap.
  const { world } = await freshWorld();
  const block = 'x'.repeat(MAX_FILE_BYTES);
  // A couple past the cap, so the loop has to cross it rather than stop on it.
  const needed = Math.ceil(MAX_WORLD_BYTES / MAX_FILE_BYTES) + 2;

  // Create them all empty first — cheap, and exactly the shape of the bypass.
  for (let i = 0; i < needed; i += 1) {
    await world.makeEmptyThing(resolve(ROOT, `f${i}.txt`), 'touch');
  }

  let refused = false;
  for (let i = 0; i < needed && !refused; i += 1) {
    try {
      await world.write(resolve(ROOT, `f${i}.txt`), block, 'replace', 'echo');
    } catch (err) {
      refused = err instanceof ShellError && err.code === 'TOO_BIG';
      if (!refused) throw err;
    }
  }

  assert.ok(refused, 'refilling existing files must eventually hit the world byte cap');

  const { bytes } = await world.measure();
  assert.ok(
    bytes <= MAX_WORLD_BYTES + MAX_FILE_BYTES,
    `world grew to ${bytes} bytes, past the ${MAX_WORLD_BYTES} cap`,
  );
});

test('a rewrite that does not grow a file is always allowed', async () => {
  // The budget check only runs when a write GROWS the world: measure() walks
  // the whole tree, so checking every write would rescan up to MAX_FILES
  // entries each time a child types `echo >`.
  const { world } = await freshWorld();
  const note = resolve(ROOT, 'note.txt');

  await world.write(note, 'x'.repeat(1000), 'replace', 'echo');
  await world.write(note, 'shorter\n', 'replace', 'echo');

  assert.equal(await world.read(note, 'cat'), 'shorter\n');
});

test('rm recycles and undo restores', async () => {
  const { world } = await freshWorld();
  const note = resolve(ROOT, 'note.txt');

  await world.write(note, 'hello\n', 'replace', 'echo');
  const ticket = await world.moveToRecycle(note, 'rm');

  assert.equal(await world.kindOf(note, 'ls'), 'nothing', 'it should be gone from the room');

  const restored = await world.restoreFromRecycle(ticket, 'undo');
  assert.equal(restored, note);
  assert.equal(
    await world.read(note, 'cat'),
    'hello\n',
    'the contents must survive the round trip',
  );
});

test('the recycling bin and the marker never show up in ls', async () => {
  const { world } = await freshWorld();
  await world.write(resolve(ROOT, 'visible.txt'), 'hi\n', 'replace', 'echo');
  await world.moveToRecycle(resolve(ROOT, 'visible.txt'), 'rm');
  await world.write(resolve(ROOT, '.hidden-clue'), 'psst\n', 'replace', 'echo');

  const plain = await world.list(ROOT, 'ls');
  assert.deepEqual(
    plain.map((e) => e.name),
    ['.hidden-clue'],
  );

  // Even with hidden things shown, CHIP's bookkeeping stays out of the way,
  // so the hidden-file mission has exactly one thing to discover.
  const withHidden = plain.filter((e) => e.hidden).map((e) => e.name);
  assert.deepEqual(withHidden, ['.hidden-clue']);
});

/* ---- links planted by something other than the game ------------------- */

/**
 * The game never creates a link of any kind. But the world folder is an
 * ordinary directory owned by the user, and the jail's own threat model says
 * "a grown-up experimenting in the world folder might" — as could anything
 * else running as the same user. These four are the writes that would follow
 * such a link out of the world.
 *
 * Threat #15 in the header claimed a test since the day it was written. It did
 * not have one, and the guard it describes threw its refusal from inside a
 * try/catch that swallowed it, so it never once fired.
 */

/** Somewhere outside the world, with a file in it that must not be touched. */
async function bystander(): Promise<{ dir: string; file: string; original: string }> {
  const dir = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'mc-bystander-'));
  const file = nodePath.join(dir, 'not-yours.txt');
  const original = 'someone else’s file\n';
  await fs.writeFile(file, original, 'utf8');
  return { dir, file, original };
}

test('writing through a hard link is refused', async () => {
  const { world, root } = await freshWorld();
  const outside = await bystander();

  // No symlink to follow, so realpath() sees nothing wrong: the inode is
  // simply shared with a file outside the world.
  await fs.link(outside.file, nodePath.join(root, 'linked.txt'));
  const target = resolve(ROOT, 'linked.txt');

  await assert.rejects(
    () => world.write(target, 'clobbered\n', 'replace', 'echo'),
    ShellError,
    'echo > must refuse a hard link',
  );
  await assert.rejects(
    () => world.write(target, 'clobbered\n', 'append', 'echo'),
    ShellError,
    'echo >> must refuse a hard link',
  );

  await world.write(resolve(ROOT, 'source.txt'), 'payload\n', 'replace', 'echo');
  await assert.rejects(
    () => world.copy(resolve(ROOT, 'source.txt'), target, 'cp'),
    ShellError,
    'cp must refuse a hard link too — it never even asked before',
  );

  assert.equal(
    await fs.readFile(outside.file, 'utf8'),
    outside.original,
    'the file outside the world must be untouched',
  );
});

test('a dangling symlink cannot be used to create a file outside the world', async () => {
  const { world, root } = await freshWorld();
  const outside = await bystander();

  // The target does not exist YET. That is the whole trick: realpath() fails
  // on the link itself, so real() walks up to the world root and passes, and
  // lstat then reports 'nothing' so the write looks like a brand-new file.
  const victim = nodePath.join(outside.dir, 'should-never-be-created.txt');
  await fs.symlink(victim, nodePath.join(root, 'trap.txt'));

  await assert.rejects(
    () => world.write(resolve(ROOT, 'trap.txt'), 'pwned\n', 'replace', 'echo'),
    ShellError,
    'echo > must refuse a dangling symlink',
  );
  await assert.rejects(
    () => world.makeEmptyThing(resolve(ROOT, 'trap.txt'), 'touch'),
    ShellError,
    'touch must refuse a dangling symlink',
  );

  await world.write(resolve(ROOT, 'source.txt'), 'payload\n', 'replace', 'echo');
  await assert.rejects(
    () => world.copy(resolve(ROOT, 'source.txt'), resolve(ROOT, 'trap.txt'), 'cp'),
    ShellError,
    'cp must refuse a dangling symlink',
  );

  assert.equal(
    await fs.access(victim).then(
      () => true,
      () => false,
    ),
    false,
    'nothing may be created outside the world',
  );
});

test('a symlink to an existing file outside the world is refused on write', async () => {
  const { world, root } = await freshWorld();
  const outside = await bystander();

  await fs.symlink(outside.file, nodePath.join(root, 'pointer.txt'));

  await assert.rejects(
    () => world.write(resolve(ROOT, 'pointer.txt'), 'clobbered\n', 'replace', 'echo'),
    ShellError,
  );
  assert.equal(await fs.readFile(outside.file, 'utf8'), outside.original);
});
