/**
 * Mission 3 — stage 2 continued: files hold information.
 *
 * One idea: the thing we found yesterday has words inside it, and there is a
 * command that shows them.
 *
 * CHIP's false belief lands here. He is confident `cat` is for making things
 * rather than reading them, which is wrong, and the child gets to correct
 * him by simply running it. Being right about something an adult-shaped
 * character got wrong is worth more to a 7-year-old than any badge.
 */

import type { Mission } from './types.js';
import { ensureFile, ensureRoom, readFile } from './helpers.js';

export const m03: Mission = {
  id: 'm03-the-message',
  title: 'The Message',
  stage: 2,
  minutes: [5, 10],

  teaches: ['cat.read'],
  requires: ['ls.look'],

  hook: [
    'You came back!',
    'The message is still there. I checked about forty times.',
    'I still cannot read it.',
  ],

  goal: 'Read what the message says.',

  async setup(world) {
    await ensureRoom(world, 'control-room');
    await ensureFile(
      world,
      'control-room/message-from-chip.txt',
      [
        'WELCOME, EXPLORER.',
        '',
        'I need your help.',
        'Tomorrow we build our secret base.',
        '',
        '- CHIP',
      ].join('\n'),
    );
  },

  startIn: 'control-room',

  claim: {
    claim: 'I am fairly sure the reading word is cat. But I think cat MAKES things.',
    concept: 'cat.read',
    disprovedBy: (event) => event.kind === 'file-read',
    onCorrected: [
      'Oh! It read it. It did not make anything at all.',
      'You are right and I was wrong. Thank you, explorer.',
      'I will remember that properly now.',
    ],
  },

  steps: [
    {
      id: 'check-its-there',
      concepts: ['ls.look'],

      prompt: {
        guided: ['First, look around and check the message is still here.', 'ls'],
        prompted: ['Can you check the message is still in this room?'],
        open: ['Make sure the message is still here.'],
      },

      done: (event) => event.kind === 'listed',
      solution: 'ls',

      hints: {
        ask: 'The looking-around word from last time. Do you remember it?',
        concept: 'Two letters. It lists what is in the room.',
        firstLetter: 'It starts with l.',
        choice: { line: 'Which one?', options: ['ls', 'cat'] },
        reveal: { line: 'ls. It was ls.', command: 'ls' },
      },

      success: ['Still there. Good.'],
    },

    {
      id: 'read-it',
      concepts: ['cat.read'],

      prompt: {
        guided: [
          'Now the reading word. Type this:',
          'cat message-from-chip.txt',
          'Tip: type cat, then a space, then press Tab.',
        ],
        prompted: [
          'There is a word that shows what is written inside something.',
          'Can you use it on the message?',
        ],
        open: ['Find out what it says.'],
      },

      predict: {
        question: 'What do you think the message says?',
        reply: 'Now I really want to know.',
      },

      done: readFile('message-from-chip.txt'),
      solution: 'cat message-from-chip.txt',

      hints: {
        ask: 'It is an animal. Three letters.',
        concept: 'It shows you everything written inside a file.',
        firstLetter: 'It starts with c.',
        choice: { line: 'One of these reads things.', options: ['cat', 'ls'] },
        reveal: {
          line: 'cat, then the name of the thing to read.',
          command: 'cat message-from-chip.txt',
        },
      },

      nearMiss: (event) => {
        // Very common: `cat` with no filename, or the wrong name.
        if (event.kind === 'error' && event.command === 'cat' && event.code === 'MISSING_ARG') {
          return ['It needs to know WHICH thing to read. Put the name after cat.'];
        }
        if (event.kind === 'error' && event.command === 'cat' && event.code === 'ENOENT') {
          return ['The computer cannot find that name.', 'Try ls again and copy the name exactly.'];
        }
        return undefined;
      },

      success: ['A secret base! For us!', 'I wrote that and then forgot. That is very me.'],
    },
  ],

  celebration: {
    title: 'MESSAGE DECODED',
    detail: 'Files have words inside. Now you can read any of them.',
  },

  recap: {
    question: 'So what is a file, do you think?',
    accept: ['words', 'writing', 'message', 'thing', 'inside', 'stuff', 'information'],
    answer: ['A file is a thing with stuff kept inside it.', 'And cat shows you the stuff.'],
  },
};
