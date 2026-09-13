/**
 * Mission 18 — stage 8: names and numbers are two different things.
 *
 * One idea: every computer answers to a number, and the names are a
 * convenience laid on top so people do not have to remember numbers.
 *
 * The key move is noticing that the attic computer still *has* an address
 * even though nothing answers on it — a name that resolves but does not
 * reply is a completely different situation from a name nobody has heard of,
 * and telling those two apart is a genuinely useful diagnostic skill that
 * most adults never articulate.
 */

import type { Mission } from './types.js';
import { ensureRoom } from './helpers.js';

export const m18: Mission = {
  id: 'm18-names-and-numbers',
  title: 'Names and Numbers',
  stage: 8,
  minutes: [10, 15],

  teaches: ['net.name'],
  requires: ['net.reach', 'net.envelope'],

  hook: [
    'Explorer, I have found something odd.',
    'When you knocked on Gran, the computer printed a number next to her name.',
    'I do not think the names are real.',
    'I think the numbers are real and the names are for us.',
  ],

  goal: 'Find out what is behind the names.',

  async setup(world) {
    await ensureRoom(world, 'control-room');
  },

  startIn: 'control-room',

  steps: [
    {
      id: 'look-up-a-name',
      concepts: ['net.name'],

      prompt: {
        guided: [
          'There is a word that looks up the number behind a name.',
          'nslookup, then the name.',
          'nslookup gran',
        ],
        prompted: ['There is a word that turns a name into a number. Try it on gran.'],
        open: ['Find out Gran’s number.'],
      },

      predict: {
        question: 'Do you think every computer has a number?',
        options: ['Yes, all of them', 'Only some'],
        reply: 'Let us look one up.',
      },

      done: (event) => event.kind === 'net' && event.op === 'nslookup' && event.reachable,
      solution: 'nslookup gran',

      hints: {
        ask: 'It is a long word. It means "look up the name".',
        concept: 'You give it a name and it gives you back the number.',
        firstLetter: 'It starts with n-s.',
        choice: { line: 'Which one?', options: ['nslookup gran', 'ping gran'] },
        reveal: { line: 'nslookup, then the name.', command: 'nslookup gran' },
      },

      success: [
        'There it is. gran is really 10.4.0.7.',
        'The name is just easier for us to remember.',
      ],
    },

    {
      id: 'look-up-the-broken-one',
      concepts: ['net.name', 'net.reach'],

      prompt: {
        guided: ['Now try the attic one, the one that never answers.', 'nslookup attic'],
        prompted: ['Try the attic one. The one that did not answer.'],
        open: ['Try the broken one.'],
      },

      predict: {
        question: 'The attic never answers. Do you think it still has a number?',
        options: ['Yes', 'No'],
        reply: 'This is the interesting bit.',
      },

      done: (event) => event.kind === 'net' && event.op === 'nslookup' && event.reachable,
      solution: 'nslookup attic',

      hints: {
        ask: 'Same word, the attic this time.',
        concept: 'Having a number and answering are not the same thing.',
        firstLetter: 'It starts with n.',
        choice: { line: 'Which one?', options: ['nslookup attic', 'ping attic'] },
        reveal: { line: 'nslookup attic.', command: 'nslookup attic' },
      },

      success: [
        'It HAS a number. 10.0.0.4. It has always had one.',
        'It just does not answer when we knock.',
        'So "I do not know that name" and "nobody is answering" are two',
        'completely different problems.',
      ],
    },

    {
      id: 'look-up-nonsense',
      concepts: ['net.name'],

      prompt: {
        guided: ['Now try a name that does not exist at all. Make one up.'],
        prompted: ['What happens if you look up a name that is not real?'],
        open: ['Try one that does not exist.'],
      },

      done: (event) => event.kind === 'net' && event.op === 'nslookup' && !event.reachable,
      solution: 'nslookup bananas',

      nearMiss: (event) => (event.kind === 'error' ? [] : undefined),

      hints: {
        ask: 'Same word, but a made-up name.',
        concept: 'Anything that is not gran, moon or attic.',
        firstLetter: 'nslookup, then any silly word.',
        choice: { line: 'Which one?', options: ['nslookup bananas', 'nslookup gran'] },
        reveal: { line: 'Any made-up name will do.', command: 'nslookup bananas' },
      },

      success: [
        'A completely different answer. "No such name."',
        'Not "no reply". It has never heard of it at all.',
        'Now you can tell the two apart, which is more than I could this morning.',
      ],
    },

    {
      /**
       * The proof of the whole mission. If the number is what the computers
       * really use, then an envelope addressed to the number must work — and
       * writing one is the fastest way to find out. It also brings the
       * envelope back two missions after it was taught.
       */
      id: 'post-to-a-number',
      concepts: ['net.envelope', 'net.name'],

      prompt: {
        guided: [
          'Here is a test. If the number is the real address,',
          'then a letter addressed to the NUMBER should still arrive.',
          'Write one to 10.9.9.9 and send it.',
        ],
        prompted: ['Try posting a letter to a number instead of a name. Use 10.9.9.9.'],
        open: ['Prove the number is the real address.'],
      },

      predict: {
        question: 'Will a letter addressed to 10.9.9.9 get anywhere?',
        options: ['Yes', 'No'],
        reply: 'Only one way to know.',
      },

      done: (event) => event.kind === 'net' && event.op === 'send' && event.reachable,

      solution: [
        'echo FROM: me > number.txt',
        'echo TO: 10.9.9.9 >> number.txt',
        'echo MESSAGE: testing >> number.txt',
        'send number.txt',
      ],

      revealIsPartial: true,

      hints: {
        ask: 'You know how to write an envelope. Put the number where the name goes.',
        concept: 'Three lines as usual, but TO: is the number this time.',
        firstLetter: 'Start with echo FROM: me and one arrow.',
        choice: {
          line: 'What goes on the TO: line?',
          options: ['TO: 10.9.9.9', 'TO: the moon please'],
        },
        reveal: {
          line: 'Write the three lines, with the number as the address.',
          command: 'echo FROM: me > number.txt',
        },
      },

      success: [
        'IT ARRIVED. With no name on it anywhere.',
        'So the names really are only for us.',
        'The computers were using the numbers the whole time.',
      ],
    },
  ],

  celebration: {
    title: 'NAMES ARE FOR US',
    detail: 'The numbers are what the computers actually use.',
  },

  recap: {
    question: 'Why do computers have names as well as numbers?',
    accept: ['remember', 'easier', 'us', 'people', 'hard', 'humans'],
    answer: ['Because we are bad at remembering numbers. The computers do not mind either way.'],
  },
};
