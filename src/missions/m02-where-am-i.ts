/**
 * Mission 2 — stage 2: looking around.
 *
 * Two ideas: you are somewhere inside the computer, and places have things
 * in them. `pwd` and `ls`.
 *
 * This mission deliberately ends on a cliffhanger. The child finds a file
 * from CHIP and cannot read it yet, because reading is mission 3. The brief's
 * example first mission bundles pwd + ls + cat, which is three new ideas in
 * one sitting and breaks its own "one or two major ideas" rule — so it is
 * split here, and the unreadable message is a much better reason to come back
 * tomorrow than a completed checklist.
 */

import type { Mission } from './types.js';
import { ensureFile, ensureRoom, lookedAround, ranCommand } from './helpers.js';

export const m02: Mission = {
  id: 'm02-where-am-i',
  title: 'Where Am I?',
  stage: 2,
  minutes: [8, 12],

  teaches: ['pwd.where', 'ls.look'],
  requires: ['echo.say'],

  hook: [
    'Explorer, I have a problem.',
    'I woke up in here and I do not know where "here" is.',
    'Computers have rooms inside them. I am standing in one.',
    'I just do not know which one.',
  ],

  goal: 'Find out which room we are in, then see what is in it.',

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

  steps: [
    {
      id: 'ask-where',
      concepts: ['pwd.where'],

      prompt: {
        guided: [
          'There is a word that asks the computer where we are.',
          'Type this and press Enter:',
          'pwd',
        ],
        prompted: ['Can you ask the computer which room we are standing in?'],
        open: ['Find out where we are.'],
      },

      predict: {
        question: 'Do you think the computer knows where we are?',
        options: ['Yes', 'No', 'Not sure'],
        reply: 'Let us ask it and see.',
      },

      done: ranCommand('pwd'),
      solution: 'pwd',

      hints: {
        ask: 'It is a short word. Three letters. Do you remember it?',
        concept: 'It stands for "print working directory" — which room am I in.',
        firstLetter: 'It starts with p.',
        choice: { line: 'Which one asks where we are?', options: ['pwd', 'echo'] },
        reveal: { line: 'It is pwd. Just those three letters.', command: 'pwd' },
      },

      success: [
        'The control room! Of course.',
        'That line is our address inside the computer.',
        'A room like this is also called a folder. Or a directory.',
      ],
    },

    {
      id: 'look-around',
      concepts: ['ls.look'],

      prompt: {
        guided: [
          'Now. There might be something in this room with us.',
          'Type this to look around:',
          'ls',
        ],
        prompted: ['We know where we are. Can we see what is in here with us?'],
        open: ['Have a look around this room.'],
      },

      predict: {
        question: 'What do you think is in here?',
        reply: 'Good guess. Let us look.',
      },

      done: lookedAround(),
      solution: 'ls',

      hints: {
        ask: 'There is a word for looking around a room. Two letters.',
        concept: 'It is short for "list" — show me what is here.',
        firstLetter: 'It starts with l.',
        choice: { line: 'One of these looks around.', options: ['ls', 'pwd'] },
        reveal: { line: 'It is ls. Two letters, that is all.', command: 'ls' },
      },

      success: [
        'message-from-chip.txt!',
        'I do not remember writing that.',
        'It has my name on it though.',
      ],
    },
  ],

  celebration: {
    title: 'YOU FOUND SOMETHING',
    detail: 'A message. With CHIP’s name on it.',
  },

  recap: {
    question: 'We found a message. What do you think we should do tomorrow?',
    accept: ['read', 'open', 'look', 'see', 'find out'],
    answer: [
      'I want to read it too. But I do not know how yet.',
      'Come back tomorrow and we will work it out.',
    ],
  },

  rewards: { artifacts: ['message-from-chip.txt'] },
};
