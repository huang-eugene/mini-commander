/**
 * Mission 4 — stage 3: moving around.
 *
 * Two ideas: you can walk into a room, and you can walk back out. `cd` and
 * `cd ..`.
 *
 * `ls` gets used four times here, in four different rooms, for four different
 * reasons. That is the "repetition with variation" rule doing its job: the
 * command stays the same while the purpose changes each time, which is what
 * makes it stick without drilling.
 */

import type { Mission } from './types.js';
import { ensureFile, ensureRoom, enteredRoom, wentUp } from './helpers.js';

export const m04: Mission = {
  id: 'm04-three-doors',
  title: 'Three Doors',
  stage: 3,
  minutes: [10, 15],

  teaches: ['cd.into', 'cd.up'],
  requires: ['ls.look', 'cat.read'],

  hook: [
    'Explorer. I have been exploring without you. Sorry.',
    'There are three doors off the control room.',
    'I looked through all of them and now I am lost.',
    'Also I left my torch somewhere.',
  ],

  goal: 'Walk into each room, find CHIP’s torch, and get back out.',

  async setup(world) {
    await ensureRoom(world, 'control-room');
    await ensureRoom(world, 'control-room/cave');
    await ensureRoom(world, 'control-room/spaceship');
    await ensureRoom(world, 'control-room/lab');

    await ensureFile(world, 'control-room/cave/wet-rock.txt', 'A damp rock. Nothing else.');
    await ensureFile(
      world,
      'control-room/spaceship/torch.txt',
      ['CHIP’S TORCH', '', 'Found it! It was in the spaceship the whole time.'].join('\n'),
    );
    await ensureFile(
      world,
      'control-room/lab/notes.txt',
      ['Lab notes:', '', 'Rooms can have rooms inside them.', 'I have not tried that yet.'].join(
        '\n',
      ),
    );
  },

  startIn: 'control-room',

  steps: [
    {
      id: 'see-the-doors',
      concepts: ['ls.look'],

      prompt: {
        guided: ['Look around the control room first. What are the three doors called?', 'ls'],
        prompted: ['Can you see what the three doors are called?'],
        open: ['Find out what our three options are.'],
      },

      done: (event) => event.kind === 'listed' && event.entries.length >= 3,
      solution: 'ls',

      hints: {
        ask: 'The looking word. You have used it a few times now.',
        concept: 'Two letters, lists what is here.',
        firstLetter: 'It starts with l.',
        choice: { line: 'Which one?', options: ['ls', 'cd'] },
        reveal: { line: 'ls.', command: 'ls' },
      },

      success: [
        'A cave, a spaceship and a lab.',
        'The ones with a slash after them are rooms.',
        'We can go INSIDE those.',
      ],
    },

    {
      id: 'walk-in',
      concepts: ['cd.into'],

      prompt: {
        guided: [
          'To walk into a room you use cd, then the room name.',
          'Let us try the cave:',
          'cd cave',
        ],
        prompted: ['There is a word for walking into a room. Try it on the cave.'],
        open: ['Go and look in the cave.'],
      },

      predict: {
        question: 'If we walk into the cave, do you think pwd will change?',
        options: ['Yes, it changes', 'No, it stays the same'],
        reply: 'We can check afterwards.',
      },

      done: enteredRoom('cave'),
      solution: 'cd cave',

      hints: {
        ask: 'Two letters again. It means "change directory" — go to a different room.',
        concept: 'cd, then where you want to go.',
        firstLetter: 'It starts with c. But it is not cat.',
        choice: { line: 'Which one walks?', options: ['cd cave', 'ls cave'] },
        reveal: { line: 'cd cave. cd means go there.', command: 'cd cave' },
      },

      success: ['We are IN the cave. Try pwd if you want to see.', 'Have a look around in here.'],
    },

    {
      id: 'look-in-cave',
      concepts: ['ls.look'],

      prompt: {
        guided: ['Look around the cave.', 'ls'],
        prompted: ['What is in the cave?'],
        open: ['See what is in here.'],
      },

      done: (event) => event.kind === 'listed',
      solution: 'ls',

      hints: {
        ask: 'Same word as always for looking.',
        concept: 'The room changed, but the looking word did not.',
        firstLetter: 'l.',
        choice: { line: 'Which one?', options: ['ls', 'pwd'] },
        reveal: { line: 'ls works in every room.', command: 'ls' },
      },

      success: ['A wet rock. No torch. Typical.'],
    },

    {
      id: 'go-back-up',
      concepts: ['cd.up'],

      prompt: {
        guided: [
          'To get back out of a room, you use cd with two dots.',
          'Two dots means "the room outside this one".',
          'cd ..',
        ],
        prompted: ['We need to get back out to the control room. Any ideas?'],
        open: ['Get us back out of here.'],
      },

      predict: {
        question: 'Where do you think we end up?',
        options: ['The control room', 'The spaceship', 'Outside the computer'],
        reply: 'Let us see where we land.',
      },

      done: wentUp(),
      solution: 'cd ..',

      hints: {
        ask: 'Same walking word. But where do you tell it to go?',
        concept: 'There is a special name for "the room outside this one".',
        firstLetter: 'It is not a word. It is two little dots.',
        choice: { line: 'Which one goes back out?', options: ['cd ..', 'cd back'] },
        reveal: { line: 'cd .. — two dots means one room outwards.', command: 'cd ..' },
      },

      nearMiss: (event) => {
        if (event.kind === 'error' && event.command === 'cd' && event.code === 'ENOENT') {
          return [
            'The computer looked for a room with that name and there is not one.',
            'The way out is not a name. It is two dots.',
          ];
        }
        return undefined;
      },

      success: ['Back in the control room. Two dots takes you outwards.'],
    },

    {
      id: 'find-the-torch',
      concepts: ['cd.into', 'ls.look'],

      prompt: {
        guided: [
          'Two doors left. My torch is behind one of them.',
          'Walk into the spaceship and look around.',
        ],
        prompted: ['Go and find my torch. It is in the spaceship or the lab.'],
        open: ['Find my torch.'],
      },

      done: enteredRoom('spaceship'),
      solution: 'cd spaceship',

      hints: {
        ask: 'You know how to walk into a room now. Which room?',
        concept: 'cd, then spaceship or lab.',
        firstLetter: 'c, then the room name.',
        choice: { line: 'Which?', options: ['cd spaceship', 'cd ..'] },
        reveal: { line: 'Try the spaceship first.', command: 'cd spaceship' },
      },

      success: ['The spaceship! Look around, quick.'],
    },

    {
      id: 'read-the-torch',
      concepts: ['ls.look', 'cat.read'],

      prompt: {
        guided: ['Look around, then read what you find.'],
        prompted: ['Is it in here? Have a look, then read it.'],
        open: ['Is my torch in here?'],
      },

      done: (event) => event.kind === 'file-read',
      solution: 'cat torch.txt',

      hints: {
        ask: 'Look first, then read. You know both of those.',
        concept: 'ls shows you what is here. cat shows what is inside it.',
        firstLetter: 'Looking starts with l. Reading starts with c.',
        choice: { line: 'To read it:', options: ['cat torch.txt', 'ls torch.txt'] },
        reveal: { line: 'cat, then the name.', command: 'cat torch.txt' },
      },

      success: [
        'MY TORCH! You found it!',
        'It was in the spaceship. I had been in the spaceship.',
        'I am not very good at this.',
      ],
    },
  ],

  celebration: {
    title: 'EXPLORER BADGE',
    detail: 'You can walk anywhere in CHIP’s world now.',
  },

  recap: {
    question: 'How do you get back OUT of a room?',
    accept: ['..', 'two dots', 'dots', 'cd ..'],
    answer: ['cd and two dots. That is the way out of anywhere.'],
  },

  rewards: {
    badges: ['explorer'],
    cosmetics: ['torch'],
    artifacts: ['torch.txt'],
  },
};
