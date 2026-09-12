/**
 * Mission 5 — stage 3: no new commands at all.
 *
 * This mission teaches nothing new on purpose. It is pure retrieval: the
 * child has `ls`, `cd`, `cd ..` and `cat`, and the only way through is to
 * use all four, repeatedly, in rooms they have not seen, without being told
 * which to use when.
 *
 * The brief asks for missions that reinforce rather than introduce, and for
 * scaffolding that shifts "from instruction to exploration". A mission with
 * an empty `teaches` list is what that looks like in practice. It is also
 * where the child first feels competent rather than instructed, which is
 * worth more than another command.
 */

import type { Mission } from './types.js';
import { ensureFile, ensureRoom, readSomethingSaying } from './helpers.js';

export const m05: Mission = {
  id: 'm05-moon-crystal',
  title: 'The Lost Moon Crystal',
  stage: 3,
  minutes: [10, 15],

  teaches: [],
  requires: ['cd.into', 'cd.up', 'ls.look', 'cat.read'],

  hook: [
    'Explorer. Serious problem.',
    'The Moon Crystal is missing.',
    'It powers my whole world. Without it I go a bit grey.',
    'It is in one of these rooms. I do not know which.',
  ],

  goal: 'Search the rooms until you find the Moon Crystal.',

  async setup(world) {
    await ensureRoom(world, 'control-room');

    // Somewhere deep enough to need real searching, with dead ends that are
    // interesting rather than empty. A dead end should be a small reward.
    await ensureFile(
      world,
      'control-room/cave/wet-rock.txt',
      'Still a damp rock. It has not changed.',
    );
    await ensureRoom(world, 'control-room/cave/tunnel');
    await ensureFile(
      world,
      'control-room/cave/tunnel/bones.txt',
      ['Some old bones.', '', 'Probably a robot. Probably fine.'].join('\n'),
    );

    await ensureFile(world, 'control-room/spaceship/torch.txt', 'CHIP’S TORCH');
    await ensureRoom(world, 'control-room/spaceship/cockpit');
    await ensureFile(
      world,
      'control-room/spaceship/cockpit/buttons.txt',
      ['Forty-one buttons.', '', 'I have pressed all of them. Twice.'].join('\n'),
    );

    await ensureRoom(world, 'control-room/lab/cupboard');
    await ensureFile(
      world,
      'control-room/lab/cupboard/moon-crystal.txt',
      [
        'THE MOON CRYSTAL',
        '',
        'It is warm and it hums a bit.',
        'It was in the cupboard in the lab.',
        '',
        'CHIP put it here for safekeeping and then',
        'immediately forgot. Classic CHIP.',
      ].join('\n'),
    );
    await ensureFile(
      world,
      'control-room/lab/notes.txt',
      ['Lab notes:', '', 'Rooms can have rooms inside them.', 'Check cupboards.'].join('\n'),
    );
  },

  startIn: 'control-room',

  steps: [
    {
      id: 'find-the-crystal',
      concepts: ['cd.into', 'cd.up', 'ls.look', 'cat.read'],

      // All three levels say very little. That is the point of this mission:
      // even at `guided` the child is told to search, not told how.
      prompt: {
        guided: [
          'You know everything you need for this already.',
          'Look around a room. Walk into the rooms you find.',
          'Read anything that looks interesting. Two dots gets you back out.',
          'Off you go.',
        ],
        prompted: ['Some rooms have rooms inside them. I would check those.', 'Find my crystal.'],
        open: ['Find it. I trust you.'],
      },

      predict: {
        question: 'Which room do you think it is in?',
        options: ['The cave', 'The spaceship', 'The lab'],
        reply: 'Let us find out if you are right.',
      },

      done: readSomethingSaying('MOON CRYSTAL'),
      solution: 'cat lab/cupboard/moon-crystal.txt',

      hints: {
        ask: 'Where have you not looked yet?',
        concept: 'Some rooms have more rooms inside them. Did you go all the way in?',
        firstLetter: 'Try the lab. There is a note in there worth reading.',
        choice: { line: 'It is inside one of these:', options: ['lab', 'cave'] },
        reveal: {
          line: 'It is in a cupboard in the lab. Walk in and read it.',
          command: 'cd lab',
        },
      },

      nearMiss: (event) => {
        if (event.kind === 'listed' && event.entries.includes('cupboard')) {
          return ['A cupboard! Things get put in cupboards and forgotten.'];
        }
        if (event.kind === 'file-read' && event.text.includes('bones')) {
          return ['Bones. Not a crystal. Keep going.'];
        }
        if (event.kind === 'file-read' && event.text.includes('buttons')) {
          return ['Forty-one buttons and not one crystal.'];
        }
        return undefined;
      },

      success: [
        'THE CRYSTAL! You found it!',
        'In a cupboard. In the lab. Where I put it.',
        'You searched three rooms and I only searched my own memory.',
      ],
    },
  ],

  celebration: {
    title: 'MOON CRYSTAL RECOVERED',
    detail: 'You did that with no new commands at all.',
  },

  recap: {
    question: 'You did all of that with four words. Can you name any of them?',
    accept: ['ls', 'cd', 'cat', 'pwd', 'dots'],
    answer: ['ls, cd, cd .. and cat.', 'Four words and you can go anywhere in here.'],
  },

  rewards: { artifacts: ['moon-crystal.txt'], cosmetics: ['crystal-glow'] },
};
