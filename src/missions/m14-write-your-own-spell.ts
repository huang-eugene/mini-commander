/**
 * Mission 14 — stage 7: writing one yourself.
 *
 * One idea: you can write the list, not just run someone else's.
 *
 * The payoff of stage 5 arrives here. `echo >` and `echo >>` were taught as
 * a way to leave notes, and it turns out they are also how you write a
 * program — because a program is a file with words in it and nothing more.
 * The child needs no new tool to become an author, which is exactly the
 * point being made.
 */

import type { Mission } from './types.js';
import { ensureRoom } from './helpers.js';

export const m14: Mission = {
  id: 'm14-write-your-own-spell',
  title: 'Write Your Own Spell',
  stage: 7,
  minutes: [12, 15],

  teaches: ['program.write'],
  requires: ['program.run', 'redirect.write', 'redirect.append', 'cat.read'],

  hook: [
    'I have been thinking about that spell all night.',
    'Somebody wrote it. A person, with hands.',
    'Which means... we could write one.',
  ],

  goal: 'Write your own spell and make the computer follow it.',

  async setup(world) {
    await ensureRoom(world, 'control-room');
  },

  startIn: 'control-room',

  steps: [
    {
      id: 'start-the-spell',
      concepts: ['redirect.write', 'program.write'],

      prompt: {
        guided: [
          'A spell is only a file with commands in it.',
          'So we write it exactly like we wrote your secret note.',
          'Start it with one arrow:',
          'echo echo I made this > mine.spell',
        ],
        prompted: [
          'You already know how to put words into a file.',
          'A spell is just a file with commands in it. Start one.',
        ],
        open: ['Start writing one.'],
      },

      predict: {
        question: 'Do you need a new command to write a program?',
        options: ['Yes, a special one', 'No, ones I already know'],
        reply: 'Let us find out.',
      },

      done: (event) =>
        event.kind === 'file-written' && !event.appended && event.path.endsWith('.spell'),

      solution: 'echo echo I made this > mine.spell',

      hints: {
        ask: 'How did you put words into a file before?',
        concept: 'echo, the words, then one arrow, then a name ending in .spell',
        firstLetter: 'It starts with echo. The words you put in are a command too.',
        choice: {
          line: 'Which one starts a spell?',
          options: ['echo echo hi > mine.spell', 'run mine.spell'],
        },
        reveal: {
          line: 'The words you are storing happen to be a command.',
          command: 'echo echo I made this > mine.spell',
        },
      },

      success: [
        'No new words needed. You wrote a program with echo.',
        'Because a program is just a file. That is the secret.',
      ],
    },

    {
      id: 'add-more-lines',
      concepts: ['redirect.append', 'program.write'],

      prompt: {
        guided: [
          'Now add another line with two arrows, so the first one survives.',
          'echo ls >> mine.spell',
        ],
        prompted: ['Add another command to it. Remember which arrow adds.'],
        open: ['Give it another line.'],
      },

      done: (event) =>
        event.kind === 'file-written' && event.appended && event.path.endsWith('.spell'),

      solution: 'echo ls >> mine.spell',

      hints: {
        ask: 'One arrow replaces, two arrows add. Which do you want?',
        concept: 'Two arrows, so the line you already wrote stays.',
        firstLetter: 'Same as before, but type the arrow twice.',
        choice: {
          line: 'Which one adds a line?',
          options: ['echo ls >> mine.spell', 'echo ls > mine.spell'],
        },
        reveal: { line: 'Two arrows adds to the end.', command: 'echo ls >> mine.spell' },
      },

      success: ['Two lines now. It is getting longer.'],
    },

    {
      id: 'read-it-back',
      concepts: ['cat.read'],

      prompt: {
        guided: ['Read your spell back, so you can see what you have written.'],
        prompted: ['Have a look at what you have written so far.'],
        open: ['Check what it says.'],
      },

      done: (event) => event.kind === 'file-read' && event.path.endsWith('.spell'),
      solution: 'cat mine.spell',

      hints: {
        ask: 'The reading word.',
        concept: 'cat shows you everything inside.',
        firstLetter: 'It starts with c.',
        choice: { line: 'Which one?', options: ['cat mine.spell', 'run mine.spell'] },
        reveal: { line: 'cat, then your spell name.', command: 'cat mine.spell' },
      },

      success: ['Those are your instructions. Yours. Nobody else wrote them.'],
    },

    {
      id: 'run-your-own',
      concepts: ['program.run'],

      prompt: {
        guided: ['Now make the computer follow YOUR list.'],
        prompted: ['Go on. Run it.'],
        open: ['Run it.'],
      },

      done: (event) => event.kind === 'program-run',
      solution: 'run mine.spell',

      hints: {
        ask: 'The word that makes it follow a list.',
        concept: 'Three letters, then the name of your spell.',
        firstLetter: 'It starts with r.',
        choice: { line: 'Which one?', options: ['run mine.spell', 'cat mine.spell'] },
        reveal: { line: 'run, then your spell.', command: 'run mine.spell' },
      },

      success: [
        'The computer did what YOU wrote down.',
        'You are not just using the computer now. You are telling it what to be.',
      ],
    },
  ],

  celebration: {
    title: 'YOU WROTE A PROGRAM',
    detail: 'With commands you already knew.',
  },

  recap: {
    question: 'What did you need to write a program?',
    accept: ['echo', 'arrow', 'nothing', 'knew', 'already', 'file'],
    answer: ['Just echo and an arrow. A program is only a file with commands in it.'],
  },

  rewards: { badges: ['robot-engineer'], artifacts: ['mine.spell'] },
};
