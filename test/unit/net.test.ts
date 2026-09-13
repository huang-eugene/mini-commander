/**
 * The practice network.
 *
 * Two properties matter. First, it is deterministic: the same command gives
 * the same output every time, which a real network cannot promise and which
 * is what makes the stage 8 missions teachable and testable at all. Second,
 * the game opens no sockets — the last test in this file is the one that
 * actually guarantees that, by checking nothing outside net/ imports node:net
 * or node:dns.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as nodePath from 'node:path';

import { makeShell } from '../harness/session.js';
import { route, findNode, brokenLink } from '../../src/net/topology.js';

test('a name resolves to an address', () => {
  assert.equal(findNode('gran')?.address, '10.4.0.7');
  // And the address resolves back, which is the point of mission 18.
  assert.equal(findNode('10.4.0.7')?.name, 'gran');
  assert.equal(findNode('nowhere'), undefined);
});

test('the route to gran passes through both sorting stations', () => {
  const { hops } = route('home', 'gran');
  assert.deepEqual(
    hops.map((h) => h.name),
    ['home', 'sorter', 'big-sorter', 'gran'],
    'the child should be able to see every machine the message passes through',
  );
});

test('the attic is unreachable, and we can say where it got stuck', () => {
  // A productive failure with a cause a child can picture, rather than an
  // error number.
  const { hops, blockedAt } = route('home', 'attic');
  assert.deepEqual(hops, []);
  assert.equal(blockedAt?.name, 'sorter');
  assert.match(brokenLink()?.brokenBecause ?? '', /cable/);
});

test('ping answers for a reachable machine and not for the attic', async () => {
  const shell = await makeShell();
  try {
    await shell.run('ping gran');
    assert.match(shell.output(), /answer from 10\.4\.0\.7/);

    await shell.run('ping attic');
    assert.match(shell.output(), /no answer/);
    assert.match(shell.output(), /got as far as sorter/);
  } finally {
    await shell.cleanup();
  }
});

test('an unknown name fails differently from an unreachable one', async () => {
  // This distinction IS mission 18: a name that nothing answers to is not the
  // same as a name nobody has ever heard of.
  const shell = await makeShell();
  try {
    await shell.run('ping banana');
    assert.match(shell.output(), /Name or service not known/);

    await shell.run('nslookup attic');
    assert.match(shell.output(), /10\.0\.0\.4/, 'the attic still HAS an address');
  } finally {
    await shell.cleanup();
  }
});

test('traceroute lists every hop in order', async () => {
  const shell = await makeShell();
  try {
    await shell.run('traceroute moon');
    const out = shell.output();

    // Parse the numbered hop lines rather than searching the whole transcript:
    // the target's name also appears in the header, and "sorter" is a
    // substring of "big-sorter".
    const hops = out
      .split('\n')
      .map((line) => /^\s*\d+\s+(\S+)/.exec(line)?.[1])
      .filter((name): name is string => Boolean(name));

    assert.deepEqual(hops, ['home', 'sorter', 'big-sorter', 'moon'], out);
  } finally {
    await shell.cleanup();
  }
});

test('the same command gives the same output every time', async () => {
  // Determinism is what a real network cannot promise, and without it the
  // stage 8 missions could not be tested or authored.
  const first = await makeShell();
  const second = await makeShell();
  try {
    await first.run('ping moon');
    await second.run('ping moon');
    assert.equal(first.output(), second.output());
  } finally {
    await first.cleanup();
    await second.cleanup();
  }
});

test('sending an envelope gets a reply into the inbox', async () => {
  const shell = await makeShell();
  try {
    await shell.run('echo FROM: me > letter.txt');
    await shell.run('echo TO: moon >> letter.txt');
    await shell.run('echo MESSAGE: hello up there >> letter.txt');
    await shell.run('send letter.txt');

    assert.match(shell.output(), /passes it to/, 'the child should see the hops');
    await shell.run('cat inbox/reply.txt');
    assert.match(shell.output(), /HELLO FROM THE MOON BASE/);
  } finally {
    await shell.cleanup();
  }
});

test('an envelope with no TO says what is missing', async () => {
  const shell = await makeShell();
  try {
    await shell.run('echo MESSAGE: hi > bad.txt');
    await shell.run('send bad.txt');
    assert.match(shell.output(), /no TO: line/);
  } finally {
    await shell.cleanup();
  }
});

test('the game opens no sockets anywhere', async () => {
  // The strongest version of the safety claim, and the one a parent would
  // actually want: not "we are careful with the network" but "there is no
  // network code". Checked as an import-graph property rather than a promise.
  const root = nodePath.join(process.cwd(), 'src');
  const offenders: string[] = [];

  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = nodePath.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;

      const text = await fs.readFile(full, 'utf8');
      if (/from\s+'node:(net|dns|http|https|tls|dgram)'/.test(text)) {
        offenders.push(nodePath.relative(root, full));
      }
    }
  };

  await walk(root);
  assert.deepEqual(offenders, [], 'no module may import a networking built-in');
});

test('the game spawns no subprocesses', async () => {
  // Same argument. The only sanctioned exception would be the opt-in voice
  // adapter, and it does not exist yet — when it does, it goes on this list
  // deliberately rather than by accident.
  const root = nodePath.join(process.cwd(), 'src');
  const allowed = new Set<string>([]);
  const offenders: string[] = [];

  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = nodePath.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;

      const relative = nodePath.relative(root, full);
      if (allowed.has(relative)) continue;

      const text = await fs.readFile(full, 'utf8');
      if (/from\s+'node:child_process'/.test(text)) offenders.push(relative);
    }
  };

  await walk(root);
  assert.deepEqual(offenders, [], 'only an allowlisted module may spawn anything');
});

test('only the jail touches the filesystem', async () => {
  // If this ever fails, some command has started reading or writing without
  // going through the containment checks, and the sandbox guarantee is gone.
  const root = nodePath.join(process.cwd(), 'src');
  const allowed = new Set(['shell/fs-jail.ts', 'engine/save.ts', 'cli.ts']);
  const offenders: string[] = [];

  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = nodePath.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;

      const relative = nodePath.relative(root, full).split(nodePath.sep).join('/');
      if (allowed.has(relative)) continue;

      const text = await fs.readFile(full, 'utf8');
      if (/from\s+'node:fs(\/promises)?'/.test(text)) offenders.push(relative);
    }
  };

  await walk(root);
  assert.deepEqual(offenders, [], 'only the jail, the save file and the CLI may touch node:fs');
});
