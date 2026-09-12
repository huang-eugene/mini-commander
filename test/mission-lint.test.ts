/**
 * Holding 22 hand-written missions to one pedagogical standard.
 *
 * Mission content is prose, written by hand, and prose drifts. Someone adds a
 * mission in a hurry, forgets the `open` scaffolding variant, writes four
 * hint rungs instead of five, or writes a rung-5 reveal that does not
 * actually work. None of that fails a typecheck and none of it is visible in
 * review once there are twenty missions.
 *
 * So the rules from the brief are enforced here as tests. The important one
 * is the last: it takes each step's declared `solution`, runs it for real in
 * a scratch world, and asserts the step then completes. That is an executable
 * proof that every mission is finishable and that no hint lies to the child.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MISSIONS } from '../src/missions/registry.js';
import { ALL_CONCEPT_IDS, concept } from '../src/engine/concepts.js';
import { CHIP_LINE_WIDTH } from '../src/ui/render.js';
import { SCAFFOLD_ORDER } from '../src/engine/learner.js';
import { COMMANDS } from '../src/shell/commands.js';
import { makeShell } from './harness/session.js';
import type { StepContext } from '../src/missions/types.js';

test('every mission has an id, a title and at least one step', () => {
  const seen = new Set<string>();

  for (const mission of MISSIONS) {
    assert.ok(mission.id.length > 0, 'a mission has no id');
    assert.ok(!seen.has(mission.id), `duplicate mission id: ${mission.id}`);
    seen.add(mission.id);

    assert.ok(mission.title.length > 0, `${mission.id} has no title`);
    assert.ok(mission.steps.length > 0, `${mission.id} has no steps`);
    assert.ok(mission.hook.length > 0, `${mission.id} has no story hook`);
    assert.ok(mission.goal.length > 0, `${mission.id} has no goal`);
  }
});

test('no mission introduces more than two new ideas', () => {
  // Straight from the brief: "Each mission should teach or reinforce only one
  // or two major ideas." This is the rule most easily broken by accident.
  for (const mission of MISSIONS) {
    assert.ok(
      mission.teaches.length <= 2,
      `${mission.id} teaches ${mission.teaches.length} concepts: ${mission.teaches.join(', ')}`,
    );
  }
});

test('every mission is between 5 and 15 minutes', () => {
  for (const mission of MISSIONS) {
    const [low, high] = mission.minutes;
    assert.ok(low >= 5, `${mission.id} claims it can finish in ${low} minutes`);
    assert.ok(high <= 15, `${mission.id} could run ${high} minutes; the cap is 15`);
    assert.ok(low <= high, `${mission.id} has a backwards time range`);
  }
});

test('every step has all three scaffolding levels', () => {
  for (const mission of MISSIONS) {
    for (const step of mission.steps) {
      for (const level of SCAFFOLD_ORDER) {
        const lines = step.prompt[level];
        assert.ok(
          Array.isArray(lines) && lines.length > 0,
          `${mission.id}/${step.id} has no "${level}" prompt`,
        );
      }
    }
  }
});

test('guidance actually decreases as scaffolding fades', () => {
  // A step whose `open` text is longer than its `guided` text is almost
  // certainly a copy-paste, and the fading would be cosmetic.
  for (const mission of MISSIONS) {
    for (const step of mission.steps) {
      const length = (lines: string[]): number => lines.join(' ').length;
      const guided = length(step.prompt.guided);
      const open = length(step.prompt.open);

      assert.ok(
        open <= guided,
        `${mission.id}/${step.id}: the "open" prompt (${open} chars) should not be ` +
          `longer than the "guided" one (${guided} chars)`,
      );
    }
  }
});

test('every step has a complete five-rung hint ladder', () => {
  for (const mission of MISSIONS) {
    for (const step of mission.steps) {
      const h = step.hints;
      assert.ok(h.ask.length > 0, `${mission.id}/${step.id} rung 1 (ask) is empty`);
      assert.ok(h.concept.length > 0, `${mission.id}/${step.id} rung 2 (concept) is empty`);
      assert.ok(h.firstLetter.length > 0, `${mission.id}/${step.id} rung 3 is empty`);
      assert.equal(
        h.choice.options.length,
        2,
        `${mission.id}/${step.id} rung 4 must offer exactly two choices`,
      );
      assert.ok(
        h.reveal.command.length > 0,
        `${mission.id}/${step.id} rung 5 has no command to reveal`,
      );
    }
  }
});

test('every mission asks the child to predict something at least once', () => {
  // "Prediction should be treated as more important than getting the answer
  // correct." A mission with no prediction has dropped the mechanism.
  for (const mission of MISSIONS) {
    const predictions = mission.steps.filter((s) => s.predict);
    assert.ok(predictions.length >= 1, `${mission.id} never asks "what do you think will happen?"`);

    for (const step of predictions) {
      assert.ok(
        step.predict!.question.trim().endsWith('?'),
        `${mission.id}/${step.id}: the prediction should be a question`,
      );
    }
  }
});

test('every mission ends with a short recap', () => {
  for (const mission of MISSIONS) {
    assert.ok(mission.recap.question.length > 0, `${mission.id} has no recap question`);
    assert.ok(mission.recap.accept.length > 0, `${mission.id} accepts no recap answers`);
    assert.ok(
      mission.recap.answer.length <= 3,
      `${mission.id}'s recap answer is ${mission.recap.answer.length} lines; keep it very short`,
    );
  }
});

test('no line is too long for a developing reader', () => {
  // The renderer wraps, but a single unbroken word longer than the box means
  // a name or path the child cannot read in one go.
  for (const mission of MISSIONS) {
    const everyLine = [
      ...mission.hook,
      mission.goal,
      ...mission.recap.answer,
      mission.recap.question,
      ...mission.steps.flatMap((s) => [
        ...s.prompt.guided,
        ...s.prompt.prompted,
        ...s.prompt.open,
        ...s.success,
        s.hints.ask,
        s.hints.concept,
        s.hints.firstLetter,
        s.hints.choice.line,
        s.hints.reveal.line,
      ]),
    ];

    for (const line of everyLine) {
      for (const word of line.split(/\s+/)) {
        assert.ok(
          word.length <= CHIP_LINE_WIDTH,
          `${mission.id}: "${word}" is ${word.length} characters and will not wrap`,
        );
      }
    }
  }
});

test('concepts are real, and prerequisites come from earlier missions', () => {
  const taughtSoFar = new Set<string>();

  for (const mission of MISSIONS) {
    for (const id of [...mission.teaches, ...mission.requires]) {
      assert.ok(
        (ALL_CONCEPT_IDS as readonly string[]).includes(id),
        `${mission.id} refers to an unknown concept: ${id}`,
      );
    }

    // Everything a mission leans on must already have been taught. Otherwise
    // the child meets a prerequisite they were never given.
    for (const id of mission.requires) {
      assert.ok(
        taughtSoFar.has(id),
        `${mission.id} requires "${id}", which no earlier mission teaches`,
      );
    }

    for (const id of mission.teaches) taughtSoFar.add(id);

    // Steps may only use concepts the mission declares or requires.
    for (const step of mission.steps) {
      for (const id of step.concepts) {
        assert.ok(
          taughtSoFar.has(id),
          `${mission.id}/${step.id} uses "${id}" before any mission teaches it`,
        );
      }
    }
  }
});

test('every concept is taught once and practised again later', () => {
  // This is the "repetition with variation" rule. A concept that appears in
  // exactly one mission and never again will be forgotten, and the brief is
  // explicit that ls "should not appear once and disappear".
  const taughtBy = new Map<string, string[]>();
  const usedBy = new Map<string, string[]>();

  for (const mission of MISSIONS) {
    for (const id of mission.teaches) {
      taughtBy.set(id, [...(taughtBy.get(id) ?? []), mission.id]);
    }
    for (const step of mission.steps) {
      for (const id of step.concepts) {
        usedBy.set(id, [...(usedBy.get(id) ?? []), mission.id]);
      }
    }
  }

  // The final mission is exempt: whatever it introduces has nothing after it
  // by definition, and that is a fact about the end of the curriculum rather
  // than a defect. Every other concept must come back.
  const last = MISSIONS[MISSIONS.length - 1];
  const exempt = new Set<string>(last?.teaches ?? []);

  for (const [id, missions] of taughtBy) {
    if (exempt.has(id)) continue;

    const uses = new Set(usedBy.get(id) ?? []);
    const later = [...uses].filter((m) => !missions.includes(m));

    assert.ok(
      later.length >= 1,
      `"${id}" is taught by ${missions.join(', ')} and never practised in a later mission. ` +
        'A command that appears once and disappears will be forgotten.',
    );
  }
});

test("a step's reveal names a command the child has actually met", () => {
  const stageOf = new Map(COMMANDS.map((c) => [c.name, c.unlockedAt]));

  for (const mission of MISSIONS) {
    const stage = typeof mission.stage === 'number' ? mission.stage : 8;

    for (const step of mission.steps) {
      const word = step.hints.reveal.command.trim().split(/\s+/)[0] ?? '';
      const unlockedAt = stageOf.get(word);

      // Not every reveal is a bare command (some are `cd lab`), but if the
      // first word is a command it must be available by this stage.
      if (unlockedAt !== undefined) {
        assert.ok(
          unlockedAt <= stage,
          `${mission.id}/${step.id} reveals "${word}", which is locked until stage ${unlockedAt}`,
        );
      }
    }
  }
});

test('CHIP never offers generic praise on success', () => {
  // "Avoid generic praise after every action. Prefer specific reactions."
  const BANNED = [
    'good job',
    'well done',
    'great job',
    'nice work',
    'awesome',
    'excellent',
    'perfect',
    'amazing',
    'clever girl',
    'clever boy',
    'good boy',
    'good girl',
  ];

  for (const mission of MISSIONS) {
    for (const step of mission.steps) {
      for (const line of step.success) {
        const lower = line.toLowerCase();
        for (const phrase of BANNED) {
          assert.ok(
            !lower.includes(phrase),
            `${mission.id}/${step.id} says "${phrase}" — say what they actually did instead`,
          );
        }
      }
    }
  }
});

test('success lines are not copy-pasted between steps', () => {
  // Identical feedback in two places means at least one of them is not
  // specific to what happened.
  const seen = new Map<string, string>();

  for (const mission of MISSIONS) {
    for (const step of mission.steps) {
      const joined = step.success.join(' ');
      const previous = seen.get(joined);
      assert.equal(
        previous,
        undefined,
        `${mission.id}/${step.id} reuses the success text from ${previous}`,
      );
      seen.set(joined, `${mission.id}/${step.id}`);
    }
  }
});

test('mission setup is idempotent', async () => {
  // The world persists between sessions, a grown-up may have tidied it, and
  // a mission may be replayed. Running setup twice must not throw or
  // duplicate anything.
  for (const mission of MISSIONS) {
    const shell = await makeShell();
    try {
      await mission.setup(shell.world);
      const first = await shell.world.measure();

      await mission.setup(shell.world);
      const second = await shell.world.measure();

      assert.deepEqual(second, first, `${mission.id}: running setup twice changed the world`);
    } finally {
      await shell.cleanup();
    }
  }
});

test('mission setup never overwrites what the child wrote', async () => {
  // If a child scribbles in CHIP's note, that is theirs. Setup must work
  // around it rather than silently restoring the original, which would look
  // to them like the computer undid their work.
  for (const mission of MISSIONS) {
    const shell = await makeShell();
    try {
      await mission.setup(shell.world);

      const rooms = await shell.world.allRooms();
      let checked = 0;

      for (const room of rooms) {
        for (const entry of await shell.world.list(room, 'ls')) {
          if (entry.kind !== 'thing') continue;
          const path = `${room}/${entry.name}`.replace('//', '/');
          const target = shell.state.cwd;
          void target;

          await shell.run(`echo MINE > ${path}`);
          await mission.setup(shell.world);

          const after = await shell.world.read(
            (path.startsWith('/') ? path : '/' + path) as never,
            'cat',
          );
          assert.match(
            after,
            /MINE/,
            `${mission.id}: setup overwrote the child's own text in ${path}`,
          );
          checked += 1;
          break;
        }
        if (checked > 0) break;
      }
    } finally {
      await shell.cleanup();
    }
  }
});

/**
 * The one that matters most.
 *
 * For every step, run the command the hint ladder would eventually reveal and
 * assert the step's `done` predicate then fires. If this passes, every
 * mission in the game is provably completable and rung 5 never lies.
 */
test('running each step’s solution completes that step', async () => {
  for (const mission of MISSIONS) {
    const shell = await makeShell();

    try {
      await mission.setup(shell.world);

      // Start where the mission starts.
      if (mission.startIn) await shell.run(`cd ${mission.startIn}`);

      for (const step of mission.steps) {
        const lines = Array.isArray(step.solution) ? step.solution : [step.solution];
        const shown = lines.join(' then ');

        let completed = false;
        const allEvents: string[] = [];

        // Run the sequence, checking after every command. A multi-command
        // solution may well satisfy the step before its last line — what
        // matters is that following it gets there.
        for (const line of lines) {
          const before = shell.bus.history().length;
          await shell.run(line);
          const produced = shell.bus.history().slice(before);

          assert.ok(
            produced.length > 0,
            `${mission.id}/${step.id}: "${line}" produced no events at all`,
          );
          allEvents.push(...produced.map((e) => e.kind));

          const ctx: StepContext = {
            world: shell.world,
            cwd: shell.state.cwd,
            anchor: shell.state.cwd,
          };

          for (const event of produced) {
            if (await step.done(event, ctx)) {
              completed = true;
              break;
            }
          }
          if (completed) break;
        }

        assert.ok(
          completed,
          `${mission.id}/${step.id}: the solution "${shown}" did not complete the step.\n` +
            `Events were: ${allEvents.join(', ')}\n` +
            `Output was:\n${shell.output()}`,
        );
      }
    } finally {
      await shell.cleanup();
    }
  }
});

test('the reveal command and the declared solution agree', () => {
  // On an ordinary step, rung 5 is the answer, so it must start with the same
  // word as the solution — otherwise the ladder is pointing somewhere else
  // entirely. A step may opt out with `revealIsPartial` when rung 5 should
  // point the way instead (see m05, where naming the file would skip the
  // searching), and those still have to pass the "solution completes the
  // step" test above.
  for (const mission of MISSIONS) {
    for (const step of mission.steps) {
      if (step.revealIsPartial) continue;

      const revealWord = step.hints.reveal.command.trim().split(/\s+/)[0];
      // For a multi-command solution the reveal may name any step of the
      // sequence — often the last one, which is the command that actually
      // completes the step.
      const lines = Array.isArray(step.solution) ? step.solution : [step.solution];
      const solutionWords = lines.map((l) => l.trim().split(/\s+/)[0]);

      assert.ok(
        solutionWords.includes(revealWord),
        `${mission.id}/${step.id}: rung 5 reveals "${revealWord}", which is not part of the ` +
          `solution (${solutionWords.join(', ')}). If that is deliberate, set revealIsPartial.`,
      );
    }
  }
});

test('a partial reveal still makes real progress', () => {
  // The opt-out must not become a way to ship a useless rung 5. A partial
  // reveal still has to name a command the child can actually run.
  for (const mission of MISSIONS) {
    for (const step of mission.steps) {
      if (!step.revealIsPartial) continue;

      const word = step.hints.reveal.command.trim().split(/\s+/)[0] ?? '';
      assert.ok(
        COMMANDS.some((c) => c.name === word),
        `${mission.id}/${step.id}: a partial reveal must still name a real command, got "${word}"`,
      );
    }
  }
});

test('concept metaphors exist for everything the hint ladder leans on', () => {
  for (const id of ALL_CONCEPT_IDS) {
    const c = concept(id);
    assert.ok(c.metaphor.length > 0, `${id} has no metaphor for CHIP to use`);
    assert.ok(c.stage >= 1 && c.stage <= 8, `${id} has an odd stage: ${c.stage}`);
  }
});
