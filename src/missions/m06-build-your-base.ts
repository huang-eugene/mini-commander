/**
 * Mission 6 — stage 4: the world can be changed.
 *
 * One idea: you can make a new room, and it stays.
 *
 * The child names it themselves. That matters more than it looks — up to now
 * every room in the world was written by someone else, and the first room
 * with their name on it is the moment the world stops being a lesson and
 * starts being a place. It is never deleted by anything, ever.
 */

import type { Mission } from './types.js';
import { builtAnyRoom, ensureFile, ensureRoom } from './helpers.js';

export const m06: Mission = {
  id: 'm06-build-your-base',
  title: 'Build Your Base',
  stage: 4,
  minutes: [8, 12],

  teaches: ['mkdir.make'],
  requires: ['cd.into', 'ls.look', 'cat.read'],

  hook: [
    'Right. The note said we would build a secret base.',
    'I have been thinking about it for days.',
    'I cannot build. I can only look at things.',
    'But you can.',
  ],

  goal: 'Build your own room, and go inside it.',

  async setup(world) {
    await ensureRoom(world, 'control-room');
    await ensureFile(
      world,
      'control-room/plans.txt',
      [
        'SECRET BASE PLANS',
        '',
        'Step one: make a room.',
        'Step two: think of more steps.',
        '',
        'That is as far as I got.',
      ].join('\n'),
    );
  },

  startIn: 'control-room',

  steps: [
    {
      id: 'read-the-plans',
      concepts: ['ls.look', 'cat.read'],

      prompt: {
        guided: ['I wrote plans. They are in this room somewhere.', 'Look around, then read them.'],
        prompted: ['My plans are in here. Can you find them and read them?'],
        open: ['Find my plans.'],
      },

      done: (event) => event.kind === 'file-read',
      solution: 'cat plans.txt',

      hints: {
        ask: 'Two words you know: one to look, one to read.',
        concept: 'ls shows what is here. cat shows what is inside it.',
        firstLetter: 'Looking starts with l. Reading starts with c.',
        choice: { line: 'To read the plans:', options: ['cat plans.txt', 'ls plans.txt'] },
        reveal: { line: 'cat, then the name.', command: 'cat plans.txt' },
      },

      success: ['They are not very good plans.', 'But step one is a room, so let us make a room.'],
    },

    {
      id: 'make-a-room',
      concepts: ['mkdir.make'],

      prompt: {
        guided: [
          'The word for building a room is mkdir.',
          'It is short for "make directory" — directory is the other name for room.',
          'Type mkdir, then whatever you want your room to be called.',
          'Keep the name short and use a dash instead of a space.',
        ],
        prompted: [
          'There is a word for building a new room.',
          'Build one and call it whatever you like.',
        ],
        open: ['Build your base. Call it anything.'],
      },

      predict: {
        question: 'Once you build it, do you think it will still be here tomorrow?',
        options: ['Yes, it stays', 'No, it disappears'],
        reply: 'We can check tomorrow. I will not touch it, I promise.',
      },

      done: builtAnyRoom(),
      solution: 'mkdir base',

      hints: {
        ask: 'It starts with m. Do you remember the rest?',
        concept: 'It is short for "make directory", squashed into one word.',
        firstLetter: 'm-k-d-i-r. Then a space. Then your name for it.',
        choice: { line: 'Which one builds?', options: ['mkdir base', 'ls base'] },
        reveal: { line: 'mkdir, then the name you want.', command: 'mkdir base' },
      },

      nearMiss: (event) => {
        if (event.kind === 'error' && event.code === 'EEXIST') {
          return ['There is already one with that name. Try a different name.'];
        }
        if (event.kind === 'error' && event.code === 'EINVAL') {
          return [
            'The computer does not like that name.',
            'Try letters and dashes, with no spaces.',
          ];
        }
        if (event.kind === 'error' && event.command === 'mkdir' && event.code === 'MISSING_ARG') {
          return ['It needs to know what to call the room. Put a name after mkdir.'];
        }
        return undefined;
      },

      success: ['You BUILT that. It was not there and now it is.', 'Nobody else made it. You did.'],
    },

    {
      id: 'go-inside',
      concepts: ['cd.into', 'ls.look'],

      prompt: {
        guided: ['Now walk into it, and have a look around inside.'],
        prompted: ['Go and stand in your new room.'],
        open: ['Go inside.'],
      },

      done: (event) => event.kind === 'listed',
      solution: 'ls',

      hints: {
        ask: 'You know how to walk into a room. Then have a look.',
        concept: 'cd to go in, ls to look once you are there.',
        firstLetter: 'Walking starts with c. Looking starts with l.',
        choice: { line: 'To go in:', options: ['cd base', 'mkdir base'] },
        reveal: { line: 'cd, then your room name. Then ls.', command: 'ls' },
      },

      success: [
        'Completely empty. Of course it is — you only just made it.',
        'We will put things in it. That is tomorrow.',
      ],
    },
  ],

  celebration: {
    title: 'YOUR BASE EXISTS',
    detail: 'You made a real place inside the computer.',
  },

  recap: {
    question: 'Who made that room?',
    accept: ['me', 'i did', 'you', 'us', 'we did', 'i made'],
    answer: ['You did. And it will still be there next time.'],
  },

  rewards: { cosmetics: ['lamp'] },
};
