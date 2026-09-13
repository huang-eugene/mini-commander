/**
 * The practice network.
 *
 * Entirely made up, and that is the point. Three reasons it is simulated
 * rather than real:
 *
 * 1. It is authorable. Stage 8 needs to be an escape room — a link is down,
 *    and the child diagnoses it by noticing that the name still resolves but
 *    nothing answers, then follows the route and sees exactly which hop the
 *    message dies at. You cannot author that against the real Internet. You
 *    can author it perfectly against a graph you own.
 *
 * 2. It works. The container this was built in has no ping, no nslookup and
 *    no traceroute binary at all, and many school and home networks block
 *    ICMP outright. A kitchen-table session is usually offline anyway.
 *
 * 3. Real output is unreadable. `traceroute` to anywhere prints a wall of
 *    asterisks for hops that do not answer, which actively contradicts the
 *    lesson that the Internet is machines passing messages along.
 *
 * The game opens no sockets at all. Wanting to see the real thing is what
 * graduation mission g03 is for, with a grown-up.
 */

export interface NetNode {
  id: string;
  /** What the child sees. Short, because they have to type it. */
  name: string;
  /** Made-up but shaped like the real thing. */
  address: string;
  kind: 'computer' | 'station' | 'server';
  /** One line, in the child's terms. */
  what: string;
}

export interface NetLink {
  a: string;
  b: string;
  /** Milliseconds, before jitter. */
  ms: number;
  up: boolean;
  /** Narratable, so a break is a story rather than an error code. */
  brokenBecause?: string;
}

/**
 * Names are all six characters or fewer where possible, because the child
 * has to type them and typing is the bottleneck at this age.
 */
export const NODES: readonly NetNode[] = [
  {
    id: 'home',
    name: 'home',
    address: '10.0.0.1',
    kind: 'computer',
    what: 'This computer. The one you are sitting at.',
  },
  {
    id: 'sorter',
    name: 'sorter',
    address: '10.0.0.9',
    kind: 'station',
    what: 'A sorting station. It passes messages on towards the right place.',
  },
  {
    id: 'big-sorter',
    name: 'big-sorter',
    address: '10.4.0.1',
    kind: 'station',
    what: 'A much bigger sorting station, further away.',
  },
  {
    id: 'gran',
    name: 'gran',
    address: '10.4.0.7',
    kind: 'computer',
    what: "Gran's computer. It has photographs on it.",
  },
  {
    id: 'moon',
    name: 'moon',
    address: '10.9.9.9',
    kind: 'server',
    what: 'The Moon Base. It waits for messages and answers them.',
  },
  {
    id: 'attic',
    name: 'attic',
    address: '10.0.0.4',
    kind: 'computer',
    what: 'An old computer in the attic. Nobody has used it for years.',
  },
];

export const LINKS: readonly NetLink[] = [
  { a: 'home', b: 'sorter', ms: 2, up: true },
  { a: 'sorter', b: 'big-sorter', ms: 14, up: true },
  { a: 'big-sorter', b: 'gran', ms: 9, up: true },
  { a: 'big-sorter', b: 'moon', ms: 240, up: true },
  // Deliberately down. A productive failure the child can diagnose, and one
  // with a cause they can picture rather than an error number.
  {
    a: 'sorter',
    b: 'attic',
    ms: 3,
    up: false,
    brokenBecause: 'the cable to the attic came loose',
  },
];

export const SELF = 'home';

const BY_NAME = new Map(NODES.map((n) => [n.name, n]));
const BY_ADDRESS = new Map(NODES.map((n) => [n.address, n]));

export function findNode(nameOrAddress: string): NetNode | undefined {
  const key = nameOrAddress.trim().toLowerCase();
  return BY_NAME.get(key) ?? BY_ADDRESS.get(key);
}

export function allNames(): string[] {
  return NODES.map((n) => n.name);
}

/**
 * Shortest path from `from` to `to` over links that are up. Breadth-first,
 * because the graph is tiny and a child should be able to see why the route
 * is the route.
 *
 * Returns the hops including both ends, or undefined when there is no way
 * through. When it fails, `blockedAt` names the last node the message
 * actually reached — which is what makes the failure diagnosable rather than
 * just a "no".
 */
export function route(from: string, to: string): { hops: NetNode[]; blockedAt?: NetNode } {
  const start = findNode(from);
  const target = findNode(to);
  if (!start || !target) return { hops: [] };
  if (start.id === target.id) return { hops: [start] };

  const previous = new Map<string, string>();
  const seen = new Set<string>([start.id]);
  const queue: string[] = [start.id];

  while (queue.length > 0) {
    const here = queue.shift()!;
    if (here === target.id) break;

    for (const link of LINKS) {
      if (!link.up) continue;
      const next = link.a === here ? link.b : link.b === here ? link.a : undefined;
      if (!next || seen.has(next)) continue;
      seen.add(next);
      previous.set(next, here);
      queue.push(next);
    }
  }

  if (!seen.has(target.id)) {
    // Work out how far a message actually gets: the reachable node that sits
    // next to a broken link leading towards the target.
    const stuckAt = LINKS.filter((l) => !l.up).flatMap((l) =>
      [l.a, l.b].filter((id) => seen.has(id)),
    )[0];

    const blocked = stuckAt ? NODES.find((n) => n.id === stuckAt) : undefined;
    return blocked ? { hops: [], blockedAt: blocked } : { hops: [] };
  }

  const path: NetNode[] = [];
  let cursor: string | undefined = target.id;
  while (cursor) {
    const node = NODES.find((n) => n.id === cursor);
    if (node) path.unshift(node);
    cursor = previous.get(cursor);
  }

  return { hops: path };
}

/** Total time along a route, with a small deterministic wobble. */
export function tripTime(hops: readonly NetNode[], seed: number): number {
  let total = 0;
  for (let i = 1; i < hops.length; i += 1) {
    const link = LINKS.find(
      (l) =>
        (l.a === hops[i - 1]!.id && l.b === hops[i]!.id) ||
        (l.b === hops[i - 1]!.id && l.a === hops[i]!.id),
    );
    total += link?.ms ?? 1;
  }
  // A fixed wobble per seed, so output looks alive but tests stay stable.
  const wobble = ((seed * 37) % 7) - 3;
  return Math.max(1, total + wobble);
}

/** The broken link, for the mission that repairs it. */
export function brokenLink(): NetLink | undefined {
  return LINKS.find((l) => !l.up);
}
