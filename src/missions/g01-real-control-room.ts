/**
 * Graduation 1 — the same moves, in the child's own terminal.
 *
 * This is the mission that makes the whole game honest. Up to now a
 * reasonable child could conclude that `ls` is a thing CHIP does, the way a
 * spell is a thing a wizard does. Here they open their own Terminal or
 * PowerShell, type the same words at a prompt that has never heard of CHIP,
 * and watch the folder they built appear.
 *
 * It is skippable at every point. A grown-up may be busy, the shell may be
 * something unexpected, the child may not fancy it today. None of those are
 * reasons to block the curriculum, so `done` also completes if the child
 * simply says they are finished.
 */

import * as nodePath from 'node:path';

import type { Mission } from './types.js';
import { ensureFile, ensureRoom } from './helpers.js';
import { howToOpen, makeAFileHere, platformNow, provedIt, terminalName } from './graduation.js';
import { resolve } from '../shell/vpath.js';

const PLATFORM = platformNow();
const TERMINAL = terminalName(PLATFORM);

export const g01: Mission = {
  id: 'g01-real-control-room',
  title: 'The Real Control Room',
  stage: 'graduation',
  minutes: [10, 15],

  teaches: [],
  requires: ['ls.look', 'cd.into', 'mkdir.make', 'redirect.write'],

  hook: [
    'Explorer. I have to tell you something and I am a bit nervous.',
    'This control room is not the only one.',
    `Your computer has a real one, called ${TERMINAL}.`,
    'It has never heard of me. But it knows every word you know.',
  ],

  goal: `Do it for real, in ${TERMINAL}, with a grown-up.`,

  async setup(world) {
    await ensureRoom(world, 'control-room');
    await ensureFile(
      world,
      'control-room/the-real-one.txt',
      [
        'THE REAL CONTROL ROOM',
        '',
        'Everything you have learned is real.',
        'ls, cd, cat, mkdir, echo — those are not my words.',
        'They are the computer’s words.',
        '',
        'They work in a window I have nothing to do with.',
        'Go and see.',
      ].join('\n'),
    );
  },

  startIn: 'control-room',

  steps: [
    {
      id: 'read-the-news',
      concepts: ['cat.read'],

      prompt: {
        guided: ['I wrote it down because I could not say it. Read the-real-one.txt.'],
        prompted: ['There is something in here I need you to read.'],
        open: ['Read what I left you.'],
      },

      done: (event) => event.kind === 'file-read' && event.text.includes('REAL CONTROL ROOM'),
      solution: 'cat the-real-one.txt',

      hints: {
        ask: 'The reading word.',
        concept: 'cat, then the name.',
        firstLetter: 'It starts with c.',
        choice: { line: 'Which one?', options: ['cat the-real-one.txt', 'ls the-real-one.txt'] },
        reveal: { line: 'cat, then the name.', command: 'cat the-real-one.txt' },
      },

      success: [
        'It is true. I have been showing you the real thing all along.',
        'Now go and use it without me.',
      ],
    },

    {
      /**
       * The step happens outside the game entirely. `done` watches the real
       * folder on disk, so whatever the child's shell did — different
       * encoding, different line endings, different capitalisation — the
       * proof counts. See graduation.ts for why that matters on Windows.
       */
      id: 'do-it-for-real',
      concepts: [],

      prompt: {
        guided: [
          `Get a grown-up. Open ${TERMINAL} on this computer.`,
          ...howToOpen(PLATFORM),
          'Then type these, one at a time. I will wait here.',
          'When you are done, come back and type: done',
        ],
        prompted: [
          `Open ${TERMINAL} and make a file called proof.txt in my world folder.`,
          'Type done when you have.',
        ],
        open: [`Go and make proof.txt for real. Type done when you have.`],
      },

      // The card has to name the real folder on this machine, which is the
      // one thing no static string can know.
      card: (ctx) => {
        const folder = nodePath.join(ctx.world.rootReal, 'control-room');
        return makeAFileHere(PLATFORM, folder).map((i) => i.type);
      },

      predict: {
        question: `Do you think ls will work in ${TERMINAL} too?`,
        options: ['Yes, the same', 'No, different words'],
        reply: 'Only one way to know.',
      },

      // Completes either when the real file appears, or when the child says
      // they are finished. Never a wall.
      done: async (event, ctx) => {
        if (event.kind === 'free-text' && /^\s*(done|finished|skip|stop)\b/i.test(event.text)) {
          return true;
        }

        // Through the jail's raw read, so PowerShell 5.1's UTF-16LE output
        // counts as the success it is. See graduation.ts.
        return provedIt(
          (name) => ctx.world.readBytes(resolve(ctx.anchor, name), 'ls'),
          'proof.txt',
        );
      },

      solution: 'echo I did it for real > proof.txt',
      revealIsPartial: true,

      hints: {
        ask: `What did I ask you to make in ${TERMINAL}?`,
        concept: 'A file called proof.txt, with some words in it.',
        firstLetter: 'The same echo and arrow you already know.',
        choice: {
          line: 'In the real one, type:',
          options: ['echo hello > proof.txt', 'make proof.txt'],
        },
        reveal: {
          line: 'If the real one is being difficult, just do it here instead. It still counts.',
          command: 'echo I did it for real > proof.txt',
        },
      },

      success: [
        'YOU DID IT SOMEWHERE ELSE.',
        'Not in my control room. In the real one.',
        'Everything you know works out there. It always did.',
      ],
    },
  ],

  celebration: {
    title: 'IT WORKS OUT THERE TOO',
    detail: 'You used a real terminal.',
  },

  recap: {
    question: 'Were the words different in the real one?',
    accept: ['no', 'same', 'the same', 'mostly'],
    answer: ['Almost all the same. They are the computer’s words, not mine.'],
  },

  rewards: { artifacts: ['proof.txt'] },
};
