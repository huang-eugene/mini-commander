/**
 * The one place bytes leave the game.
 *
 * Everything printed goes through a Screen. In play that writes to stdout;
 * in tests it writes to a string, which is what makes golden transcripts
 * possible. No other module may call console.log.
 *
 * Line width is capped hard at 40 characters for CHIP's dialogue. That is not
 * a stylistic choice — a developing reader loses their place on long lines,
 * and 40 characters is roughly a picture-book line.
 */

import type { Theme } from './theme.js';

export const CHIP_LINE_WIDTH = 40;

export interface Screen {
  /** CHIP talking, wrapped and boxed. */
  chip(lines: string | string[]): void;
  /** Raw computer output — what a real terminal would have printed. */
  output(lines: string | string[]): void;
  /** Real error text, styled but not softened. */
  error(text: string): void;
  /** A blank line. */
  gap(): void;
  /** A command for the child to type, shown on its own line. */
  command(text: string): void;
  /** A celebration banner. */
  celebrate(title: string, detail?: string): void;
  /** A section heading, used by help/badges/map. */
  heading(text: string): void;
  /** Plain narration that is not CHIP and not the computer. */
  note(text: string): void;
}

export interface ScreenOptions {
  theme: Theme;
  write: (text: string) => void;
  /** Extra spacing between blocks. Easier to follow for a new reader. */
  roomy?: boolean;
}

/** Breaks text into lines no longer than `width`, never mid-word. */
export function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    if (line.length === 0) {
      line = word;
    } else if (line.length + 1 + word.length <= width) {
      line += ' ' + word;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

export function makeScreen(options: ScreenOptions): Screen {
  const { theme, write } = options;
  const roomy = options.roomy ?? true;
  const g = theme.glyphs;

  const writeLine = (text: string): void => write(text + '\n');

  return {
    chip(input) {
      const paragraphs = Array.isArray(input) ? input : [input];
      const lines: string[] = [];
      for (const paragraph of paragraphs) {
        for (const line of wrap(paragraph, CHIP_LINE_WIDTH)) lines.push(line);
      }

      // A speech box rather than a bare prefix: it makes CHIP a character on
      // the screen instead of another stream of text, which matters a lot for
      // a child who cannot yet skim.
      const inner = Math.max(...lines.map((l) => l.length), 'CHIP'.length + 3);
      const bar = g.boxHorizontal.repeat(inner + 2);

      writeLine(theme.chip(`${g.chip} CHIP`));
      writeLine(theme.chip(`${g.boxTopLeft}${bar}${g.boxTopRight}`));
      for (const line of lines) {
        writeLine(
          theme.chip(`${g.boxVertical} `) + line.padEnd(inner) + theme.chip(` ${g.boxVertical}`),
        );
      }
      writeLine(theme.chip(`${g.boxBottomLeft}${bar}${g.boxBottomRight}`));
      if (roomy) writeLine('');
    },

    output(input) {
      const lines = Array.isArray(input) ? input : [input];
      for (const line of lines) writeLine(theme.output(line));
      if (roomy && lines.length > 0) writeLine('');
    },

    error(text) {
      writeLine(theme.error(text));
      if (roomy) writeLine('');
    },

    gap() {
      writeLine('');
    },

    command(text) {
      writeLine('   ' + theme.command(text));
      if (roomy) writeLine('');
    },

    celebrate(title, detail) {
      // Wrapped rather than sized to content: a long badge description would
      // otherwise produce a box far wider than the dialogue around it, and
      // wider than a small terminal.
      const titleLines = wrap(title, CHIP_LINE_WIDTH);
      const detailLines = detail ? wrap(detail, CHIP_LINE_WIDTH) : [];
      const inner = Math.max(...[...titleLines, ...detailLines].map((l) => l.length));
      const bar = g.boxHorizontal.repeat(inner + 4);

      writeLine(theme.win(`${g.boxTopLeft}${bar}${g.boxTopRight}`));
      for (const line of titleLines) {
        writeLine(
          theme.win(`${g.boxVertical}  `) +
            theme.win(theme.heading(line.padEnd(inner))) +
            theme.win(`  ${g.boxVertical}`),
        );
      }
      for (const line of detailLines) {
        writeLine(
          theme.win(`${g.boxVertical}  `) + line.padEnd(inner) + theme.win(`  ${g.boxVertical}`),
        );
      }
      writeLine(theme.win(`${g.boxBottomLeft}${bar}${g.boxBottomRight}`));
      if (roomy) writeLine('');
    },

    heading(text) {
      writeLine(theme.heading(text));
      writeLine(theme.dim(g.boxHorizontal.repeat(text.length)));
    },

    note(text) {
      for (const line of wrap(text, CHIP_LINE_WIDTH + 12)) writeLine(theme.dim(line));
      if (roomy) writeLine('');
    },
  };
}

/** A Screen that collects everything, for tests and golden transcripts. */
export function makeRecordingScreen(theme: Theme): { screen: Screen; text: () => string } {
  let buffer = '';
  const screen = makeScreen({ theme, write: (t) => (buffer += t) });
  return { screen, text: () => buffer };
}
