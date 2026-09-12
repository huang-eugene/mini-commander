/**
 * The mission runner.
 *
 * Drives one mission: shows the hook, walks the steps, asks for predictions,
 * runs the hint ladder, and reacts to whatever the child actually does —
 * including things the mission never anticipated.
 *
 * Two behaviours here matter more than the plumbing:
 *
 * - A step never blocks. If the child wanders off and starts building rooms
 *   in the middle of a mission, that is allowed and CHIP reacts to it. The
 *   step stays open. The brief is explicit that curiosity outranks the
 *   curriculum, so "wrong" is not a state this runner has.
 *
 * - Errors are handed back as questions. The dispatcher has already printed
 *   the real error text; the runner's job is to let CHIP ask what it meant,
 *   and then get out of the way.
 */

import type { Screen } from '../ui/render.js';
import type { EventBus, ShellEvent } from './events.js';
import type { Mission, Step, StepContext } from '../missions/types.js';
import type { World } from '../shell/fs-jail.js';
import { findCommand, type ShellState } from '../shell/commands.js';
import { HintLadder } from './hints.js';
import { Learner } from './learner.js';
import { Chip } from '../chip/persona.js';
import { ROOT, resolve, type VPath } from '../shell/vpath.js';
import { reactToCuriosity } from './curiosity.js';

export interface RunnerDeps {
  world: World;
  screen: Screen;
  bus: EventBus;
  chip: Chip;
  learner: Learner;
  state: ShellState;
  /** Asks the child something and waits. Returns '' if they just pressed Enter. */
  ask(question: string, options?: string[]): Promise<string>;
}

export interface MissionOutcome {
  completed: boolean;
  hintsUsed: number;
  predictionsMade: number;
  chipCorrected: boolean;
  /** Notes for the grown-up's journal. */
  notes: string[];
}

export class MissionRunner {
  private stepIndex = 0;
  private attempts = 0;
  private ladder: HintLadder;
  private hintsUsed = 0;
  private predictionsMade = 0;
  private chipCorrected = false;
  private claimPending = false;
  private anchor: VPath = ROOT;
  private readonly notes: string[] = [];
  private awaitingPrediction = false;
  private deferred: string | undefined;

  constructor(
    private readonly mission: Mission,
    private readonly deps: RunnerDeps,
  ) {
    const first = mission.steps[0];
    if (!first) throw new Error(`mission ${mission.id} has no steps`);
    this.ladder = new HintLadder(first.hints);
  }

  get current(): Step | undefined {
    return this.mission.steps[this.stepIndex];
  }

  get done(): boolean {
    return this.stepIndex >= this.mission.steps.length;
  }

  /** Prints the hook and the first step. Call once, before any input. */
  async begin(): Promise<void> {
    const { world, screen, state, chip } = this.deps;

    await this.mission.setup(world);

    this.anchor = this.mission.startIn ? resolve(ROOT, this.mission.startIn) : ROOT;
    if ((await world.kindOf(this.anchor, 'cd')) === 'room') {
      state.cwd = this.anchor;
    }

    screen.heading(this.mission.title);
    screen.gap();
    screen.chip(this.mission.hook);
    screen.note(`What we are doing: ${this.mission.goal}`);

    void chip;
    await this.enterStep();
  }

  private async enterStep(): Promise<void> {
    const step = this.current;
    if (!step) return;

    this.attempts = 0;
    this.ladder = new HintLadder(step.hints);

    // CHIP's deliberate mistake goes before the instruction, so the child
    // has something to disagree with while they work.
    if (this.mission.claim && this.stepIndex === 0) {
      this.deps.screen.chip(this.mission.claim.claim);
      this.claimPending = true;
    }

    const scaffold = this.deps.learner.scaffoldFor(step.concepts);
    this.deps.screen.chip(step.prompt[scaffold]);

    if (step.predict) await this.askPrediction(step);
  }

  private async askPrediction(step: Step): Promise<void> {
    const predict = step.predict;
    if (!predict) return;

    this.awaitingPrediction = true;
    const answer = await this.deps.ask(predict.question, predict.options);
    this.awaitingPrediction = false;

    // A prediction is a modal prompt, and a child who has just been shown a
    // command will type the command at it. Swallowing that would lose their
    // input and then congratulate them for a guess they never made. If the
    // answer looks like a command, take it as one: they have skipped ahead,
    // which is allowed.
    const firstWord = answer.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    if (findCommand(firstWord, this.deps.state.stage)) {
      this.deferred = answer.trim();
      return;
    }

    // Credit is for making a guess, not for being right. A child who guesses
    // wrong has still done retrieval, and telling them off for it would kill
    // the habit we are trying to build.
    if (answer.trim().length > 0) {
      this.predictionsMade += 1;
      for (const id of step.concepts) this.deps.learner.record(id, { kind: 'predicted' });
    }

    this.deps.screen.chip(predict.reply);
  }

  /**
   * A line the child typed at a prompt that was not asking for a command.
   * The session loop drains this before reading new input, so nothing they
   * type is ever silently thrown away.
   */
  takeDeferred(): string | undefined {
    const held = this.deferred;
    this.deferred = undefined;
    return held;
  }

  /**
   * Feed every shell event through here.
   *
   * `stepAdvanced` tells the caller to stop feeding the rest of this line's
   * events. One typed line usually produces two: a specific one (`said`,
   * `listed`, `file-read`) and the generic `command` that follows it. Without
   * this, the generic one lands on the step the child has only just been
   * given, gets counted as a failed attempt at it, and CHIP says something
   * baffling before they have typed anything.
   */
  async handle(event: ShellEvent): Promise<{ missionDone: boolean; stepAdvanced: boolean }> {
    const idle = { missionDone: this.done, stepAdvanced: false };
    if (this.done || this.awaitingPrediction) return idle;

    const step = this.current;
    if (!step) return idle;

    // Did the child catch CHIP out?
    if (this.claimPending && this.mission.claim?.disprovedBy(event)) {
      this.claimPending = false;
      this.chipCorrected = true;
      this.deps.screen.chip(this.mission.claim.onCorrected);
      this.deps.learner.record(this.mission.claim.concept, { kind: 'corrected-chip' });
      this.notes.push(`Put CHIP right about ${this.mission.claim.concept}.`);
    }

    const ctx: StepContext = {
      world: this.deps.world,
      cwd: this.deps.state.cwd,
      anchor: this.anchor,
    };

    if (await step.done(event, ctx)) {
      await this.completeStep(step);
      return { missionDone: this.done, stepAdvanced: true };
    }

    // Not the step, but not nothing either.
    this.reactToOffTarget(step, event);
    return { missionDone: false, stepAdvanced: false };
  }

  private async completeStep(step: Step): Promise<void> {
    const rung = this.ladder.current;
    for (const id of step.concepts) {
      this.deps.learner.record(id, rung === 0 ? { kind: 'unaided' } : { kind: 'hinted', rung });
    }

    this.deps.screen.chip(step.success);
    this.stepIndex += 1;

    if (this.done) await this.finish();
    else await this.enterStep();
  }

  private reactToOffTarget(step: Step, event: ShellEvent): void {
    const { screen, chip, learner } = this.deps;

    // Anything that counts as an attempt at the step.
    const isAttempt =
      event.kind === 'command' ||
      event.kind === 'unknown-command' ||
      event.kind === 'unsupported-syntax';

    if (isAttempt) this.attempts += 1;

    // A specific reaction from the mission beats anything generic.
    const specific = step.nearMiss?.(event);
    if (specific) {
      screen.chip(specific);
      return;
    }

    switch (event.kind) {
      case 'error': {
        // The dispatcher already printed the real message. CHIP's job is to
        // make it a question, not to translate it away.
        const line = chip.say('real-error');
        if (line) screen.chip(line);
        for (const id of step.concepts) learner.record(id, { kind: 'failed' });
        break;
      }

      case 'unknown-command': {
        // The dispatcher already said something specific about this one.
        if (event.explained) break;

        const line = event.nearest ? chip.say('near-miss-command') : chip.say('unknown-command');
        if (line) {
          screen.chip(event.nearest ? [line, `Did you mean ${event.nearest}?`] : [line]);
        }
        break;
      }

      case 'unsupported-syntax': {
        const line = chip.say('unsupported-syntax');
        if (line) screen.chip(line);
        break;
      }

      case 'cwd-blocked': {
        const line = chip.say('edge-of-world');
        if (line) screen.chip(line);
        break;
      }

      default: {
        // Off-plan but harmless: follow the curiosity rather than steering
        // back. The step is still open and will complete whenever they get
        // to it.
        const reaction = reactToCuriosity(event, chip);
        if (reaction) screen.chip(reaction);
      }
    }

    // Offer a clue, do not impose one.
    if (this.ladder.shouldOffer(this.attempts)) {
      this.ladder.markOffered();
      screen.chip('Want a clue? Type hint.');
    }
  }

  /** The child asked for a hint. */
  giveHint(): void {
    const step = this.current;
    if (!step) return;

    const { screen } = this.deps;

    if (this.ladder.exhausted) {
      screen.chip('That is all the clues I have for this one.');
      screen.command(step.hints.reveal.command);
      return;
    }

    const shown = this.ladder.next();
    this.hintsUsed += 1;
    screen.chip(shown.lines);
    if (shown.command) screen.command(shown.command);
  }

  private async finish(): Promise<void> {
    const { screen, ask } = this.deps;

    screen.celebrate(this.mission.celebration.title, this.mission.celebration.detail);

    // The recap is asked, not told, and it is two lines at most.
    const answer = await ask(this.mission.recap.question);
    const matched = this.mission.recap.accept.some((a) =>
      answer.toLowerCase().includes(a.toLowerCase()),
    );
    if (matched) {
      screen.chip('Yes! That is exactly it.');
    } else {
      screen.chip(this.mission.recap.answer);
    }
  }

  outcome(): MissionOutcome {
    return {
      completed: this.done,
      hintsUsed: this.hintsUsed,
      predictionsMade: this.predictionsMade,
      chipCorrected: this.chipCorrected,
      notes: this.notes,
    };
  }
}
