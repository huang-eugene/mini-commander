/**
 * Mission 13 — stage 7: a program is stored instructions.
 *
 * One idea, and it is a big one: instead of telling the computer one thing
 * at a time, you can write the instructions down and have it follow them
 * later.
 *
 * The child reads the spell with `cat` before running it, which matters —
 * seeing that a program is just a file with words in it, a file exactly like
 * the note they wrote in mission 8, is the whole demystification. A program
 * is not a special kind of magic object. It is a list.
 */

import type { Mission } from './types.js';
import { ensureFile, ensureRoom, readFile } from './helpers.js';

export const m13: Mission = {
  id: 'm13-the-spell-book',
  title: 'The Spell Book',
  stage: 7,
  minutes: [10, 15],

  teaches: ['program.run'],
  requires: ['cat.read', 'ls.look', 'cd.into'],

  hook: [
    'Explorer. I found something in the lab.',
    'It is a file, but it is full of COMMANDS.',
    'Words like the ones you type. Just sitting there. Written down.',
    'I do not know what happens if we let the computer read them.',
  ],

  goal: 'Find out what happens when the computer follows a written list.',

  async setup(world) {
    await ensureRoom(world, 'control-room');
    await ensureFile(
      world,
      'control-room/lab/tidy-up.spell',
      ['echo Tidying the lab', 'mkdir shelf', 'echo Done!'].join('\n'),
    );
  },

  startIn: 'control-room',

  steps: [
    {
      id: 'go-and-read-it',
      concepts: ['cd.into', 'cat.read'],

      prompt: {
        guided: [
          'It is in the lab. Go in, look around, and read it.',
          'It is called tidy-up.spell.',
        ],
        prompted: ['It is in the lab. Go and read it before we do anything.'],
        open: ['Have a look at it first.'],
      },

      predict: {
        question: 'What do you think is written inside a file full of commands?',
        reply: 'Let us go and see.',
      },

      done: readFile('tidy-up.spell'),
      solution: ['cd lab', 'cat tidy-up.spell'],

      hints: {
        ask: 'Walk into the lab, then read the file.',
        concept: 'cd to get there. cat to read it.',
        firstLetter: 'Walking starts with c-d. Reading starts with c-a-t.',
        choice: { line: 'To read it once you are there:', options: ['cat tidy-up.spell', 'run'] },
        reveal: { line: 'cat, then the name.', command: 'cat tidy-up.spell' },
      },

      success: [
        'Three lines. Three commands. Just written down.',
        'That is all it is. A list, in a file.',
        'Nothing has happened yet though. They are only words.',
      ],
    },

    {
      id: 'run-it',
      concepts: ['program.run'],

      prompt: {
        guided: [
          'There is a word that makes the computer follow a written list.',
          'It is run. Then the name of the list.',
          'run tidy-up.spell',
        ],
        prompted: ['There is a word that makes the computer do all of them, in order.'],
        open: ['Make the computer follow them.'],
      },

      predict: {
        question: 'How many of those three lines will the computer do?',
        options: ['Just the first', 'All three', 'None of them'],
        reply: 'Watch carefully. It goes one at a time.',
      },

      done: (event) => event.kind === 'program-run' && event.failedLine === undefined,
      solution: 'run tidy-up.spell',

      hints: {
        ask: 'Three letters. It means "do this".',
        concept: 'You give it the name of the list and it does every line.',
        firstLetter: 'It starts with r.',
        choice: { line: 'Which one?', options: ['run tidy-up.spell', 'cat tidy-up.spell'] },
        reveal: { line: 'run, then the name of the spell.', command: 'run tidy-up.spell' },
      },

      success: [
        'ALL THREE. In order. Without you typing any of them.',
        'You wrote nothing and it did three things.',
        'That is what a program is. Instructions, kept, for later.',
      ],
    },

    {
      id: 'check-it-worked',
      concepts: ['ls.look'],

      prompt: {
        guided: ['It said it made a shelf. Look and see if it really did.'],
        prompted: ['Did it actually do it, or just say it did?'],
        open: ['Check it really happened.'],
      },

      done: (event) => event.kind === 'listed' && event.entries.includes('shelf'),
      solution: 'ls',

      hints: {
        ask: 'The looking word. Is the shelf really there?',
        concept: 'A program does real things, not pretend ones.',
        firstLetter: 'It starts with l.',
        choice: { line: 'Which one?', options: ['ls', 'run'] },
        reveal: { line: 'ls, and look for the shelf.', command: 'ls' },
      },

      success: [
        'A real shelf. The list really did it.',
        'The computer did not know it was a list. It just did each line.',
      ],
    },
  ],

  celebration: {
    title: 'INSTRUCTIONS, KEPT',
    detail: 'A program is a list of commands, written down.',
  },

  recap: {
    question: 'What is inside a program?',
    accept: ['commands', 'words', 'list', 'instructions', 'lines', 'writing'],
    answer: ['Commands. The same ones you type. Just written down first.'],
  },

  rewards: { artifacts: ['tidy-up.spell'] },
};
