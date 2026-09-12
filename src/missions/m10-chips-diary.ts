/**
 * Mission 10 — stage 5: adding without replacing.
 *
 * One idea: one arrow replaces everything, two arrows add to the end.
 *
 * The lesson is taught by loss, on purpose. The child writes a line, writes
 * another with a single arrow, and the first one is gone. That is a real,
 * slightly indignant surprise, and it makes the difference between `>` and
 * `>>` land in a way no explanation would.
 *
 * It is safe to do that here precisely because the world is a sandbox and
 * nothing of theirs is at stake — which is the whole argument for having a
 * sandbox in the first place.
 */

import type { Mission } from './types.js';
import { appendedTo, ensureRoom, readFile, wroteInto } from './helpers.js';

export const m10: Mission = {
  id: 'm10-chips-diary',
  title: "CHIP's Diary",
  stage: 5,
  minutes: [10, 15],

  teaches: ['redirect.append'],
  requires: ['redirect.write', 'cat.read'],

  hook: [
    'I want to keep a diary.',
    'A robot should have a diary. I have decided.',
    'You will have to write it. I cannot type.',
  ],

  goal: 'Write more than one line into the same file.',

  async setup(world) {
    await ensureRoom(world, 'control-room');
  },

  startIn: 'control-room',

  steps: [
    {
      id: 'first-entry',
      concepts: ['redirect.write'],

      prompt: {
        guided: ['Start the diary. Use the arrow you know.', 'echo day one > diary.txt'],
        prompted: ['Put the first line into a file called diary.txt.'],
        open: ['Start my diary.'],
      },

      done: wroteInto('diary.txt'),
      solution: 'echo day one > diary.txt',

      hints: {
        ask: 'You did this last time. echo, words, arrow, name.',
        concept: 'The arrow sends the words into the file instead of the screen.',
        firstLetter: 'Start with echo.',
        choice: {
          line: 'Which one?',
          options: ['echo day one > diary.txt', 'cat day one > diary.txt'],
        },
        reveal: {
          line: 'echo, the words, then > and the name.',
          command: 'echo day one > diary.txt',
        },
      },

      success: ['Day one. A good start.'],
    },

    {
      id: 'lose-the-first-entry',
      concepts: ['redirect.write'],

      prompt: {
        guided: [
          'Now add tomorrow. Use the same arrow again:',
          'echo day two > diary.txt',
          'Then read the diary and see what happened.',
        ],
        prompted: ['Add day two the same way, then read the whole diary.'],
        open: ['Add another day, then read it back.'],
      },

      predict: {
        question: 'After adding day two, how many days will be in the diary?',
        options: ['One', 'Two', 'Not sure'],
        reply: 'Right. Let us look.',
      },

      done: readFile('diary.txt'),
      solution: 'cat diary.txt',

      hints: {
        ask: 'Write day two the same way, then read the file.',
        concept: 'Use the same arrow, then use cat to see the result.',
        firstLetter: 'Reading starts with c.',
        choice: { line: 'To see the diary:', options: ['cat diary.txt', 'ls diary.txt'] },
        reveal: { line: 'cat shows you the whole thing.', command: 'cat diary.txt' },
      },

      success: [
        'Day one is GONE.',
        'The single arrow did not add anything. It threw the old words out and put the new ones in.',
        'I have lost a whole day of my life.',
      ],
    },

    {
      id: 'use-two-arrows',
      concepts: ['redirect.append'],

      prompt: {
        guided: [
          'There is a second kind of arrow. Two of them together.',
          'Two arrows means "add this on the end" instead of "throw it all out".',
          'echo day three >> diary.txt',
        ],
        prompted: [
          'There is another arrow that adds instead of replacing.',
          'It is the same one, twice.',
        ],
        open: ['Find a way to add a day without losing the last one.'],
      },

      done: appendedTo('diary.txt'),
      solution: 'echo day three >> diary.txt',

      hints: {
        ask: 'What if you used more than one arrow?',
        concept: 'One arrow replaces. Two arrows add to the end.',
        firstLetter: 'Type the arrow twice, with no space between them.',
        choice: {
          line: 'Which one adds?',
          options: ['echo day three >> diary.txt', 'echo day three > diary.txt'],
        },
        reveal: {
          line: 'Two arrows. That is the only difference.',
          command: 'echo day three >> diary.txt',
        },
      },

      success: ['Now read it again and see if day two survived.'],
    },

    {
      id: 'confirm-it-grew',
      concepts: ['cat.read'],

      prompt: {
        guided: ['Read the diary one more time.'],
        prompted: ['Did it work? Check.'],
        open: ['Check.'],
      },

      done: readFile('diary.txt'),
      solution: 'cat diary.txt',

      hints: {
        ask: 'The reading word.',
        concept: 'cat, then the name of the diary.',
        firstLetter: 'It starts with c.',
        choice: { line: 'Which one?', options: ['cat diary.txt', 'ls -a'] },
        reveal: { line: 'cat diary.txt.', command: 'cat diary.txt' },
      },

      success: [
        'BOTH DAYS. It grew instead of starting over.',
        'One arrow replaces. Two arrows add.',
        'I will never lose a day again.',
      ],
    },
  ],

  celebration: {
    title: 'THE DIARY GROWS',
    detail: 'One arrow replaces. Two arrows add.',
  },

  recap: {
    question: 'What is the difference between one arrow and two?',
    accept: ['add', 'adds', 'replace', 'replaces', 'end', 'keeps', 'two', 'both'],
    answer: ['One throws the old words away. Two adds to the end.'],
  },

  rewards: { artifacts: ['diary.txt'], cosmetics: ['pet'] },
};
