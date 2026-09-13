/**
 * Mission 17 — stage 8: computers can be there, or not there.
 *
 * One idea: you can knock on another computer and find out whether anything
 * answers.
 *
 * The attic computer is deliberately unreachable, and the mission is built
 * around that rather than around the success. A `ping` that always works
 * teaches nothing; a `ping` that fails, with a reason the child can picture
 * (a cable came loose), teaches what the command is actually *for*.
 */

import type { Mission } from './types.js';
import { ensureFile, ensureRoom } from './helpers.js';

export const m17: Mission = {
  id: 'm17-is-anybody-there',
  title: 'Is Anybody There?',
  stage: 8,
  minutes: [10, 15],

  teaches: ['net.reach'],
  requires: ['net.envelope', 'cat.read'],

  hook: [
    'I have been thinking about the other computers all night.',
    'How do you know if one is even switched on?',
    'You would not post a letter to an empty house.',
  ],

  goal: 'Find out which computers answer, and which do not.',

  async setup(world) {
    await ensureRoom(world, 'control-room');
    await ensureFile(
      world,
      'control-room/neighbours.txt',
      [
        'COMPUTERS WE KNOW ABOUT',
        '',
        '  gran   - Gran’s computer',
        '  moon   - the Moon Base',
        '  attic  - an old one in the attic',
        '',
        'I have never actually spoken to any of them.',
      ].join('\n'),
    );
  },

  startIn: 'control-room',

  steps: [
    {
      id: 'read-neighbours',
      concepts: ['cat.read'],

      prompt: {
        guided: ['I keep a list of them. Read neighbours.txt.'],
        prompted: ['I have a list of them somewhere in here.'],
        open: ['Who else is out there?'],
      },

      done: (event) => event.kind === 'file-read' && event.text.includes('COMPUTERS WE KNOW'),
      solution: 'cat neighbours.txt',

      hints: {
        ask: 'The reading word, then the name of the list.',
        concept: 'cat shows what is inside.',
        firstLetter: 'It starts with c.',
        choice: { line: 'Which one?', options: ['cat neighbours.txt', 'ping neighbours.txt'] },
        reveal: { line: 'cat, then the name.', command: 'cat neighbours.txt' },
      },

      success: ['Three of them. Let us knock and see who is in.'],
    },

    {
      id: 'ping-someone-there',
      concepts: ['net.reach'],

      prompt: {
        guided: [
          'The word for knocking is ping.',
          'ping, then the name of the computer.',
          'ping gran',
        ],
        prompted: ['There is a word that knocks on another computer. Try it on gran.'],
        open: ['See if Gran is in.'],
      },

      predict: {
        question: 'Do you think Gran’s computer will answer?',
        options: ['Yes', 'No', 'Not sure'],
        reply: 'Let us knock and find out.',
      },

      done: (event) => event.kind === 'net' && event.op === 'ping' && event.reachable,
      solution: 'ping gran',

      hints: {
        ask: 'Four letters. It is the sound of a knock.',
        concept: 'You send a tiny message and see if anything comes back.',
        firstLetter: 'It starts with p. It is not pwd.',
        choice: { line: 'Which one knocks?', options: ['ping gran', 'send gran'] },
        reveal: { line: 'ping, then the name.', command: 'ping gran' },
      },

      success: [
        'IT ANSWERED. Three times.',
        'And look at the number — that is how long the knock took to come back.',
        'Gran is further away than you would think.',
      ],
    },

    {
      id: 'ping-someone-not-there',
      concepts: ['net.reach'],

      prompt: {
        guided: ['Now try the attic one.', 'ping attic'],
        prompted: ['Try the old one in the attic.'],
        open: ['Try the other two.'],
      },

      predict: {
        question: 'Will the attic computer answer?',
        options: ['Yes', 'No', 'Not sure'],
        reply: 'Watch what happens.',
      },

      done: (event) => event.kind === 'net' && event.op === 'ping' && !event.reachable,
      solution: 'ping attic',

      // The failure IS the lesson here, so CHIP must not rush in with
      // "what is the computer telling us?" before the step's own reaction.
      nearMiss: (event) => (event.kind === 'error' ? [] : undefined),

      hints: {
        ask: 'Same word, different name.',
        concept: 'ping, then attic.',
        firstLetter: 'It starts with p.',
        choice: { line: 'Which one?', options: ['ping attic', 'ping gran'] },
        reveal: { line: 'ping attic.', command: 'ping attic' },
      },

      success: [
        'Nothing. Three knocks and nothing.',
        'But look at that last line — the message DID get somewhere.',
        'It reached the sorting station and then stopped.',
        'So the attic computer is not missing. Something between us is broken.',
      ],
    },
  ],

  celebration: {
    title: 'SOMEBODY ANSWERED',
    detail: 'And somebody did not. Both are worth knowing.',
  },

  recap: {
    question: 'When the attic did not answer, did we learn nothing?',
    accept: ['no', 'we learned', 'sorter', 'station', 'stopped', 'broken', 'something'],
    answer: ['We learned where it stopped. That is how you find what is broken.'],
  },
};
