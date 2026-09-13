/**
 * The network commands.
 *
 * Output is modelled on the real tools but trimmed to what a 7-year-old can
 * read. Real `ping` prints `64 bytes from 10.0.0.9: icmp_seq=1 ttl=63
 * time=2.11 ms`, which contains four things they cannot use and one they
 * can. So we print the one, in the same shape.
 *
 * The metaphors are fixed and match the mission text exactly: an envelope is
 * a message with a from and a to on it, a sorting station passes envelopes
 * on, and an address is the number a computer answers to.
 */

import type { Command } from '../shell/commands.js';
import { needsAnArgument, noSuchThing, tooManyArguments } from '../shell/errors.js';
import { resolve } from '../shell/vpath.js';
import { NODES, SELF, brokenLink, findNode, route, tripTime, type NetNode } from './topology.js';

const ping: Command = {
  name: 'ping',
  blurb: 'knock on another computer and see if it answers',
  metaphor: 'checking whether another computer is there',
  unlockedAt: 8,
  async run(argv, ctx) {
    if (argv.length === 0) needsAnArgument('ping', 'the name of a computer');
    if (argv.length > 1) tooManyArguments('ping');

    const wanted = argv[0]!;
    const target = findNode(wanted);

    if (!target) {
      // Shaped like the real thing: an unknown name fails differently from an
      // unreachable one, and that difference is the whole of mission 18.
      ctx.screen.error(`ping: ${wanted}: Name or service not known`);
      ctx.bus.emit({ kind: 'net', op: 'ping', host: wanted, reachable: false });
      return;
    }

    const { hops, blockedAt } = route(SELF, target.id);

    if (hops.length === 0) {
      ctx.screen.output([
        `Knocking on ${target.name} (${target.address})...`,
        '  no answer',
        '  no answer',
        '  no answer',
        ...(blockedAt ? [`The message got as far as ${blockedAt.name} and stopped.`] : []),
      ]);
      ctx.bus.emit({ kind: 'net', op: 'ping', host: target.name, reachable: false });
      return;
    }

    // One call, not one per line: the renderer puts a blank line after each
    // block, so three calls would double-space the replies.
    ctx.screen.output([
      `Knocking on ${target.name} (${target.address})...`,
      ...[1, 2, 3].map((i) => `  answer from ${target.address}: ${tripTime(hops, i)} ms`),
    ]);
    ctx.bus.emit({ kind: 'net', op: 'ping', host: target.name, reachable: true });
  },
};

const nslookup: Command = {
  name: 'nslookup',
  blurb: 'find out a computer’s number from its name',
  metaphor: 'looking up a computer’s address from its name',
  unlockedAt: 8,
  async run(argv, ctx) {
    if (argv.length === 0) needsAnArgument('nslookup', 'the name of a computer');
    if (argv.length > 1) tooManyArguments('nslookup');

    const wanted = argv[0]!;
    const target = findNode(wanted);

    if (!target) {
      ctx.screen.error(`nslookup: can't find ${wanted}: No such name`);
      ctx.bus.emit({ kind: 'net', op: 'nslookup', host: wanted, reachable: false });
      return;
    }

    ctx.screen.output([`Name:    ${target.name}`, `Address: ${target.address}`]);
    ctx.bus.emit({ kind: 'net', op: 'nslookup', host: target.name, reachable: true });
  },
};

const traceroute: Command = {
  name: 'traceroute',
  blurb: 'follow a message and see every computer it passes through',
  metaphor: 'following the route a message takes',
  unlockedAt: 8,
  async run(argv, ctx) {
    if (argv.length === 0) needsAnArgument('traceroute', 'the name of a computer');
    if (argv.length > 1) tooManyArguments('traceroute');

    const wanted = argv[0]!;
    const target = findNode(wanted);

    if (!target) {
      ctx.screen.error(`traceroute: ${wanted}: Name or service not known`);
      ctx.bus.emit({ kind: 'net', op: 'traceroute', host: wanted, reachable: false });
      return;
    }

    const { hops, blockedAt } = route(SELF, target.id);

    const describe = (hop: NetNode, index: number): string => {
      const label = index === 0 ? 'you are here' : hop.kind === 'station' ? 'sorting station' : '';
      return `  ${index + 1}  ${hop.name}  (${hop.address})${label ? '  - ' + label : ''}`;
    };

    if (hops.length === 0) {
      // A real traceroute prints rows of asterisks here, which teaches a
      // child nothing except that computers are unfriendly. We say where it
      // stopped, because that is the fact worth having.
      //
      // The route that DID work is shown first, numbered the same way, so
      // "it got this far and no further" is something the child can see
      // rather than something they have to be told.
      const reached = blockedAt ? route(SELF, blockedAt.id).hops : [];

      ctx.screen.output([
        `Following a message to ${target.name}:`,
        ...reached.map(describe),
        `  ${reached.length + 1}  ...no further`,
        ...(blockedAt && brokenLink() ? [``, `It cannot get past ${blockedAt.name}.`] : []),
      ]);

      ctx.bus.emit({ kind: 'net', op: 'traceroute', host: target.name, reachable: false });
      return;
    }

    ctx.screen.output([`Following a message to ${target.name}:`, ...hops.map(describe)]);
    ctx.bus.emit({ kind: 'net', op: 'traceroute', host: target.name, reachable: true });
  },
};

/**
 * `send` is the physical-envelope mission made into a command. The child
 * writes a file with FROM, TO and MESSAGE in it, and sends it. A reply lands
 * in `inbox/`, which makes the round trip something they can go and read.
 */
const send: Command = {
  name: 'send',
  blurb: 'send an envelope to another computer',
  metaphor: 'posting a message to another computer',
  unlockedAt: 8,
  async run(argv, ctx) {
    if (argv.length === 0) needsAnArgument('send', 'the name of an envelope to send');
    if (argv.length > 1) tooManyArguments('send');

    const path = resolve(ctx.state.cwd, argv[0]!);
    if ((await ctx.world.kindOf(path, 'send')) !== 'thing') noSuchThing('send', argv[0]!);

    const text = await ctx.world.read(path, 'send');
    const to = /^\s*TO:\s*(.+)$/im.exec(text)?.[1]?.trim();
    const message = /^\s*MESSAGE:\s*(.+)$/im.exec(text)?.[1]?.trim();

    if (!to) {
      ctx.screen.error('send: this envelope has no TO: line, so nobody knows where it goes');
      ctx.bus.emit({ kind: 'net', op: 'send', host: '', reachable: false });
      return;
    }

    const target = findNode(to);
    if (!target) {
      ctx.screen.error(`send: ${to}: Name or service not known`);
      ctx.bus.emit({ kind: 'net', op: 'send', host: to, reachable: false });
      return;
    }

    const { hops, blockedAt } = route(SELF, target.id);

    if (hops.length === 0) {
      ctx.screen.output(
        `The envelope came back. It got as far as ${blockedAt?.name ?? 'nowhere'}.`,
      );
      ctx.bus.emit({ kind: 'net', op: 'send', host: target.name, reachable: false });
      return;
    }

    ctx.screen.output(hops.slice(1).map((hop, i) => `  ${hops[i]!.name} passes it to ${hop.name}`));

    const reply = [
      `FROM: ${target.name}`,
      `TO: ${SELF}`,
      `MESSAGE: ${replyFrom(target.name, message)}`,
      '',
    ].join('\n');

    const inbox = resolve(ctx.state.cwd, 'inbox');
    if ((await ctx.world.kindOf(inbox, 'send')) === 'nothing') {
      await ctx.world.makeRoom(inbox, 'send');
    }
    await ctx.world.write(resolve(inbox, 'reply.txt'), reply, 'replace', 'send');

    ctx.screen.output(`${target.name} wrote back. The reply is in inbox.`);
    ctx.bus.emit({ kind: 'net', op: 'send', host: target.name, reachable: true });
  },
};

function replyFrom(name: string, message: string | undefined): string {
  if (name === 'moon') return 'HELLO FROM THE MOON BASE. It is quiet up here.';
  if (name === 'gran') return `Gran says hello back${message ? ', and yes' : ''}!`;
  return 'Message received.';
}

export const NET_COMMANDS: readonly Command[] = [ping, nslookup, traceroute, send];

/** Every machine on the practice network, for the mission text. */
export const NET_NODES = NODES;
