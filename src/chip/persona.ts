/**
 * CHIP.
 *
 * The brief is specific: curious, slightly mischievous, occasionally
 * confused, dependent on the child, concise, and never patronising. CHIP does
 * not sound like a teacher. He asks for help and means it.
 *
 * The hard rule enforced here is: no generic praise. "Good job!" after every
 * command is noise, and a child tunes it out within a session. So the line
 * banks are keyed to *what actually happened* and the reactor picks from the
 * narrowest bank that applies. Where a bank would only have generic lines,
 * it has none, and CHIP stays quiet instead.
 *
 * Randomness is seeded so that transcripts are reproducible.
 */

export type Mood =
  | 'greet-first-time'
  | 'greet'
  | 'command-worked'
  | 'nothing-here'
  | 'real-error'
  | 'unknown-command'
  | 'near-miss-command'
  | 'unsupported-syntax'
  | 'edge-of-world'
  | 'discovery'
  | 'made-something'
  | 'read-something'
  | 'wandering'
  | 'prediction-thanks'
  | 'corrected'
  | 'goodbye';

/**
 * A tiny seeded generator. Not for anything that matters cryptographically —
 * only so that CHIP says the same thing twice in a test run.
 */
export class Rng {
  private state: number;

  constructor(seed = 1) {
    this.state = seed >>> 0 || 1;
  }

  next(): number {
    // xorshift32
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x1_0000_0000;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }
}

const LINES: Record<Mood, readonly string[]> = {
  // The very first time. CHIP has never met them, so he cannot be pleased
  // they came back.
  'greet-first-time': ['Hello? Is somebody actually there?', 'Oh! A person. A real one.'],

  greet: ['Explorer! You came back.', 'Oh good, it is you.', 'You are here. I have been waiting.'],

  // Deliberately about the *act*, never "well done". CHIP notices; he does
  // not award marks.
  'command-worked': ['The computer did it.', 'It listened.', 'There. That worked.'],

  'nothing-here': ['Empty. Interesting.', 'Nothing in this one.', 'Hmm. Bare walls.'],

  // The error is a clue, not a failure. CHIP always hands it back as a
  // question, because the child reading it is the whole lesson.
  'real-error': [
    'The computer said something. What do you think it is telling us?',
    'Look at that message. What do you make of it?',
    'It answered us. Can you work out what it means?',
  ],

  'unknown-command': [
    'The computer has never heard that word.',
    'It does not know that one.',
    'That is not a word the computer knows yet.',
  ],

  'near-miss-command': [
    'So close. Look at the letters again.',
    'Nearly. One letter is off, I think.',
  ],

  'unsupported-syntax': [
    'My control room is simpler than that. Try it without the squiggle.',
    'I do not have that button in here.',
  ],

  'edge-of-world': [
    'That is the edge. My world stops there.',
    'We cannot go further up. That is the outside wall.',
  ],

  discovery: [
    'Wait. You found something.',
    'Oh! I did not know that was there.',
    'You found it. I have walked past that a hundred times.',
  ],

  'made-something': [
    'It exists now. You made that.',
    'It is really there. It will still be there tomorrow.',
  ],

  'read-something': ['So that is what it says.', 'Now we know.'],

  wandering: [
    'Poking about? Good. I do that too.',
    'Go on then, have a look.',
    'I like that you tried that.',
  ],

  // Never "correct!" — the point was making a guess at all.
  'prediction-thanks': [
    'A guess is good. Let us find out.',
    'Right, let us see if that is what happens.',
    'Good. Now we test it.',
  ],

  corrected: [
    'Oh! You are right and I was wrong. Thank you.',
    'You caught me. I will remember that properly now.',
    'You are right. I had that completely backwards.',
  ],

  goodbye: [
    'Same time tomorrow, explorer?',
    'I will keep everything exactly where it is.',
    'Go on. I will be here.',
  ],
};

export class Chip {
  private readonly recent = new Map<Mood, string>();

  constructor(private readonly rng: Rng = new Rng()) {}

  /**
   * A line for the situation, avoiding an immediate repeat. Returns undefined
   * when there is nothing specific worth saying — silence beats filler.
   */
  say(mood: Mood): string | undefined {
    const bank = LINES[mood];
    if (!bank || bank.length === 0) return undefined;

    const last = this.recent.get(mood);
    const choices = bank.length > 1 ? bank.filter((l) => l !== last) : bank;
    const line = this.rng.pick(choices);
    this.recent.set(mood, line);
    return line;
  }
}

/**
 * Things CHIP believes that are wrong, for the child to put right. Used by
 * missions that opt in via their `claim` field. Each one is harmless, each
 * one is disproved by a single command, and CHIP is delighted to be
 * corrected — which is the point. It reverses the teacher/student roles and
 * makes the child the one who knows.
 */
export const CHIP_WRONG_IDEAS: readonly { about: string; claim: string }[] = [
  { about: 'ls', claim: 'I am fairly sure ls builds a brand new room.' },
  { about: 'touch', claim: 'touch makes a room, I think. A small one.' },
  { about: 'pwd', claim: 'pwd tells you the time. Almost certain.' },
  { about: 'cd ..', claim: 'Two dots means go in deeper, surely?' },
  { about: 'cat', claim: 'I think cat is for making things, not reading them.' },
];
