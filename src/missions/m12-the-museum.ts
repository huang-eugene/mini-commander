/**
 * Mission 12 — stage 6: combining, with a twist instead of a new idea.
 *
 * The brief: "If the child solves something easily, introduce a small twist
 * rather than immediately introducing a completely new concept."
 *
 * So this one introduces `mv` only because the goal *needs* it — the child
 * has things in the wrong place and no way to move them. The command arrives
 * as the answer to a problem they already have, rather than as the next item
 * on a list.
 *
 * It also brings `touch` back, four missions after m07, for labels. Same
 * command, new purpose.
 */

import type { Mission } from './types.js';
import { ensureFile, ensureRoom } from './helpers.js';
import { basename } from '../shell/vpath.js';

export const m12: Mission = {
  id: 'm12-the-museum',
  title: 'The Museum',
  stage: 6,
  minutes: [10, 15],

  teaches: ['move.rename'],
  requires: ['mkdir.make', 'touch.make', 'cd.into', 'ls.look', 'combine.plan'],

  hook: [
    'I have been collecting.',
    'Everything is in a heap in the control room and I cannot find anything.',
    'I want a museum. A proper one, with a label.',
  ],

  goal: 'Build a museum, move a treasure into it, and label it.',

  async setup(world) {
    await ensureRoom(world, 'control-room');
    await ensureFile(
      world,
      'control-room/old-bolt.txt',
      ['A bolt.', '', 'It fell off me. I do not know from where.'].join('\n'),
    );
    await ensureFile(
      world,
      'control-room/odd-sock.txt',
      ['One sock.', '', 'I do not have feet. This is a mystery.'].join('\n'),
    );
    await ensureFile(
      world,
      'control-room/.tiny-key.txt',
      [
        'A TINY KEY',
        '',
        'CHIP hid this and then forgot he hid it,',
        'which is the most CHIP thing possible.',
        '',
        'Nobody knows what it opens.',
      ].join('\n'),
    );
  },

  startIn: 'control-room',

  steps: [
    {
      id: 'survey-the-heap',
      concepts: ['ls.look', 'cat.read'],

      prompt: {
        guided: ['Have a look at the heap, and read one of the treasures.'],
        prompted: ['See what I have collected, and read one.'],
        open: ['See what I have got.'],
      },

      done: (event) => event.kind === 'file-read',
      solution: ['ls', 'cat old-bolt.txt'],

      hints: {
        ask: 'Look first, then read one of them.',
        concept: 'ls shows the heap. cat shows what one of them is.',
        firstLetter: 'Looking starts with l. Reading starts with c.',
        choice: { line: 'To read the bolt:', options: ['cat old-bolt.txt', 'ls old-bolt.txt'] },
        reveal: { line: 'cat, then a treasure name.', command: 'cat old-bolt.txt' },
      },

      success: ['A bolt and a sock. It is not much of a collection yet.'],
    },

    {
      // `ls -a` came up once, in m09, and would otherwise never return.
      // Here the purpose is completely different: not "what is the computer
      // hiding from me" but "what did I hide from myself".
      id: 'anything-hiding',
      concepts: ['ls.hidden'],

      prompt: {
        guided: [
          'Hang on. I have a feeling I hid something in here once.',
          'Can you look the way that shows the hidden ones too?',
        ],
        prompted: ['I think I hid something in here. Can you find it?'],
        open: ['I think there is more in here than we can see.'],
      },

      predict: {
        question: 'Do you think there is something hidden in the heap?',
        options: ['Yes', 'No'],
        reply: 'One way to find out.',
      },

      done: (event) => event.kind === 'listed' && event.showedHidden,
      solution: 'ls -a',

      hints: {
        ask: 'Hidden things start with a dot. How did we see them last time?',
        concept: 'You add something small onto the end of the looking word.',
        firstLetter: 'A dash, then the letter a. It stands for "all".',
        choice: { line: 'Which shows everything?', options: ['ls -a', 'ls all'] },
        reveal: { line: 'ls -a shows the hidden ones too.', command: 'ls -a' },
      },

      success: [
        'A TINY KEY. I hid it and forgot. That is so like me.',
        'That is definitely going in the museum.',
      ],
    },

    {
      id: 'build-the-museum',
      concepts: ['mkdir.make', 'combine.plan'],

      prompt: {
        guided: ['Build a room for the museum. Call it whatever you like.'],
        prompted: ['The museum needs somewhere to be.'],
        open: ['Start the museum.'],
      },

      done: (event) => event.kind === 'dir-created',
      solution: 'mkdir museum',

      hints: {
        ask: 'You have built a room before. Same word.',
        concept: 'The building word, then a name.',
        firstLetter: 'It starts with m-k.',
        choice: { line: 'Which one builds?', options: ['mkdir museum', 'touch museum'] },
        reveal: { line: 'mkdir, then the name.', command: 'mkdir museum' },
      },

      success: ['A museum! An empty one, but they all start that way.'],
    },

    {
      id: 'move-a-treasure',
      concepts: ['move.rename'],

      prompt: {
        guided: [
          'Now we need to get a treasure into it.',
          'The word is mv, short for "move".',
          'You say mv, then what to move, then where to put it.',
          'mv old-bolt.txt museum',
        ],
        prompted: [
          'There is a word for moving something into a room.',
          'Two letters, short for move.',
        ],
        open: ['Get a treasure into the museum.'],
      },

      predict: {
        question: 'After we move the bolt, will it still be in the control room?',
        options: ['Yes, in both places', 'No, only in the museum'],
        reply: 'We can check with ls afterwards.',
      },

      done: (event) => event.kind === 'moved' && !event.copy,
      solution: 'mv old-bolt.txt museum',

      hints: {
        ask: 'It is short for "move". Just two letters.',
        concept: 'mv, then the thing, then where it should go.',
        firstLetter: 'It starts with m, but it is not mkdir.',
        choice: {
          line: 'Which one moves it?',
          options: ['mv old-bolt.txt museum', 'cd old-bolt.txt museum'],
        },
        reveal: { line: 'mv, the thing, then the room.', command: 'mv old-bolt.txt museum' },
      },

      nearMiss: (event) => {
        if (event.kind === 'error' && event.command === 'mv' && event.code === 'ENOENT') {
          return ['The computer cannot find one of those names. Try ls and copy it exactly.'];
        }
        return undefined;
      },

      success: [
        'It moved! It is not in the control room any more.',
        'Moving is not copying. There is still only one bolt.',
      ],
    },

    {
      id: 'label-it',
      concepts: ['touch.make', 'combine.plan'],

      prompt: {
        guided: [
          'Every museum needs a label.',
          'Go into the museum and make an empty thing called label.txt.',
        ],
        prompted: ['A museum needs a label. Make an empty one inside the museum.'],
        open: ['It needs a label.'],
      },

      done: async (event, ctx) => {
        if (event.kind !== 'file-created') return false;
        // Any empty thing, anywhere inside a room that is not the start.
        return basename(ctx.cwd) !== 'control-room' || basename(event.path).length > 0;
      },

      solution: ['cd museum', 'touch label.txt'],

      hints: {
        ask: 'The word for making an empty thing. You caught me out with it once.',
        concept: 'It was the one I thought made rooms. It does not.',
        firstLetter: 'It starts with t.',
        choice: {
          line: 'Which one makes an empty thing?',
          options: ['touch label.txt', 'mkdir label.txt'],
        },
        reveal: { line: 'Walk in first, then touch.', command: 'touch label.txt' },
      },

      success: [
        'A museum, a treasure and a label.',
        'You used four different words to do that, in the right order, on your own.',
      ],
    },
  ],

  celebration: {
    title: 'THE MUSEUM IS OPEN',
    detail: 'Four commands, combined, with nobody telling you the order.',
  },

  recap: {
    question: 'When you moved the bolt, how many bolts were there afterwards?',
    accept: ['one', '1', 'same', 'still one'],
    answer: ['One. Moving takes it with you. It does not make another.'],
  },

  rewards: { artifacts: ['old-bolt.txt'] },
};
