/**
 * The test suite has to actually contain the tests.
 *
 * `npm test` passes a glob to `node --test`, and a glob that matches nothing
 * is not an error: the runner prints `# tests 0` and exits 0. So a pattern
 * that silently stops matching turns the whole suite green while running none
 * of it — the worst failure mode a test suite has, because every other check
 * in CI keeps reporting success.
 *
 * That is not hypothetical. The recursive glob the test script uses needs
 * glob support in `node --test` positional arguments, which arrived in Node
 * 22; on Node 20 the same command failed outright. This test pins the pattern
 * to the files on disk so the next change to either one has to be deliberate.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as nodePath from 'node:path';

/** Every `*.test.ts` under test/, as a repo-relative path. */
async function testSourcesOnDisk(dir = 'test'): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const path = nodePath.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await testSourcesOnDisk(path)));
    else if (entry.name.endsWith('.test.ts')) found.push(path);
  }
  return found.sort();
}

test('the pattern in `npm test` matches every test file on disk', async () => {
  const pkg = JSON.parse(await fs.readFile('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };

  // Pull the pattern out of the script rather than restating it, so editing
  // the script is what this test is checking.
  const pattern = /node --test "([^"]+)"/.exec(pkg.scripts.test ?? '')?.[1];
  assert.ok(pattern, `could not find the node --test pattern in: ${pkg.scripts.test}`);

  const matched: string[] = [];
  for await (const hit of fs.glob(pattern)) matched.push(hit);

  const sources = await testSourcesOnDisk();

  // Compiled output sits under build/ mirroring test/, so each source should
  // have exactly one match. Compare the counts rather than the paths, which
  // differ by root and extension.
  assert.ok(sources.length > 0, 'no *.test.ts files found under test/');
  assert.equal(
    matched.length,
    sources.length,
    `\`npm test\` matches ${matched.length} file(s) but there are ${sources.length} ` +
      `test source(s). The suite would run only part of itself.\n` +
      `  pattern: ${pattern}\n  sources: ${sources.join(', ')}`,
  );
});

test('the declared minimum Node version can run the test command', async () => {
  const pkg = JSON.parse(await fs.readFile('package.json', 'utf8')) as {
    engines?: { node?: string };
  };

  // Glob patterns in `node --test` positional arguments need Node 22. If
  // `engines` ever claims to support less than that, `npm test` is broken for
  // anyone who believes it.
  const minimum = Number.parseInt(/(\d+)/.exec(pkg.engines?.node ?? '')?.[1] ?? '0', 10);
  assert.ok(
    minimum >= 22,
    `package.json engines.node is "${pkg.engines?.node}", but \`node --test\` ` +
      `needs 22 or newer to expand the glob in the test script`,
  );
});
