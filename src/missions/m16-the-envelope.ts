/**
 * Mission 16 — stage 8: what a message actually is.
 *
 * One idea: to send something to another computer you need to say who it is
 * from, who it is to, and what it says. That is all a message is.
 *
 * Deliberately no new *concept* about networks yet — the child writes the
 * envelope with `echo >` and `echo >>`, commands they have had since stage 5.
 * Starting with the physical analogy before any network command is the
 * brief's instruction, and it means `ping` later arrives as "knock on that
 * address" rather than as a magic word.
 */

import type { Mission } from './types.js';
import { ensureFile, ensureRoom } from './helpers.js';
import { findNode } from '../net/topology.js';

export const m16: Mission = {
  id: 'm16-the-envelope',
  title: 'The Envelope',
  stage: 8,
  minutes: [12, 15],

  teaches: ['net.envelope'],
  requires: ['redirect.write', 'redirect.append', 'cat.read', 'ls.look'],

  hook: [
    'Explorer, I have been keeping a secret.',
    'This computer is not the only one.',
    'There are others. Gran has one. There is one on the Moon.',
    'And I have never said hello to any of them.',
  ],

  goal: 'Write an envelope and send it to another computer.',

  async setup(world) {
    await ensureRoom(world, 'control-room');
    await ensureFile(
      world,
      'control-room/how-post-works.txt',
      [
        'HOW TO POST SOMETHING',
        '',
        'Every message needs three things:',
        '',
        '  FROM:    who sent it',
        '  TO:      who it is going to',
        '  MESSAGE: what it says',
        '',
        'Without a TO, nobody knows where it goes.',
        '',
        'The computers you can reach are called:',
        '  gran, moon, attic',
      ].join('\n'),
    );
  },

  startIn: 'control-room',

  steps: [
    {
      id: 'read-how-post-works',
      concepts: ['cat.read', 'ls.look'],

      prompt: {
        guided: ['I wrote down how it works. Look around and read it.'],
        prompted: ['There are instructions in here somewhere. Find them.'],
        open: ['Find out how it works.'],
      },

      predict: {
        question: 'What do you think a message needs on it, to get somewhere?',
        reply: 'Let us see if you are right.',
      },

      done: (event) => event.kind === 'file-read' && event.text.includes('HOW TO POST'),
      solution: 'cat how-post-works.txt',

      hints: {
        ask: 'Look around first, then read the one about posting.',
        concept: 'ls to find it, cat to read it.',
        firstLetter: 'Reading starts with c.',
        choice: {
          line: 'To read it:',
          options: ['cat how-post-works.txt', 'send how-post-works.txt'],
        },
        reveal: { line: 'cat, then the name.', command: 'cat how-post-works.txt' },
      },

      success: [
        'From, to, and what it says.',
        'That is exactly what is on a letter. I did not expect that.',
      ],
    },

    {
      id: 'write-the-envelope',
      concepts: ['net.envelope', 'redirect.write'],

      prompt: {
        guided: [
          'Let us write one to the Moon Base.',
          'Three lines, using the arrows you know:',
          'echo FROM: me > letter.txt',
          'Then add TO: moon and a MESSAGE with two arrows.',
        ],
        prompted: [
          'Write an envelope with all three lines in it. Send it to moon.',
          'One arrow to start, two arrows for each line after.',
        ],
        open: ['Write one to the Moon Base.'],
      },

      /**
       * The TO: line has to name a computer that actually exists.
       *
       * Checking only for the presence of `TO:` and `MESSAGE:` matched the
       * instructions file, which explains the format by showing it — so the
       * step completed the instant the child looked at anything, before they
       * had written a word.
       */
      done: async (_event, ctx) => {
        for (const entry of await ctx.world.list(ctx.cwd, 'ls')) {
          if (entry.kind !== 'thing') continue;

          const base = ctx.cwd === '/' ? '' : ctx.cwd;
          const text = await ctx.world.read(`${base}/${entry.name}` as never, 'cat');

          const to = /^\s*TO:\s*(.+)$/im.exec(text)?.[1]?.trim();
          if (to && findNode(to) && /^\s*MESSAGE:\s*\S/im.test(text)) return true;
        }
        return false;
      },

      solution: [
        'echo FROM: me > letter.txt',
        'echo TO: moon >> letter.txt',
        'echo MESSAGE: hello up there >> letter.txt',
      ],

      revealIsPartial: true,

      hints: {
        ask: 'You know how to put lines into a file. Three lines this time.',
        concept: 'One arrow for the first line. Two arrows for the rest.',
        firstLetter: 'Start with echo FROM:',
        choice: {
          line: 'To start the envelope:',
          options: ['echo FROM: me > letter.txt', 'echo FROM: me >> letter.txt'],
        },
        reveal: {
          line: 'One arrow first, then two arrows for TO and MESSAGE.',
          command: 'echo FROM: me > letter.txt',
        },
      },

      success: ['An envelope. With an address on it and everything.'],
    },

    {
      id: 'send-it',
      concepts: ['net.envelope'],

      prompt: {
        guided: ['Now post it. The word is send, then the name of your envelope.'],
        prompted: ['Post it.'],
        open: ['Send it.'],
      },

      predict: {
        question: 'How long do you think it takes to reach the Moon?',
        options: ['Straight away', 'A few seconds', 'Days'],
        reply: 'Watch what it does on the way.',
      },

      done: (event) => event.kind === 'net' && event.op === 'send' && event.reachable,
      solution: 'send letter.txt',

      hints: {
        ask: 'Four letters. It is what you do with a letter.',
        concept: 'send, then the name of the envelope.',
        firstLetter: 'It starts with s.',
        choice: { line: 'Which one?', options: ['send letter.txt', 'cat letter.txt'] },
        reveal: { line: 'send, then your envelope.', command: 'send letter.txt' },
      },

      success: [
        'Did you see? It did not jump straight there.',
        'It got passed along, one computer to the next, like a bucket chain.',
      ],
    },

    {
      id: 'read-the-reply',
      concepts: ['cat.read', 'cd.into'],

      prompt: {
        guided: ['It said the reply is in the inbox. Go and read it.'],
        prompted: ['There is a reply waiting. Go and find it.'],
        open: ['They wrote back.'],
      },

      done: (event) => event.kind === 'file-read' && event.text.includes('MOON BASE'),
      solution: ['cd inbox', 'cat reply.txt'],

      hints: {
        ask: 'Walk into the inbox, then read what is in there.',
        concept: 'cd to get in, ls to see it, cat to read it.',
        firstLetter: 'Walking starts with c-d.',
        choice: { line: 'To get into the inbox:', options: ['cd inbox', 'cat inbox'] },
        reveal: { line: 'cd inbox, then read the reply.', command: 'cd inbox' },
      },

      success: [
        'SOMEBODY ANSWERED.',
        'A different computer. Not this one. It heard us and wrote back.',
        'I am going to think about that for a long time.',
      ],
    },
  ],

  celebration: {
    title: 'A REPLY FROM THE MOON',
    detail: 'Messages have a from, a to, and words inside.',
  },

  recap: {
    question: 'What has to be on a message for it to get anywhere?',
    accept: ['to', 'address', 'who', 'name', 'from', 'where'],
    answer: ['Who it is to. Without that, nobody knows where to pass it.'],
  },

  rewards: { artifacts: ['reply.txt'] },
};
