/**
 * Graduation: doing it for real.
 *
 * Everything so far has happened inside CHIP's control room. These missions
 * send the child to their own Terminal or PowerShell, have them do the same
 * thing there, and then check the result on disk. That is what closes the
 * gap between "I can play this game" and "I can use a computer".
 *
 * Two rules make them safe to ship:
 *
 * 1. They are always skippable. The authenticity bonus must never become a
 *    progression wall — if the grown-up is busy, or the child's shell is
 *    unusual, or they simply do not want to, the mission moves on.
 *
 * 2. Verification is encoding-tolerant, and this is not a nicety. Windows
 *    PowerShell 5.1 writes `echo "hi" > note.txt` as UTF-16LE with a BOM
 *    (PowerShell 7 defaults to UTF-8, so it varies by *version*, not just by
 *    platform). A naive utf8 read would fail the child's CORRECT answer on a
 *    stock Windows machine, which is about the worst bug this project could
 *    ship. `readTolerantly` below handles it.
 *
 * Platform divergence is stated as content rather than hidden: `touch` does
 * not exist in PowerShell, and CHIP says so plainly, because "your computer
 * says it differently" is a true and useful thing to learn.
 */

export type Platform = 'darwin' | 'win32' | 'linux';

export function platformNow(): Platform {
  if (process.platform === 'win32') return 'win32';
  if (process.platform === 'darwin') return 'darwin';
  return 'linux';
}

/** What the child should open, in their words. */
export function terminalName(platform: Platform): string {
  return platform === 'win32' ? 'PowerShell' : 'Terminal';
}

export function howToOpen(platform: Platform): string[] {
  switch (platform) {
    case 'win32':
      return ['Press the Windows key, type: powershell', 'Then press Enter. A blue window opens.'];
    case 'darwin':
      return [
        'Press Command and the space bar together.',
        'Type: terminal',
        'Then press Enter. A white window opens.',
      ];
    default:
      return ['Open your Terminal app.'];
  }
}

/**
 * The same job, spelled the way each platform spells it.
 *
 * `touch` genuinely does not exist in PowerShell — not as an alias, not as a
 * function — so Windows gets `New-Item`. Pretending otherwise would send a
 * child to type something that cannot work.
 */
export interface Instruction {
  say: string;
  type: string;
}

export function makeAFileHere(platform: Platform, folder: string): Instruction[] {
  const common: Instruction[] = [
    { say: 'Go to the folder where CHIP lives:', type: `cd "${folder}"` },
    { say: 'Look around, exactly like in the control room:', type: 'ls' },
  ];

  if (platform === 'win32') {
    return [
      ...common,
      {
        say: 'Now make a file. On Windows this one is spelled differently:',
        type: 'New-Item -ItemType File -Name proof.txt',
      },
      { say: 'And put some words in it:', type: 'echo "I did it for real" > proof.txt' },
    ];
  }

  return [
    ...common,
    { say: 'Now make a file:', type: 'touch proof.txt' },
    { say: 'And put some words in it:', type: 'echo "I did it for real" > proof.txt' },
  ];
}

/**
 * Decodes bytes a file might contain after a REAL shell wrote them.
 *
 * Handles: UTF-8 BOM, UTF-16LE/BE with BOM (PowerShell 5.1's default for
 * `>`), CRLF line endings, Unicode composition differences on macOS, and
 * trailing whitespace.
 *
 * Pure, and deliberately so — it takes bytes rather than a path, because the
 * jail stays the only module in the codebase that touches the filesystem.
 * Reading these bytes goes through `World.readAsChildWrote`.
 */
export function decodeTolerantly(raw: Buffer): string {
  let text: string;

  if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) {
    text = raw.subarray(2).toString('utf16le');
  } else if (raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff) {
    // UTF-16BE: swap the byte pairs, then decode as LE.
    const swapped = Buffer.from(raw.subarray(2));
    swapped.swap16();
    text = swapped.toString('utf16le');
  } else if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
    text = raw.subarray(3).toString('utf8');
  } else {
    text = raw.toString('utf8');
  }

  return text.replace(/\r\n/g, '\n').normalize('NFC').trim();
}

/**
 * True when the child really did make the file, whatever their shell did to
 * it. `read` comes from the jail, so this never sees a raw path.
 */
export async function provedIt(
  read: (name: string) => Promise<Buffer | undefined>,
  fileName: string,
  mustContain?: string,
): Promise<boolean> {
  const raw = await read(fileName);
  if (raw === undefined) return false;

  const text = decodeTolerantly(raw);
  if (!mustContain) return true;

  // Case-insensitive, because a child's capitalisation is not the thing
  // being tested, and because two of the three platforms are anyway.
  return text.toLowerCase().includes(mustContain.toLowerCase());
}
