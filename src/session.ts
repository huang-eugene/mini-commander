/**
 * One sitting at the computer.
 *
 * Greet, warm up, play a mission, celebrate, recap, save, say goodbye. The
 * whole thing is meant to last 5 to 15 minutes and to end while the child
 * still wants more — so there is no "next mission?" prompt at the end. One
 * mission per session is the design, not a limitation.
 */

import type { World } from './shell/fs-jail.js';
import type { Screen } from './ui/render.js';
import type { Input } from './shell/repl.js';
import { promptFor } from './shell/repl.js';
import { EventBus } from './engine/events.js';
import { Learner } from './engine/learner.js';
import { Chip, Rng } from './chip/persona.js';
import { MissionRunner } from './engine/mission-runner.js';
import { chooseMission, warmUpSatisfied } from './engine/selector.js';
import { makeDispatcher } from './shell/dispatch.js';
import { CHIP_WORDS, showHelp } from './shell/chip-words.js';
import { awardMission, noteVisit, showArtifacts, showBadges, showMap } from './engine/progress.js';
import { appendJournal, writeSave, type SaveFile, type SessionRecord } from './engine/save.js';
import { MISSIONS, stageNumber } from './missions/registry.js';
import type { ShellState } from './shell/commands.js';
import { ROOT } from './shell/vpath.js';

export interface SessionDeps {
  home: string;
  world: World;
  screen: Screen;
  input: Input;
  save: SaveFile;
  /** Seeded so transcripts are reproducible. */
  seed?: number;
  now?: () => Date;
}

export interface SessionResult {
  missionId?: string;
  completed: boolean;
  quitEarly: boolean;
}

export async function runSession(deps: SessionDeps): Promise<SessionResult> {
  const { home, world, screen, input, save } = deps;
  const now = deps.now ?? (() => new Date());
  const startedAt = now().toISOString();

  save.sessionIndex += 1;

  const bus = new EventBus();
  const learner = new Learner(save.concepts, save.sessionIndex);
  const chip = new Chip(new Rng(deps.seed ?? 1));

  const state: ShellState = { cwd: ROOT, stage: save.stage };

  const firstEver = !save.seenWelcome;

  // First run: say plainly what this is and where it keeps things. A parent
  // is almost certainly watching over the child's shoulder, and they deserve
  // to know before anything is written.
  if (!save.seenWelcome) {
    screen.heading('mini-commander');
    // The path goes on its own line rather than inside the sentence. Two
    // reasons, and the second one bit: a parent who wants to go and look at
    // the folder can read or copy it whole instead of picking it out of
    // wrapped prose, and a path inside wrapped prose is one unbreakable word
    // whose LENGTH decides where every following word lands. That made the
    // welcome block — and so four golden transcripts — depend on how long the
    // machine's temp directory happened to be, which is why they passed on
    // Linux and failed on macOS.
    screen.note('Everything CHIP does happens inside this folder:');
    screen.note(home);
    screen.note('Nothing outside it can be reached or changed from in here.');
    screen.gap();
    save.seenWelcome = true;
  }

  // Mission 1's hook is itself CHIP waking up and discovering someone is
  // there, so a greeting before it would step on its own opening line.
  if (!firstEver) {
    const greeting = chip.say('greet');
    if (greeting) screen.chip(greeting);
  }

  const choice = chooseMission(save, learner);
  if (!choice) {
    screen.chip([
      'You have done everything I had ready.',
      'Come back when I have thought of more.',
    ]);
    await finishUp(deps, { startedAt, missions: [], notes: ['Played everything available.'] });
    return { completed: true, quitEarly: false };
  }

  const { mission, warmUp, replay } = choice;

  if (replay) {
    screen.chip(['Let us do this one again. I like this one.']);
  }

  // The retrieval warm-up: one question, then on with it either way.
  if (warmUp) {
    const answer = await input.line(warmUp.question + ' ');
    if (answer !== undefined && warmUpSatisfied(warmUp, answer)) {
      screen.chip('That is the one. You remembered.');
      learner.record(warmUp.concept, { kind: 'unaided' }, now());
    } else {
      screen.chip(warmUp.reassure);
      learner.record(warmUp.concept, { kind: 'hinted', rung: 5 }, now());
    }
  }

  const runner = new MissionRunner(mission, {
    world,
    screen,
    bus,
    chip,
    learner,
    state,
    async ask(question, options) {
      if (options && options.length > 0) return input.choose(question, options);
      const answer = await input.line(question + ' ');
      return answer ?? '';
    },
  });

  // Track visits for the map, wherever they happen.
  bus.on((event) => {
    if (event.kind === 'cwd-changed') noteVisit(save, event.to);
  });

  let quitEarly = false;

  const dispatcher = makeDispatcher({
    world,
    screen,
    bus,
    state,
    chipWords: [...CHIP_WORDS],
    async onChipWord(name) {
      switch (name) {
        case 'help':
          showHelp(state.stage, screen);
          break;
        case 'hint':
          runner.giveHint();
          break;
        case 'map':
          await showMap(world, save, state.cwd, screen);
          break;
        case 'badges':
          showBadges(save, screen);
          break;
        case 'things':
          showArtifacts(save, screen);
          break;
        case 'clear':
          screen.gap();
          break;
        case 'quit':
        case 'exit':
        case 'bye':
          quitEarly = true;
          break;
      }
    },
    async onFreeText(text) {
      // "no CHIP, you're wrong" — handled by the runner's claim check via the
      // event, so here we only need to acknowledge that it was speech.
      void text;
      return true;
    },
  });

  noteVisit(save, state.cwd);

  /**
   * Whatever happens in here, the child keeps what they did.
   *
   * The save is written exactly once, at the end of this function, so any
   * unexpected throw between here and there used to lose the whole sitting —
   * no save.json, no journal.md. Not a theoretical shape of bug: typing
   * `constructor` did exactly that until recently, and a stray byte in a file
   * the child made in a real terminal could still do it through
   * decodeTolerantly.
   *
   * So an unexpected error ends the session rather than aborting it. The
   * progress is banked first, then the error is rethrown for bin/ to report —
   * which is what "Tell a grown-up" there has always implied happens.
   *
   * The trade is deliberate: banking after a crash can record a slightly wrong
   * hintsUsed. The save is counters and arrays and writeSave is atomic (temp
   * file, rename, .bak), so the worst case is a number being off by one. Set
   * against a seven-year-old losing their badges, that is not a close call —
   * save.ts says as much in its own header.
   */
  let crash: unknown;
  try {
    await runner.begin();

    // The main loop. Every line goes to the dispatcher, every event to the
    // runner. The runner decides when the mission is over; nothing else does.
    while (!quitEarly && !runner.done) {
      // A command typed at a prediction prompt is held rather than swallowed.
      const deferred = runner.takeDeferred();
      const line = deferred ?? (await input.line(promptFor(state.cwd)));
      if (line === undefined) break;

      const events: number = bus.history().length;
      const ran = await dispatcher.submit(line);
      if (!ran) continue;

      for (const event of bus.history().slice(events)) {
        const { missionDone, stepAdvanced } = await runner.handle(event);
        // Stop at the first event that advanced the step: the rest of this
        // line's events belong to the step we just left, not the new one.
        if (missionDone || stepAdvanced) break;
      }
    }
  } catch (err) {
    crash = err;
  }

  const outcome = runner.outcome();
  const record = save.missions[mission.id] ?? {
    plays: 0,
    completed: false,
    lastSessionIndex: -1,
    hintsUsed: 0,
  };
  record.plays += 1;
  record.lastSessionIndex = save.sessionIndex;
  record.hintsUsed += outcome.hintsUsed;
  record.completed = record.completed || outcome.completed;
  save.missions[mission.id] = record;

  save.predictionsMade += outcome.predictionsMade;
  if (outcome.chipCorrected) save.chipCorrections += 1;

  if (outcome.completed) {
    const announcements = awardMission(save, mission, now());
    // Nothing that draws runs after a crash: the screen may well be what
    // threw, and celebrating a session that just fell over would be strange.
    if (!crash) for (const award of announcements) screen.celebrate(award.title, award.detail);

    // Unlock the next stage's vocabulary only after finishing its missions,
    // so the command list grows at the pace of the story.
    const nextStage = Math.max(save.stage, stageNumber(mission) + 1);
    if (nextStage > save.stage && nextStage <= 8) save.stage = nextStage;
  }

  if (!crash) {
    const farewell = chip.say('goodbye');
    if (farewell) screen.chip(farewell);
  }

  const notes = buildNotes(mission.title, outcome, learner);
  if (crash) {
    // The grown-up's journal is where this belongs. A child should not be told
    // the game broke in the middle of their session; an adult reading back
    // should.
    notes.push('The game hit a problem and stopped early. Progress up to then was kept.');
  }

  await finishUp(deps, { startedAt, missions: [mission.id], notes });

  // Banked. Now let it out, so bin/ can print the real error for a grown-up.
  if (crash) throw crash;

  return { missionId: mission.id, completed: outcome.completed, quitEarly };
}

function buildNotes(
  title: string,
  outcome: { completed: boolean; hintsUsed: number; predictionsMade: number },
  learner: Learner,
): string[] {
  const notes: string[] = [];

  notes.push(
    outcome.completed
      ? `Finished "${title}".`
      : `Started "${title}" and stopped partway. Nothing is lost.`,
  );

  if (outcome.hintsUsed === 0 && outcome.completed) {
    notes.push('Did it without asking for a single clue.');
  } else if (outcome.hintsUsed > 0) {
    notes.push(`Asked for ${outcome.hintsUsed} clue${outcome.hintsUsed === 1 ? '' : 's'}.`);
  }

  if (outcome.predictionsMade > 0) {
    notes.push(`Made ${outcome.predictionsMade} prediction(s) before pressing Enter.`);
  }

  const shaky = learner.shaky();
  if (shaky.length > 0) {
    notes.push(`Worth revisiting next time: ${shaky.join(', ')}.`);
  }

  const solid = learner.solid();
  if (solid.length > 0) {
    notes.push(`Solid now: ${solid.join(', ')}.`);
  }

  return notes;
}

async function finishUp(
  deps: SessionDeps,
  partial: { startedAt: string; missions: string[]; notes: string[] },
): Promise<void> {
  const now = deps.now ?? (() => new Date());
  const record: SessionRecord = {
    startedAt: partial.startedAt,
    endedAt: now().toISOString(),
    missions: partial.missions,
    notes: partial.notes,
  };

  deps.save.sessions.push(record);
  await writeSave(deps.home, deps.save, now());
  await appendJournal(deps.home, record);
}

export { MISSIONS };
