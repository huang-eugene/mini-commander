/**
 * Turning a typed line into a command.
 *
 * This is a deliberately tiny language. It understands words, quoted strings,
 * and the two redirects (`>` and `>>`). It understands nothing else, and that
 * is the point: there is no pipe, no `;`, no `&&`, no `$(...)`, no backtick,
 * no variable expansion, no glob. Those are not blocked by a denylist — they
 * are simply not part of the grammar, so there is no code path that could
 * execute them.
 *
 * When the child types one anyway (and they will, by accident or by copying
 * something), we say so plainly rather than silently ignoring it. An ignored
 * character is far more confusing than a refused one.
 */

export interface Redirect {
  op: '>' | '>>';
  target: string;
}

export interface ParsedLine {
  /** The command word, lowercased. Empty when the line was blank. */
  name: string;
  /** Exactly what was typed, for "you typed X" messages. */
  spelling: string;
  args: string[];
  redirect?: Redirect;
  raw: string;
}

export class ParseProblem extends Error {
  constructor(
    readonly kind: 'unsupported' | 'unclosed-quote' | 'dangling-redirect',
    override readonly message: string,
    /** The offending character, when there is one. */
    readonly offender?: string,
  ) {
    super(message);
    this.name = 'ParseProblem';
  }
}

/** Characters that mean something in a real shell and nothing here. */
const UNSUPPORTED: Record<string, string> = {
  '|': 'a pipe',
  ';': 'a semicolon',
  '&': 'an ampersand',
  '`': 'a backtick',
  $: 'a dollar sign',
  '<': 'a left arrow',
  '*': 'a star',
  '?': 'a question mark',
  '(': 'a bracket',
  ')': 'a bracket',
  '{': 'a curly bracket',
  '}': 'a curly bracket',
  '!': 'an exclamation mark',
};

type Token = { kind: 'word'; text: string } | { kind: 'redirect'; op: '>' | '>>' };

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    const ch = line[i]!;

    if (ch === ' ' || ch === '\t') {
      i += 1;
      continue;
    }

    if (ch === '>') {
      const double = line[i + 1] === '>';
      tokens.push({ kind: 'redirect', op: double ? '>>' : '>' });
      i += double ? 2 : 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      let text = '';
      i += 1;
      while (i < line.length && line[i] !== quote) {
        text += line[i];
        i += 1;
      }
      if (i >= line.length) {
        throw new ParseProblem(
          'unclosed-quote',
          `there is a ${quote === '"' ? 'double' : 'single'} quote that never closes`,
          quote,
        );
      }
      i += 1; // closing quote
      tokens.push({ kind: 'word', text });
      continue;
    }

    // Bare word. Unsupported characters are refused here, where we can point
    // at the exact character, rather than being quietly swallowed.
    let text = '';
    while (i < line.length && !' \t>'.includes(line[i]!)) {
      const c = line[i]!;
      const description = UNSUPPORTED[c];
      if (description) {
        throw new ParseProblem(
          'unsupported',
          `CHIP's control room does not understand ${description} (${c}) yet`,
          c,
        );
      }
      text += c;
      i += 1;
    }
    tokens.push({ kind: 'word', text });
  }

  return tokens;
}

export function parseLine(raw: string): ParsedLine | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;

  const tokens = tokenize(trimmed);

  const words: string[] = [];
  let redirect: Redirect | undefined;

  for (let t = 0; t < tokens.length; t += 1) {
    const token = tokens[t]!;
    if (token.kind === 'word') {
      words.push(token.text);
      continue;
    }
    const next = tokens[t + 1];
    if (!next || next.kind !== 'word' || next.text.length === 0) {
      throw new ParseProblem(
        'dangling-redirect',
        `${token.op} needs the name of something to write into, after it`,
        token.op,
      );
    }
    redirect = { op: token.op, target: next.text };
    t += 1;
  }

  const spelling = words[0] ?? '';
  const parsed: ParsedLine = {
    name: spelling.toLowerCase(),
    spelling,
    args: words.slice(1),
    raw: trimmed,
  };
  if (redirect) parsed.redirect = redirect;
  return parsed;
}

/**
 * Edit distance, capped — used to turn "sl" into a nudge towards "ls".
 * Capping at 2 keeps suggestions honest: beyond that they are noise, and a
 * wrong suggestion is worse than none for a child who trusts CHIP.
 */
export function nearestWord(typed: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestScore = 3;

  for (const candidate of candidates) {
    const score = editDistance(typed.toLowerCase(), candidate);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return bestScore <= 2 ? best : undefined;
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j]!;
  }

  return prev[b.length]!;
}
