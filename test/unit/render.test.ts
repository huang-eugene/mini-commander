/**
 * Nothing the game prints may carry a terminal control sequence.
 *
 * The jail's checkName rejects control characters on the way IN, but names
 * already on disk never pass through it: `list()` returns whatever readdir
 * gave it, and `read()` returns whatever bytes the file holds. Both go
 * straight to the terminal through `ls` and `cat` — and the graduation
 * missions send the child to a REAL shell to create files in that same folder,
 * so "the game wrote everything in here" was never true.
 *
 * The threat is small but the premise it undermines is not: a child is being
 * taught that what CHIP prints is what the computer said.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hasControlCharacters, makeRecordingScreen, printable, wrap } from '../../src/ui/render.js';
import { makeTheme } from '../../src/ui/theme.js';

const ch = (code: number): string => String.fromCharCode(code);
const ESC = ch(0x1b);

/**
 * Sequences a real shell can put in a filename or a file. Built from character
 * codes rather than written literally, so the file stays free of the very
 * bytes it is about.
 */
const HOSTILE: readonly string[] = [
  `${ESC}[31mred`, // colour
  `${ESC}[2J`, // clear the screen
  `${ESC}]0;window title${ch(0x07)}`, // OSC: set the terminal title
  `${ESC}[1;1H`, // move the cursor
  `a${ch(0)}b`, // NUL
  `line one${ch(10)}line two`, // a newline inside one value
  `back${ch(8)}space`,
  `${ch(0x9b)}31m`, // C1 CSI, the single-byte form
];

test('printable strips every control character but keeps the text', () => {
  for (const hostile of HOSTILE) {
    const safe = printable(hostile);
    assert.equal(hasControlCharacters(safe), false, `left in: ${JSON.stringify(safe)}`);
  }

  // Tab survives: it is the one C0 character that is ordinary in text.
  assert.equal(printable('a\tb'), 'a\tb');
  assert.equal(printable('hello'), 'hello');
});

test('no Screen method lets a control character through', () => {
  // Colour off, so any escape in the output came from the content rather than
  // from the theme doing its job.
  const theme = makeTheme({ colour: false, ascii: true });

  for (const hostile of HOSTILE) {
    const { screen, text } = makeRecordingScreen(theme);

    screen.chip(hostile);
    screen.chip([hostile, hostile]);
    screen.output(hostile);
    screen.output([hostile, hostile]);
    screen.error(hostile);
    screen.command(hostile);
    screen.celebrate(hostile, hostile);
    screen.heading(hostile);
    screen.note(hostile);

    // Newlines are how the screen writes lines at all, so drop those and check
    // everything else.
    const printed = text().split('\n').join('');
    assert.equal(
      hasControlCharacters(printed),
      false,
      `a control character survived: ${JSON.stringify(hostile)}`,
    );
  }
});

test('the theme may still colour its own output', () => {
  // The sweep above must not have been achieved by stripping the escapes the
  // game itself writes — otherwise colour would be silently broken and every
  // test here would still pass.
  const { screen, text } = makeRecordingScreen(makeTheme({ colour: true }));
  screen.error('something went wrong');

  assert.equal(text().includes(ESC), true, 'colour must still reach the terminal');
});

test('wrap sanitises, so boxed dialogue cannot be broken open', () => {
  // chip(), celebrate() and note() all size their frames from the wrapped
  // lines. A control character inside one would be counted as a printing
  // character and skew the box it sits in.
  for (const line of wrap(`hello${ESC}[2Jworld`, 40)) {
    assert.equal(hasControlCharacters(line), false);
  }
});
