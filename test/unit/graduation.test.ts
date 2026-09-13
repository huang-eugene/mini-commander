/**
 * Graduation verification.
 *
 * The encoding tests are the point of this file. Windows PowerShell 5.1
 * writes `echo "hi" > note.txt` as UTF-16LE with a BOM, so a naive utf8 read
 * would reject the child's CORRECT answer on a stock Windows machine and
 * tell them they had failed at the exact moment they had succeeded in the
 * real world for the first time.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as nodePath from 'node:path';

import {
  decodeTolerantly,
  howToOpen,
  makeAFileHere,
  provedIt,
  terminalName,
} from '../../src/missions/graduation.js';

async function tempDir(): Promise<string> {
  return fs.mkdtemp(nodePath.join(os.tmpdir(), 'mc-grad-'));
}

test('plain UTF-8 is read', async () => {
  const dir = await tempDir();
  await fs.writeFile(nodePath.join(dir, 'a.txt'), 'I did it for real\n', 'utf8');
  assert.equal(
    decodeTolerantly(await fs.readFile(nodePath.join(dir, 'a.txt'))),
    'I did it for real',
  );
});

test("PowerShell 5.1's UTF-16LE with a BOM is read", async () => {
  // This is what `echo "hi" > note.txt` actually produces on stock Windows.
  const dir = await tempDir();
  const body = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from('I did it for real\r\n', 'utf16le'),
  ]);
  await fs.writeFile(nodePath.join(dir, 'b.txt'), body);

  assert.equal(
    decodeTolerantly(await fs.readFile(nodePath.join(dir, 'b.txt'))),
    'I did it for real',
  );
});

test('UTF-16BE with a BOM is read', async () => {
  const dir = await tempDir();
  const payload = Buffer.from('hello there', 'utf16le');
  payload.swap16();
  await fs.writeFile(
    nodePath.join(dir, 'c.txt'),
    Buffer.concat([Buffer.from([0xfe, 0xff]), payload]),
  );

  assert.equal(decodeTolerantly(await fs.readFile(nodePath.join(dir, 'c.txt'))), 'hello there');
});

test('a UTF-8 BOM is stripped', async () => {
  const dir = await tempDir();
  await fs.writeFile(
    nodePath.join(dir, 'd.txt'),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('hello', 'utf8')]),
  );
  assert.equal(decodeTolerantly(await fs.readFile(nodePath.join(dir, 'd.txt'))), 'hello');
});

test('CRLF line endings do not break the check', async () => {
  const dir = await tempDir();
  await fs.writeFile(nodePath.join(dir, 'e.txt'), 'one\r\ntwo\r\n', 'utf8');
  assert.equal(decodeTolerantly(await fs.readFile(nodePath.join(dir, 'e.txt'))), 'one\ntwo');
});

test('a missing file is undefined, not a crash', async () => {
  const reader = async (): Promise<Buffer | undefined> => undefined;
  assert.equal(await provedIt(reader, 'nope.txt'), false);
});

test('provedIt accepts the child\u2019s answer whatever their shell did to it', async () => {
  const dir = await tempDir();

  // The same correct answer, three ways a real shell might have stored it.
  await fs.writeFile(nodePath.join(dir, 'posix.txt'), 'I did it for real\n', 'utf8');
  await fs.writeFile(
    nodePath.join(dir, 'ps51.txt'),
    Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('I did it for real\r\n', 'utf16le')]),
  );
  await fs.writeFile(nodePath.join(dir, 'shouty.txt'), 'I DID IT FOR REAL\n', 'utf8');

  // Stands in for the jail's readBytes: the only thing provedIt ever sees.
  const read = async (name: string): Promise<Buffer | undefined> =>
    fs.readFile(nodePath.join(dir, name)).catch(() => undefined);

  for (const name of ['posix.txt', 'ps51.txt', 'shouty.txt']) {
    assert.equal(
      await provedIt(read, name, 'i did it for real'),
      true,
      `${name} should have counted as proof`,
    );
  }

  assert.equal(await provedIt(read, 'posix.txt', 'something else'), false);
  assert.equal(await provedIt(read, 'absent.txt'), false);
});

test('Windows is told to use New-Item, because touch does not exist there', () => {
  // Not a detail: `touch` is not an alias or a function in PowerShell, so
  // telling a child on Windows to type it would send them to do something
  // that cannot work.
  const windows = makeAFileHere('win32', 'C:\\Users\\kid\\.mini-commander\\chip-world');
  const mac = makeAFileHere('darwin', '/Users/kid/.mini-commander/chip-world');

  assert.ok(windows.some((i) => i.type.includes('New-Item')));
  assert.ok(!windows.some((i) => i.type.startsWith('touch')));
  assert.ok(mac.some((i) => i.type.startsWith('touch')));

  // Both still use the same `cd`, `ls` and `echo >` the child already knows,
  // which is the whole point of the exercise.
  for (const set of [windows, mac]) {
    assert.ok(set.some((i) => i.type.startsWith('cd ')));
    assert.ok(set.some((i) => i.type === 'ls'));
    assert.ok(set.some((i) => i.type.includes('>')));
  }
});

test('each platform is told what to open and how', () => {
  assert.equal(terminalName('win32'), 'PowerShell');
  assert.equal(terminalName('darwin'), 'Terminal');
  assert.equal(terminalName('linux'), 'Terminal');

  assert.match(howToOpen('win32').join(' '), /Windows key/);
  assert.match(howToOpen('darwin').join(' '), /Command/);
  assert.ok(howToOpen('linux').length > 0);
});
