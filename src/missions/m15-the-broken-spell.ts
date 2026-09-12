/**
 * Mission 15 — stage 7: the first real debugging.
 *
 * One idea: when a program stops, it tells you where, and you can go and
 * look at that exact line.
 *
 * This is the mission the whole "errors are clues, not failures" thread has
 * been building towards. Everything the child needs is already true: the
 * error text is real, the line number is real, and the fix is a command they
 * have known since stage 3. What is new is the *move* — read the error, find
 * the line it names, work out what is wrong with that line, change it.
 *
 * That move is most of what debugging is, for the rest of their life.
 */

import type { Mission } from './types.js';
import { ensureFile, ensureRoom } from './helpers.js';
import { readSpell } from '../shell/spells.js';

export const m15: Mission = {
  id: 'm15-the-broken-spell',
  title: 'The Broken Spell',
  stage: 7,
  minutes: [12, 15],

  teaches: ['program.debug'],
  requires: ['program.run', 'cat.read', 'redirect.write', 'move.rename'],

  hook: [
    'Explorer, I have done something.',
    'I wrote a spell all by myself while you were gone.',
    'It does not work and I do not know why.',
    'I feel terrible.',
  ],

  goal: 'Find the line that is wrong, and fix it.',

  async setup(world) {
    await ensureRoom(world, 'control-room');
    await ensureRoom(world, 'control-room/workshop');

    // Line 2 walks into a room that does not exist. Everything else is fine,
    // so the failure is specific, findable, and fixable by changing one word.
    await ensureFile(
      world,
      'control-room/chips-plan.spell',
      ['echo Starting CHIPs plan', 'cd wrokshop', 'echo Made it!'].join('\n'),
    );
  },

  startIn: 'control-room',

  steps: [
    {
      id: 'watch-it-break',
      concepts: ['program.run'],

      prompt: {
        guided: ['Run it and let us see what happens.', 'run chips-plan.spell'],
        prompted: ['Run it. We need to see it go wrong before we can fix it.'],
        open: ['Run it.'],
      },

      predict: {
        question: 'Do you think the computer will tell us WHERE it went wrong?',
        options: ['Yes', 'No', 'Not sure'],
        reply: 'Let us look very carefully at what it says.',
      },

      done: (event) => event.kind === 'program-run' && event.failedLine !== undefined,
      solution: 'run chips-plan.spell',

      // The failing line is the point of this step, and the success text
      // below talks about it properly. Without this, CHIP asks "what is the
      // computer telling us?" and then answers himself in the next breath.
      nearMiss: (event) => (event.kind === 'error' ? [] : undefined),

      hints: {
        ask: 'The word that makes the computer follow a list.',
        concept: 'Three letters, then the spell name.',
        firstLetter: 'It starts with r.',
        choice: { line: 'Which one?', options: ['run chips-plan.spell', 'cat chips-plan.spell'] },
        reveal: { line: 'run, then the name.', command: 'run chips-plan.spell' },
      },

      success: [
        'It stopped. And look — it said which line it stopped at.',
        'Line 2. Not "something went wrong". Line 2.',
        'That is the computer being helpful, not cross.',
      ],
    },

    {
      id: 'read-the-broken-line',
      concepts: ['cat.read', 'program.debug'],

      prompt: {
        guided: [
          'Read the spell and count down to line 2.',
          'Then look at it very closely and compare it to what is really here.',
        ],
        prompted: ['Read the spell. What is line 2 trying to do?'],
        open: ['Go and look at line 2.'],
      },

      done: (event) => event.kind === 'file-read' && event.text.includes('wrokshop'),
      solution: 'cat chips-plan.spell',

      hints: {
        ask: 'How do you see what is written inside a file?',
        concept: 'cat, then the name. Then count the lines.',
        firstLetter: 'It starts with c.',
        choice: { line: 'Which one?', options: ['cat chips-plan.spell', 'run chips-plan.spell'] },
        reveal: { line: 'cat shows you every line.', command: 'cat chips-plan.spell' },
      },

      nearMiss: (event) => {
        if (event.kind === 'listed' && event.entries.includes('workshop')) {
          return ['There IS a workshop. So why could line 2 not find it?'];
        }
        return undefined;
      },

      success: [
        'w-r-o-k-s-h-o-p.',
        'I spelled it wrong. Two letters swapped over.',
        'The computer looked for a room called wrokshop and there is not one.',
        'It was not being difficult. It was being exactly right.',
      ],
    },

    {
      id: 'fix-it',
      concepts: ['program.debug', 'redirect.write', 'program.write'],

      prompt: {
        guided: [
          'Let us write the spell again, with the word spelled properly.',
          'Start it over with one arrow, then add the other lines back.',
          'echo echo Starting again > chips-plan.spell',
        ],
        prompted: [
          'Write the spell again with workshop spelled correctly.',
          'One arrow to start it, two arrows to add the rest.',
        ],
        open: ['Fix it.'],
      },

      /**
       * Completes when a whole spell exists that walks into the real
       * workshop — however the child got there.
       *
       * The line count matters. An earlier version completed the moment
       * `cd workshop` appeared, which is halfway through rewriting, so CHIP
       * said "now try it" while the child was still typing the rest.
       */
      done: async (_event, ctx) => {
        for (const entry of await ctx.world.list(ctx.cwd, 'ls')) {
          if (entry.kind !== 'thing' || !entry.name.endsWith('.spell')) continue;

          const base = ctx.cwd === '/' ? '' : ctx.cwd;
          const text = await ctx.world.read(`${base}/${entry.name}` as never, 'cat');

          if (readSpell(text).length >= 3 && text.includes('cd workshop')) return true;
        }
        return false;
      },

      solution: [
        'echo echo Starting again > chips-plan.spell',
        'echo cd workshop >> chips-plan.spell',
        'echo echo Made it! >> chips-plan.spell',
      ],

      revealIsPartial: true,

      hints: {
        ask: 'How do you put a fresh line into a file, replacing what was there?',
        concept: 'One arrow starts it over. Two arrows add each next line.',
        firstLetter: 'Start with echo and one arrow.',
        choice: {
          line: 'To start the file over:',
          options: ['echo ... > chips-plan.spell', 'echo ... >> chips-plan.spell'],
        },
        reveal: {
          line: 'One arrow first, then two arrows for each line after.',
          command: 'echo echo Starting again > chips-plan.spell',
        },
      },

      success: ['Spelled properly this time. Now try it.'],
    },

    {
      id: 'run-the-fix',
      concepts: ['program.run'],

      prompt: {
        guided: ['Run it again and see if it gets all the way to the end.'],
        prompted: ['Run it. Did you get it?'],
        open: ['Try it.'],
      },

      done: (event) => event.kind === 'program-run' && event.failedLine === undefined,
      solution: 'run chips-plan.spell',

      hints: {
        ask: 'Same as before.',
        concept: 'run, then the spell name.',
        firstLetter: 'It starts with r.',
        choice: { line: 'Which one?', options: ['run chips-plan.spell', 'ls'] },
        reveal: { line: 'run it again.', command: 'run chips-plan.spell' },
      },

      success: [
        'ALL THE WAY TO THE END.',
        'You read the error, went to the line it named, and fixed it.',
        'That is what people do all day. That is the actual job.',
      ],
    },

    {
      // `mv` was taught in m12 for moving a thing into a room. Here it is the
      // same command doing its other job — renaming — which is worth meeting
      // once the first meaning is solid.
      id: 'rename-it',
      concepts: ['move.rename'],

      prompt: {
        guided: [
          'Notice where we are standing? The spell walked us into the workshop.',
          'Go back out first.',
          'Then rename the spell, because it is not broken any more:',
          'mv chips-plan.spell works.spell',
        ],
        prompted: [
          'The spell moved us into the workshop. Head back out.',
          'Then give it a better name — mv renames as well as moves.',
        ],
        open: ['It deserves a better name now.'],
      },

      done: (event) => event.kind === 'moved' && !event.copy,
      solution: ['cd ..', 'mv chips-plan.spell works.spell'],

      hints: {
        ask: 'The moving word can also rename. Two letters.',
        concept: 'mv, the old name, then the new name.',
        firstLetter: 'It starts with m, but it is not mkdir.',
        choice: {
          line: 'Which one renames it?',
          options: ['mv chips-plan.spell works.spell', 'cp chips-plan.spell works.spell'],
        },
        reveal: {
          line: 'Moving something to a new name IS renaming it.',
          command: 'mv chips-plan.spell works.spell',
        },
      },

      success: [
        'Renaming is just moving it to a new name. Same word.',
        'works.spell. I like that a lot better.',
      ],
    },
  ],

  celebration: {
    title: 'YOU FIXED IT',
    detail: 'The error told you where. You went and looked.',
  },

  recap: {
    question: 'When the spell broke, what did the computer tell us?',
    accept: ['line', 'line 2', '2', 'where', 'which'],
    answer: ['Which line. That is why we could go and find it.'],
  },

  rewards: { badges: ['bug-detective'] },
};
