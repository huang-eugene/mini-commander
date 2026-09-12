/**
 * Mission 9 — stage 5: some things are hidden.
 *
 * One idea: `ls` does not show everything, and `ls -a` does.
 *
 * This is the child's first encounter with a *flag*, and with the more
 * unsettling idea that the computer has been quietly not telling them
 * things. Both are worth meeting early and in a friendly way, because the
 * alternative is meeting them later and concluding the computer is
 * untrustworthy.
 */

import type { Mission } from './types.js';
import { ensureFile, ensureRoom, lookedForHidden, readFile } from './helpers.js';

export const m09: Mission = {
  id: 'm09-invisible-ink',
  title: 'Invisible Ink',
  stage: 5,
  minutes: [8, 12],

  teaches: ['ls.hidden'],
  requires: ['ls.look', 'cat.read', 'redirect.write'],

  hook: [
    'Explorer. Something strange.',
    'I counted the things in the control room. Then I counted again.',
    'The computer knows about something it is not showing us.',
    'I can feel it.',
  ],

  goal: 'Find the thing the computer is hiding.',

  async setup(world) {
    await ensureRoom(world, 'control-room');
    await ensureFile(
      world,
      'control-room/.hidden-letter.txt',
      [
        'YOU FOUND IT.',
        '',
        'Things that start with a dot are hidden.',
        'Not locked. Not secret. Just quiet.',
        '',
        'Computers hide the boring ones so you can',
        'see the things you actually care about.',
        '',
        'Now you know how to look anyway.',
      ].join('\n'),
    );
  },

  startIn: 'control-room',

  steps: [
    {
      id: 'normal-look',
      concepts: ['ls.look'],

      prompt: {
        guided: ['Look around the control room the normal way first.'],
        prompted: ['Have a normal look around first.'],
        open: ['Look around.'],
      },

      done: (event) => event.kind === 'listed' && !event.showedHidden,
      solution: 'ls',

      hints: {
        ask: 'The usual looking word.',
        concept: 'Two letters. The one you always use.',
        firstLetter: 'It starts with l.',
        choice: { line: 'Which one?', options: ['ls', 'cat'] },
        reveal: { line: 'ls.', command: 'ls' },
      },

      success: ['That is what it wants us to see.', 'But I am telling you there is more.'],
    },

    {
      id: 'hidden-look',
      concepts: ['ls.hidden'],

      prompt: {
        guided: [
          'You can ask ls to show everything.',
          'Add a space, then a dash, then the letter a.',
          'The a means "all".',
          'ls -a',
        ],
        prompted: [
          'There is a way to tell ls to show absolutely everything.',
          'It is a dash and one letter.',
        ],
        open: ['Make it show us everything.'],
      },

      predict: {
        question: 'How many extra things do you think are hiding?',
        options: ['None', 'One', 'Lots'],
        reply: 'Let us count them.',
      },

      done: lookedForHidden(),
      solution: 'ls -a',

      hints: {
        ask: 'Same word, with something added on the end.',
        concept: 'A dash, then a letter that stands for "all".',
        firstLetter: 'The letter is a.',
        choice: { line: 'Which one shows everything?', options: ['ls -a', 'ls all'] },
        reveal: { line: 'ls -a. The dash-a means all of them.', command: 'ls -a' },
      },

      success: ['THERE. A new one, starting with a dot.', 'It was there the whole time.'],
    },

    {
      id: 'read-the-hidden',
      concepts: ['cat.read'],

      prompt: {
        guided: ['Read it. The dot is part of its name, so type that too.'],
        prompted: ['Go on then. Read it.'],
        open: ['Read it.'],
      },

      done: readFile('.hidden-letter.txt'),
      solution: 'cat .hidden-letter.txt',

      hints: {
        ask: 'The reading word, then the name including its dot.',
        concept: 'The dot at the front is part of the name, not a full stop.',
        firstLetter: 'Start with cat, then a space, then the dot.',
        choice: {
          line: 'Which name is right?',
          options: ['.hidden-letter.txt', 'hidden-letter.txt'],
        },
        reveal: { line: 'The dot comes first.', command: 'cat .hidden-letter.txt' },
      },

      nearMiss: (event) => {
        if (event.kind === 'error' && event.code === 'ENOENT') {
          return [
            'Not found. Did you leave the dot off the front?',
            'The dot is part of its name.',
          ];
        }
        return undefined;
      },

      success: ['So that is all a dot means. Quiet, not locked.', 'I feel less spied on now.'],
    },
  ],

  celebration: {
    title: 'NOTHING STAYS HIDDEN',
    detail: 'You can see everything the computer has.',
  },

  recap: {
    question: 'What makes something hidden?',
    accept: ['dot', '.', 'full stop', 'point'],
    answer: ['A dot at the front of its name. That is the whole trick.'],
  },

  rewards: { cosmetics: ['window'], artifacts: ['.hidden-letter.txt'] },
};
