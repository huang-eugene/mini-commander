/**
 * Mission 8 — stage 5: files can store what you say.
 *
 * One idea: the arrow sends `echo`'s words into a thing instead of the screen.
 *
 * This is the mission where two things the child already knows separately
 * click together: `echo` (from mission 1) and files (from mission 3). The
 * arrow is the only new part, and framing it as "point the words somewhere
 * else" is what makes redirection make sense rather than being a symbol to
 * memorise.
 */

import type { Mission } from './types.js';
import { ensureRoom, readFile, wroteInto } from './helpers.js';

export const m08: Mission = {
  id: 'm08-secret-note',
  title: 'The Secret Note',
  stage: 5,
  minutes: [10, 15],

  teaches: ['redirect.write'],
  requires: ['echo.say', 'cat.read', 'touch.make'],

  hook: [
    'I have been thinking.',
    'When you use echo, the words appear and then they are gone.',
    'What if we could keep them?',
  ],

  goal: 'Write a secret message into a file, then read it back.',

  async setup(world) {
    await ensureRoom(world, 'control-room');
  },

  startIn: 'control-room',

  steps: [
    {
      id: 'remember-echo',
      concepts: ['echo.say'],

      prompt: {
        guided: ['First, make the computer say something. Anything at all.'],
        prompted: ['Say something to me first.'],
        open: ['Say something.'],
      },

      done: (event) => event.kind === 'said',
      solution: 'echo hello CHIP',

      hints: {
        ask: 'The very first word you learned. Do you still have it?',
        concept: 'It makes the computer repeat what you type after it.',
        firstLetter: 'It starts with e.',
        choice: { line: 'Which one?', options: ['echo', 'cat'] },
        reveal: { line: 'echo, then anything.', command: 'echo hello CHIP' },
      },

      success: ['There it is. And now... it is gone. Vanished.'],
    },

    {
      id: 'write-it-down',
      concepts: ['redirect.write'],

      prompt: {
        guided: [
          'Now the new bit. Put an arrow at the end, then a name.',
          'The arrow means "do not say it — put it in there instead".',
          'Type this:',
          'echo my secret > secret.txt',
        ],
        prompted: [
          'There is a way to send the words into a thing instead of the screen.',
          'It is a little arrow. Try it.',
        ],
        open: ['Keep your words somewhere instead of saying them.'],
      },

      predict: {
        question: 'If the words go into the file, what will the screen show?',
        options: ['The words, same as before', 'Nothing at all', 'Something else'],
        reply: 'Interesting. Let us see.',
      },

      done: wroteInto(),
      solution: 'echo my secret > secret.txt',

      hints: {
        ask: 'Same as before, but add something at the end.',
        concept: 'An arrow pointing at the name of a thing to put the words in.',
        firstLetter: 'The arrow is the greater-than sign. Above the full stop.',
        choice: {
          line: 'Which one writes it down?',
          options: ['echo hi > note.txt', 'echo hi note.txt'],
        },
        reveal: {
          line: 'echo, your words, then > and a name.',
          command: 'echo my secret > secret.txt',
        },
      },

      nearMiss: (event) => {
        if (event.kind === 'said') {
          return ['That said it out loud again. We want it to go INTO something.'];
        }
        if (event.kind === 'unsupported-syntax') {
          return ['Careful — it is one arrow, pointing right.'];
        }
        return undefined;
      },

      success: [
        'The screen said nothing! Where did the words go?',
        'They went inside. Let us check.',
      ],
    },

    {
      id: 'read-it-back',
      concepts: ['cat.read', 'ls.look'],

      prompt: {
        guided: ['Look around, and then read what is inside your file.'],
        prompted: ['Is it really in there? Go and see.'],
        open: ['Check it worked.'],
      },

      done: readFile('secret.txt'),
      solution: 'cat secret.txt',

      hints: {
        ask: 'The reading word. It is an animal.',
        concept: 'cat shows you what is written inside something.',
        firstLetter: 'It starts with c.',
        choice: { line: 'Which one?', options: ['cat secret.txt', 'ls secret.txt'] },
        reveal: { line: 'cat, then the name.', command: 'cat secret.txt' },
      },

      success: [
        'YOUR WORDS. You said them and the computer kept them.',
        'They will still be there when you are asleep.',
        'That is what a file really is. Somewhere words wait.',
      ],
    },
  ],

  celebration: {
    title: 'FILE FINDER',
    detail: 'You made the computer remember something for you.',
  },

  recap: {
    question: 'What does the little arrow do?',
    accept: ['puts', 'in', 'into', 'saves', 'keeps', 'writes', 'file', 'stores'],
    answer: ['It puts the words into a thing instead of on the screen.'],
  },

  rewards: { badges: ['file-finder'], artifacts: ['secret.txt'] },
};
