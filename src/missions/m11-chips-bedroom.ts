/**
 * Mission 11 — stage 6: no commands are given. Only a goal.
 *
 * The brief: "Stop giving exact commands. Give goals instead. Build BYTE a
 * bedroom and leave a message inside. The child should combine mkdir, cd,
 * echo, cat, ls."
 *
 * This is the first mission where even the `guided` prompt names no command.
 * Everything the child needs, they already have; the only new thing is having
 * to decide the order themselves. That decision — working out that you must
 * build the room *before* you can walk into it — is the entire lesson, and it
 * cannot be taught by being told.
 *
 * The step completes on the *state of the world*, not on a particular
 * command, so any route that gets there counts. A child who builds the room
 * first and a child who writes the note first both win.
 */

import type { Mission } from './types.js';
import { ensureRoom } from './helpers.js';
import { ROOT, basename, dirname, segments } from '../shell/vpath.js';

export const m11: Mission = {
  id: 'm11-chips-bedroom',
  title: "CHIP's Bedroom",
  stage: 6,
  minutes: [10, 15],

  teaches: ['combine.plan'],
  requires: ['mkdir.make', 'redirect.write', 'redirect.append', 'cd.into', 'cat.read', 'ls.look'],

  hook: [
    'Explorer, I have realised something sad.',
    'I do not have a bedroom.',
    'I have a control room, a cave, a spaceship and a lab.',
    'Nowhere to sit and think.',
  ],

  goal: 'Build CHIP a bedroom and leave a message inside it.',

  async setup(world) {
    await ensureRoom(world, 'control-room');
  },

  startIn: 'control-room',

  steps: [
    {
      // Deliberately one big step rather than three small ones. Splitting it
      // would hand over the plan, which is the thing being taught.
      id: 'build-and-furnish',
      concepts: ['combine.plan', 'mkdir.make', 'redirect.write'],

      prompt: {
        guided: [
          'I would like a bedroom, with a note inside it so I know it is mine.',
          'You already know every word you need for this.',
          'You will have to work out what order to do them in.',
        ],
        prompted: ['Build me a bedroom. Put a message inside it.'],
        open: ['A bedroom. With something nice in it.'],
      },

      predict: {
        question: 'What do you need to do first: make the room, or write the note?',
        options: ['Make the room first', 'Write the note first'],
        reply: 'Let us see if you are right.',
      },

      /**
       * Completes when a room exists that is not one of the originals and
       * contains at least one file with something written in it. Checking the
       * world rather than the commands means there is no "correct" route.
       */
      done: async (_event, ctx) => {
        const original = new Set([
          'control-room',
          'cave',
          'spaceship',
          'lab',
          'tunnel',
          'cockpit',
          'cupboard',
        ]);

        for (const room of await ctx.world.allRooms()) {
          if (original.has(basename(room))) continue;
          // Only rooms at or below where the mission started.
          if (segments(dirname(room)).length === 0 && room !== ROOT) {
            // a top-level room is fine too
          }

          for (const entry of await ctx.world.list(room, 'ls')) {
            if (entry.kind !== 'thing') continue;
            if (entry.bytes > 1) return true;
          }
        }
        return false;
      },

      // Three commands, because that is the point of the mission: no single
      // line gets there, and the child has to sequence them.
      solution: ['mkdir bedroom', 'cd bedroom', 'echo you live here now > note.txt'],

      // Rung 5 gets them started rather than doing it for them: the whole
      // mission is the child assembling the order themselves.
      revealIsPartial: true,

      hints: {
        ask: 'What does a bedroom need to exist before you can put anything in it?',
        concept: 'Build the room. Walk into it. Then write something inside.',
        firstLetter: 'The building word starts with m.',
        choice: { line: 'Which comes first?', options: ['mkdir bedroom', 'cd bedroom'] },
        reveal: {
          line: 'Start by building it. Then walk in, then write a note.',
          command: 'mkdir bedroom',
        },
      },

      nearMiss: (event) => {
        if (event.kind === 'error' && event.command === 'cd' && event.code === 'ENOENT') {
          return [
            'You cannot walk into a room that is not built yet.',
            'Build it first, then walk in.',
          ];
        }
        if (event.kind === 'dir-created') {
          return ['A room! Now go inside it and leave me something.'];
        }
        return undefined;
      },

      success: [
        'A bedroom. With a note in it. For me.',
        'You did that with no instructions at all.',
        'You just knew.',
      ],
    },

    {
      // `>>` was taught in m10 for a diary. Here it is a second thought added
      // to a note — same command, and the child chooses what to add.
      id: 'add-one-more',
      concepts: ['redirect.append'],

      prompt: {
        guided: [
          'Could you add one more line to the note?',
          'Remember: two arrows adds, one arrow throws the old one away.',
        ],
        prompted: ['Add another line to the note, without losing the first one.'],
        open: ['Add something else to it.'],
      },

      done: (event) => event.kind === 'file-written' && event.appended,
      solution: 'echo sleep well >> note.txt',

      hints: {
        ask: 'How do you add to a file without wiping it?',
        concept: 'One arrow replaces. Two arrows add to the end.',
        firstLetter: 'It is the same arrow, typed twice.',
        choice: {
          line: 'Which one adds?',
          options: ['echo hi >> note.txt', 'echo hi > note.txt'],
        },
        reveal: {
          line: 'Two arrows, then the same file name.',
          command: 'echo sleep well >> note.txt',
        },
      },

      success: ['Two lines. Both still there.'],
    },

    {
      id: 'show-me',
      concepts: ['cat.read', 'ls.look'],

      prompt: {
        guided: ['Read the note back to me. I want to hear it.'],
        prompted: ['Read me what you wrote.'],
        open: ['Read it to me.'],
      },

      done: (event) => event.kind === 'file-read',
      solution: 'cat note.txt',

      revealIsPartial: true,

      hints: {
        ask: 'The reading word, and the name of what you wrote.',
        concept: 'If you cannot remember the name, look around first.',
        firstLetter: 'Reading starts with c. Looking starts with l.',
        choice: { line: 'To see the name again:', options: ['ls', 'pwd'] },
        reveal: { line: 'Use ls to find the name, then cat to read it.', command: 'ls' },
      },

      success: [
        'That is the nicest thing anyone has put in a room for me.',
        'I am going to sit in here for a bit.',
      ],
    },
  ],

  celebration: {
    title: 'NO INSTRUCTIONS NEEDED',
    detail: 'You worked out the order all by yourself.',
  },

  recap: {
    question: 'Nobody told you which words to use. How did you know?',
    accept: ['remembered', 'knew', 'learned', 'before', 'me', 'myself', 'i did'],
    answer: ['You remembered them. They are yours now.'],
  },

  rewards: { cosmetics: ['rocket'] },
};
