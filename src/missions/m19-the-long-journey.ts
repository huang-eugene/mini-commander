/**
 * Mission 19 — stage 8: the Internet is machines passing messages along.
 *
 * One idea, and it is the last and biggest one in the whole curriculum: a
 * message does not leap from one computer to another. It is handed on, hop
 * by hop, by other computers in between, and you can watch it happen.
 *
 * This is the mission the brief is ultimately aiming at — "the Internet is
 * infrastructure, not magic". The child sees the route to the Moon, sees
 * that it goes through two sorting stations, and then uses the same command
 * to work out exactly where the broken attic link gives up. The diagnostic
 * and the big idea are the same act.
 */

import type { Mission } from './types.js';
import { ensureRoom } from './helpers.js';

export const m19: Mission = {
  id: 'm19-the-long-journey',
  title: 'The Long Journey',
  stage: 8,
  minutes: [12, 15],

  teaches: ['net.route'],
  requires: ['net.name', 'net.reach', 'net.envelope', 'debug.find', 'echo.say'],

  hook: [
    'One more thing and then I will stop asking questions. Probably.',
    'When your letter went to the Moon, it did not go straight there.',
    'It got passed along.',
    'I want to see exactly who passed it.',
  ],

  goal: 'Follow a message all the way to the Moon, and find the break.',

  async setup(world) {
    await ensureRoom(world, 'control-room');
  },

  startIn: 'control-room',

  steps: [
    {
      id: 'follow-to-the-moon',
      // net.name comes back here without a drill: traceroute prints every
      // hop as a name AND its number, side by side, which is the previous
      // mission's lesson made visible four times in one command.
      concepts: ['net.route', 'net.name'],

      prompt: {
        guided: ['The word is traceroute. It is a long one, so take your time.', 'traceroute moon'],
        prompted: ['There is a word that shows every computer a message passes through.'],
        open: ['Follow a message to the Moon.'],
      },

      predict: {
        question: 'How many computers do you think the message touches on the way?',
        options: ['Just one', 'Two or three', 'Hundreds'],
        reply: 'Let us count them.',
      },

      done: (event) => event.kind === 'net' && event.op === 'traceroute' && event.reachable,
      solution: 'traceroute moon',

      hints: {
        ask: 'It has two words stuck together: trace, and route.',
        concept: 'It traces the route. It shows every hop on the way.',
        firstLetter: 'It starts with t-r-a-c-e.',
        choice: { line: 'Which one?', options: ['traceroute moon', 'ping moon'] },
        reveal: { line: 'traceroute, then the name.', command: 'traceroute moon' },
      },

      success: [
        'FOUR. It touches four computers to get to the Moon.',
        'Two of them are sorting stations that do nothing but pass things on.',
        'They are not ours. They just help.',
        'That is what the Internet is. Computers passing things along for each other.',
      ],
    },

    {
      id: 'find-the-break',
      // debug.find comes back here, two missions after the broken spell. It
      // is the identical move: read what the tool told you, work out where it
      // stopped, go and look there.
      concepts: ['net.route', 'net.reach', 'debug.find'],

      prompt: {
        guided: [
          'Now use the same word on the attic, the one that never answers.',
          'Watch where the list stops.',
        ],
        prompted: ['Use it on the attic. See how far the message gets.'],
        open: ['Now work out exactly where the attic problem is.'],
      },

      predict: {
        question: 'Where do you think the message will stop?',
        options: ['Straight away', 'At the sorting station', 'It will get there'],
        reply: 'Follow it and see.',
      },

      done: (event) => event.kind === 'net' && event.op === 'traceroute' && !event.reachable,
      solution: 'traceroute attic',

      nearMiss: (event) => (event.kind === 'error' ? [] : undefined),

      hints: {
        ask: 'Same long word, the attic this time.',
        concept: 'It will show you how far the message gets before it gives up.',
        firstLetter: 'It starts with t.',
        choice: { line: 'Which one?', options: ['traceroute attic', 'nslookup attic'] },
        reveal: { line: 'traceroute attic.', command: 'traceroute attic' },
      },

      success: [
        'It reaches the sorting station and stops dead.',
        'So the attic computer might be perfectly fine.',
        'The broken bit is between the sorting station and the attic.',
        'You found that out without going upstairs.',
      ],
    },

    {
      id: 'tell-chip-what-it-is',
      concepts: ['echo.say', 'net.route'],

      prompt: {
        guided: [
          'One last thing. I still do not really understand what the Internet IS.',
          'Use echo to tell me, in your own words.',
        ],
        prompted: ['Tell me what the Internet is. Use echo.'],
        open: ['So what is it, then?'],
      },

      done: (event) => event.kind === 'said' && event.text.trim().length > 0,
      solution: 'echo computers passing messages to each other',

      hints: {
        ask: 'The very first word you ever taught me. Use it to explain.',
        concept: 'echo, then whatever you think the answer is.',
        firstLetter: 'It starts with e.',
        choice: { line: 'Which one?', options: ['echo', 'send'] },
        reveal: {
          line: 'echo, then your answer. Any words you like.',
          command: 'echo computers passing messages to each other',
        },
      },

      success: [
        'That is better than anything I would have said.',
        'Not magic. Not a cloud. Just machines, handing things on.',
        'Thank you, explorer. I mean it.',
      ],
    },
  ],

  celebration: {
    title: 'NETWORK NAVIGATOR',
    detail: 'The Internet is machines passing messages along.',
  },

  recap: {
    question: 'What is the Internet, in your own words?',
    accept: ['computers', 'machines', 'passing', 'messages', 'talking', 'each other', 'sending'],
    answer: ['Computers passing messages along for each other. That is the whole thing.'],
  },

  rewards: { badges: ['network-navigator'], cosmetics: ['window'] },
};
