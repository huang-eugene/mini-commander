/**
 * Following the child instead of the lesson plan.
 *
 * The brief: "If the child discovers something unexpectedly, temporarily
 * follow their curiosity rather than forcing the planned lesson. Curiosity
 * should take priority over curriculum pacing when safe."
 *
 * This is how that becomes code. When an event does not advance the current
 * step, we look for something specific and true to say about what the child
 * actually did. If there is nothing specific to say, we say nothing — a
 * generic "keep going!" is worse than silence.
 */

import type { ShellEvent } from './events.js';
import type { Chip } from '../chip/persona.js';
import { basename, depth } from '../shell/vpath.js';

/** Things the child has done that are worth noticing, mid-mission. */
export function reactToCuriosity(event: ShellEvent, chip: Chip): string[] | undefined {
  switch (event.kind) {
    case 'dir-created': {
      const name = basename(event.path);
      // Deep nesting is a real discovery: the child has worked out that
      // rooms go inside rooms without being told.
      if (depth(event.path) >= 4) {
        return [`A room inside a room inside a room. You worked that out yourself.`];
      }
      return [`${name} exists now. You built that.`];
    }

    case 'file-created':
      return [`${basename(event.path)} is there now. Empty, but there.`];

    case 'file-written':
      return event.appended
        ? [`Added to ${basename(event.path)}. It is getting longer.`]
        : [`${basename(event.path)} has your words in it now.`];

    case 'file-read': {
      const line = chip.say('read-something');
      return line ? [line] : undefined;
    }

    case 'listed': {
      if (event.entries.length === 0) {
        const line = chip.say('nothing-here');
        return line ? [line] : undefined;
      }
      if (event.showedHidden) {
        return ['Hidden things. I always forget those are there.'];
      }
      return undefined; // looking around is normal; no need to comment
    }

    case 'cwd-changed':
      return undefined; // moving about is normal

    case 'said':
      return undefined; // echo is its own reward

    // Meta words are not attempts at the world, and reacting to them is
    // actively harmful: a cheerful "poking about? good!" tacked onto every
    // hint undercuts the hint the child just asked for, and after `map` or
    // `badges` it is simply noise.
    case 'chip-word':
    case 'free-text':
      return undefined;

    // The generic `command` event always trails a more specific one from the
    // same typed line (`dir-created`, `listed`, `said`...). Reacting to it
    // too means every interesting thing the child does gets a tailored line
    // AND a generic one stapled to it.
    case 'command':
      return undefined;

    case 'recycled':
      return ['In the recycling. Not gone — we can always get it back.'];

    case 'restored':
      return ['Back where it was. Nothing is ever really lost in here.'];

    case 'moved':
      return event.copy
        ? [`Two of them now. ${basename(event.to)} is a copy.`]
        : [`${basename(event.from)} lives in a new place now.`];

    default: {
      const line = chip.say('wandering');
      return line ? [line] : undefined;
    }
  }
}
