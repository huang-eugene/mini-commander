/**
 * Mission 1 — stage 1: the computer listens.
 *
 * One idea only: you can give a computer an instruction and it will do it.
 * No files, no rooms, no navigation. Just `echo`, and the astonishing fact
 * that a machine did what you said.
 *
 * This mission should take about five minutes and end while the child still
 * wants more.
 */

import type { Mission } from './types.js';
import { saidAnything } from './helpers.js';
import { ensureRoom } from './helpers.js';

export const m01: Mission = {
  id: 'm01-hello-explorer',
  title: 'Hello, Explorer',
  stage: 1,
  minutes: [5, 8],

  teaches: ['echo.say'],
  requires: [],

  hook: [
    'Oh! Someone is there.',
    'I am CHIP. I live in this computer.',
    'I have been shouting for ages and nobody heard me.',
    'Can you hear me?',
  ],

  goal: 'Get the computer to say something back.',

  async setup(world) {
    await ensureRoom(world, 'control-room');
  },

  startIn: 'control-room',

  steps: [
    {
      id: 'say-hello',
      concepts: ['echo.say'],

      prompt: {
        guided: [
          'This is the control room. When you type in here, the computer listens.',
          'Type this and press Enter:',
          'echo hello',
        ],
        prompted: [
          'There is a word that makes the computer say something back.',
          'Can you make it say hello?',
        ],
        open: ['Make the computer say something to me.'],
      },

      predict: {
        question: 'What do you think will happen when you press Enter?',
        options: ['It says hello back', 'Nothing happens', 'Something else'],
        reply: 'Right. Let us find out.',
      },

      done: saidAnything(),
      solution: 'echo hello',

      hints: {
        ask: 'You tell it to say something. What word would you use?',
        concept: 'It is a word that means "repeat this back to me".',
        firstLetter: 'It starts with the letter e.',
        choice: { line: 'One of these makes it talk.', options: ['echo', 'ls'] },
        reveal: {
          line: 'It is echo. Then whatever you want it to say.',
          command: 'echo hello',
        },
      },

      success: [
        'You did it. The computer said it because YOU told it to.',
        'It will say anything. Try your own name.',
      ],
    },

    {
      id: 'say-your-name',
      concepts: ['echo.say'],

      prompt: {
        guided: ['Now put your own name after echo instead of hello.'],
        prompted: ['Make it say your name this time.'],
        open: ['Make it say something only you would say.'],
      },

      done: saidAnything(),
      solution: 'echo Explorer',

      hints: {
        ask: 'Same word as before. What comes after it?',
        concept: 'echo, then a space, then anything at all.',
        firstLetter: 'Start with e again.',
        choice: { line: 'Which one?', options: ['echo yourname', 'yourname echo'] },
        reveal: { line: 'The word comes first, then what to say.', command: 'echo Explorer' },
      },

      success: [
        'There you are. In the computer.',
        'That is the deal, explorer: you tell it things, it does them.',
      ],
    },
  ],

  celebration: {
    title: 'THE COMPUTER LISTENED',
    detail: 'You gave it an instruction and it obeyed.',
  },

  recap: {
    question: 'What did we just teach the computer to do?',
    accept: ['say', 'talk', 'speak', 'echo', 'listen', 'repeat'],
    answer: ['We made it say things. It only did it because you asked.'],
  },
};
