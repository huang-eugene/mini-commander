/**
 * Mission 7 — stage 4: things, as opposed to places.
 *
 * One idea: `touch` makes an empty thing, and a thing is not a room.
 *
 * CHIP's false belief is the engine of this one. He insists `touch` builds a
 * room, which is wrong, and the child disproves it by running it and looking.
 * The brief asks for exactly this: "BYTE should sometimes make harmless
 * mistakes so the child can correct the robot... This reverses the
 * teacher/student relationship and strengthens recall."
 *
 * It also does real conceptual work. Rooms and files are the first genuine
 * taxonomy the child meets, and telling them apart by arguing about it beats
 * being told which is which.
 */

import type { Mission } from './types.js';
import { ensureRoom, madeAnyThing } from './helpers.js';

export const m07: Mission = {
  id: 'm07-empty-boxes',
  title: 'Empty Boxes',
  stage: 4,
  minutes: [8, 12],

  teaches: ['touch.make'],
  requires: ['mkdir.make', 'ls.look'],

  hook: [
    'Your base is still there. I checked. Twice.',
    'It is very empty though.',
    'I know another building word! I am almost sure about this one.',
  ],

  goal: 'Find out what touch really does.',

  async setup(world) {
    await ensureRoom(world, 'control-room');
  },

  startIn: 'control-room',

  claim: {
    // Wrong, and disproved by one command plus one look.
    claim: 'The word is touch. It builds a room, like mkdir but smaller. I am certain.',
    concept: 'touch.make',
    disprovedBy: (event) => event.kind === 'listed' && event.entries.length > 0,
    onCorrected: [
      'Wait. That is not a room at all.',
      'There is no slash after it. Rooms have a slash.',
      'It is a THING. You cannot walk into it.',
      'You were right and I was wrong. Again.',
    ],
  },

  steps: [
    {
      id: 'try-touch',
      concepts: ['touch.make'],

      prompt: {
        guided: ['Let us test my idea.', 'Type touch, then a name. Try this:', 'touch rock'],
        prompted: ['Try my word out. touch, then a name. Let us see what it makes.'],
        open: ['Test my idea.'],
      },

      predict: {
        question: 'Do you think CHIP is right that touch makes a room?',
        options: ['Yes, he is right', 'No, he is wrong', 'Not sure'],
        reply: 'Good. Now we find out for certain.',
      },

      done: madeAnyThing(),
      solution: 'touch rock',

      hints: {
        ask: 'The word I said. Five letters. Then a name.',
        concept: 'It is the word for making an empty thing.',
        firstLetter: 'It starts with t.',
        choice: { line: 'Which one?', options: ['touch rock', 'mkdir rock'] },
        reveal: { line: 'touch, then whatever you want to call it.', command: 'touch rock' },
      },

      success: ['Something happened. Or nothing did. Look and see.'],
    },

    {
      id: 'look-at-it',
      concepts: ['ls.look'],

      prompt: {
        guided: ['Look around. Is it a room, or is it something else?'],
        prompted: ['Have a look. Was I right?'],
        open: ['Well? Was I right?'],
      },

      done: (event) => event.kind === 'listed' && event.entries.length > 0,
      solution: 'ls',

      hints: {
        ask: 'The looking word. You have used it more than any other.',
        concept: 'Rooms get a slash after their name. Things do not.',
        firstLetter: 'It starts with l.',
        choice: { line: 'Which one?', options: ['ls', 'cd'] },
        reveal: { line: 'ls, and look for the slash.', command: 'ls' },
      },

      nearMiss: (event) => {
        if (event.kind === 'error' && event.command === 'cd' && event.code === 'ENOTDIR') {
          return [
            'You cannot walk into it! Look at what the computer said.',
            'That settles it. It is not a room.',
          ];
        }
        return undefined;
      },

      success: [
        'No slash. It is a thing, not a room.',
        'mkdir makes places. touch makes things.',
        'I will try to remember that.',
      ],
    },
  ],

  celebration: {
    title: 'CHIP WAS WRONG',
    detail: 'And you were the one who proved it.',
  },

  recap: {
    question: 'How can you tell a room from a thing when you look?',
    accept: ['slash', '/', 'line', 'stripe'],
    answer: ['Rooms have a slash after the name. Things do not.'],
  },

  rewards: { badges: ['bug-detective'], cosmetics: ['poster'] },
};
