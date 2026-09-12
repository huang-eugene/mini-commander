/**
 * Colour and glyphs.
 *
 * Two independent axes, because they fail independently:
 *   - colour: absent when piped, when NO_COLOR is set, or on request
 *   - glyphs: unicode boxes and emoji look like mojibake in legacy Windows
 *     conhost, so there is an ASCII set that works literally everywhere
 *
 * The high-contrast theme exists because this is aimed at a child who may be
 * reading with difficulty. It uses bold white on the terminal's own black and
 * avoids mid-tone greys entirely.
 */

export type ThemeName = 'default' | 'high-contrast' | 'mono';

export interface Glyphs {
  chip: string;
  room: string;
  thing: string;
  hidden: string;
  badge: string;
  arrow: string;
  bullet: string;
  boxTopLeft: string;
  boxTopRight: string;
  boxBottomLeft: string;
  boxBottomRight: string;
  boxHorizontal: string;
  boxVertical: string;
  sparkle: string;
  cross: string;
  tick: string;
}

const UNICODE: Glyphs = {
  chip: '■■', // ■■
  room: '▸', // ▸
  thing: '·', // ·
  hidden: '◌', // ◌
  badge: '★', // ★
  arrow: '→', // →
  bullet: '•', // •
  boxTopLeft: '╭',
  boxTopRight: '╮',
  boxBottomLeft: '╰',
  boxBottomRight: '╯',
  boxHorizontal: '─',
  boxVertical: '│',
  sparkle: '✨',
  cross: '✗',
  tick: '✓',
};

const ASCII: Glyphs = {
  chip: '[]',
  room: '>',
  thing: '-',
  hidden: 'o',
  badge: '*',
  arrow: '->',
  bullet: '*',
  boxTopLeft: '+',
  boxTopRight: '+',
  boxBottomLeft: '+',
  boxBottomRight: '+',
  boxHorizontal: '-',
  boxVertical: '|',
  sparkle: '*',
  cross: 'x',
  tick: 'v',
};

export interface Theme {
  readonly name: ThemeName;
  readonly colour: boolean;
  readonly glyphs: Glyphs;
  /** CHIP speaking. */
  chip(text: string): string;
  /** Real terminal output — deliberately uncoloured, it is "the computer". */
  output(text: string): string;
  /** Real error text. */
  error(text: string): string;
  /** A command the child should type. */
  command(text: string): string;
  /** Quiet asides, room names in the map, etc. */
  dim(text: string): string;
  /** Celebrations. */
  win(text: string): string;
  heading(text: string): string;
}

const SGR = {
  reset: '[0m',
  bold: '[1m',
  dim: '[2m',
  cyan: '[36m',
  brightCyan: '[96m',
  yellow: '[33m',
  brightYellow: '[93m',
  red: '[31m',
  brightRed: '[91m',
  green: '[32m',
  brightGreen: '[92m',
  white: '[97m',
};

export interface ThemeOptions {
  name?: ThemeName;
  colour?: boolean;
  ascii?: boolean;
}

export function makeTheme(options: ThemeOptions = {}): Theme {
  const name = options.name ?? 'default';
  const colour = options.colour ?? true;
  const glyphs = options.ascii ? ASCII : UNICODE;

  const wrap =
    (...codes: string[]) =>
    (text: string): string =>
      colour && name !== 'mono' ? codes.join('') + text + SGR.reset : text;

  const high = name === 'high-contrast';

  return {
    name,
    colour: colour && name !== 'mono',
    glyphs,
    chip: wrap(high ? SGR.bold + SGR.brightCyan : SGR.cyan),
    output: (text) => text,
    error: wrap(high ? SGR.bold + SGR.brightRed : SGR.red),
    command: wrap(high ? SGR.bold + SGR.brightYellow : SGR.yellow),
    // In high contrast, "dim" must not actually be dim.
    dim: high ? wrap(SGR.white) : wrap(SGR.dim),
    win: wrap(high ? SGR.bold + SGR.brightGreen : SGR.green),
    heading: wrap(SGR.bold),
  };
}

/**
 * Decides the defaults from the environment. Respects NO_COLOR (the de facto
 * standard) and FORCE_COLOR, and falls back to ASCII glyphs on Windows
 * outside Windows Terminal, where unicode box drawing tends to break.
 */
export function detectThemeOptions(env: NodeJS.ProcessEnv, isTty: boolean): ThemeOptions {
  const forced = env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '0';
  const disabled = env.NO_COLOR !== undefined && env.NO_COLOR !== '';

  const legacyWindows = process.platform === 'win32' && !env.WT_SESSION && !env.TERM_PROGRAM;

  return {
    colour: forced || (isTty && !disabled),
    ascii: legacyWindows,
  };
}
