/**
 * Shared bits for writing missions.
 *
 * Missions are hand-written prose, and they should stay that way — a child
 * can tell the difference between a room someone wrote and a room a template
 * generated. But the *matchers* are mechanical, so they live here.
 */

import type { ShellEvent } from '../engine/events.js';
import type { StepContext } from './types.js';
import type { World } from '../shell/fs-jail.js';
import { ROOT, basename, resolve, type VPath } from '../shell/vpath.js';

/** Completed when the child runs this command successfully, whatever the args. */
export function ranCommand(name: string) {
  return (event: ShellEvent): boolean =>
    event.kind === 'command' && event.name === name && event.ok;
}

/** Completed when the child makes the computer say something. */
export function saidAnything() {
  return (event: ShellEvent): boolean => event.kind === 'said' && event.text.trim().length > 0;
}

/** Completed when they walk into this room (by name, anywhere). */
export function enteredRoom(name: string) {
  return (event: ShellEvent): boolean =>
    event.kind === 'cwd-changed' && basename(event.to) === name;
}

/** Completed when they go up a level. */
export function wentUp() {
  return (event: ShellEvent): boolean =>
    event.kind === 'cwd-changed' && event.to.length < event.from.length;
}

/** Completed when they read this file. */
export function readFile(name: string) {
  return (event: ShellEvent): boolean =>
    event.kind === 'file-read' && basename(event.path) === name;
}

/** Completed when they read anything whose contents contain this text. */
export function readSomethingSaying(text: string) {
  return (event: ShellEvent): boolean =>
    event.kind === 'file-read' && event.text.toLowerCase().includes(text.toLowerCase());
}

/** Completed when they list a room and it had at least one thing in it. */
export function lookedAround() {
  return (event: ShellEvent): boolean => event.kind === 'listed';
}

/** Completed when they reveal hidden things. */
export function lookedForHidden() {
  return (event: ShellEvent): boolean => event.kind === 'listed' && event.showedHidden;
}

/** Completed when any new room is built. */
export function builtAnyRoom() {
  return (event: ShellEvent): boolean => event.kind === 'dir-created';
}

/** Completed when any new empty thing is made. */
export function madeAnyThing() {
  return (event: ShellEvent): boolean => event.kind === 'file-created';
}

/** Completed when they write into a file (with `>`), not append. */
export function wroteInto(name?: string) {
  return (event: ShellEvent): boolean =>
    event.kind === 'file-written' &&
    !event.appended &&
    (name === undefined || basename(event.path) === name);
}

/** Completed when they add to a file (with `>>`). */
export function appendedTo(name?: string) {
  return (event: ShellEvent): boolean =>
    event.kind === 'file-written' &&
    event.appended &&
    (name === undefined || basename(event.path) === name);
}

/** Completed when a room exists in the world, however they got there. */
export function roomExists(path: string) {
  return async (_event: ShellEvent, ctx: StepContext): Promise<boolean> =>
    (await ctx.world.kindOf(resolve(ROOT, path), 'ls')) === 'room';
}

/** Completed when a file exists and says something. */
export function fileSays(path: string, text: string) {
  return async (_event: ShellEvent, ctx: StepContext): Promise<boolean> => {
    const target = resolve(ROOT, path);
    if ((await ctx.world.kindOf(target, 'cat')) !== 'thing') return false;
    const body = await ctx.world.read(target, 'cat');
    return body.toLowerCase().includes(text.toLowerCase());
  };
}

/** Either of two conditions. Useful when a child can solve a step two ways. */
export function either(
  a: (e: ShellEvent, c: StepContext) => boolean | Promise<boolean>,
  b: (e: ShellEvent, c: StepContext) => boolean | Promise<boolean>,
) {
  return async (event: ShellEvent, ctx: StepContext): Promise<boolean> =>
    (await a(event, ctx)) || (await b(event, ctx));
}

/* ---- world building ------------------------------------------------- */

/**
 * Makes a room if it is not already there. Every mission's setup must be
 * safe to run again: the world persists, and a grown-up may have tidied it
 * or the child may have renamed something. Setup reconciles; it never
 * assumes, and it never destroys what the child made.
 */
export async function ensureRoom(world: World, path: string): Promise<VPath> {
  const target = resolve(ROOT, path);
  if ((await world.kindOf(target, 'mkdir')) !== 'room') {
    // Build any missing parents first.
    const parts = path.split('/').filter(Boolean);
    let walk = ROOT;
    for (const part of parts) {
      walk = resolve(walk, part);
      if ((await world.kindOf(walk, 'mkdir')) === 'nothing') {
        await world.makeRoom(walk, 'mkdir');
      }
    }
  }
  return target;
}

/**
 * Writes a file only if it is absent. Never overwrites: if the child has
 * scribbled in CHIP's note, that is theirs now and the mission works around
 * it rather than silently restoring the original.
 */
export async function ensureFile(world: World, path: string, body: string): Promise<VPath> {
  const target = resolve(ROOT, path);
  const parent = path.split('/').slice(0, -1).join('/');
  if (parent) await ensureRoom(world, parent);

  if ((await world.kindOf(target, 'cat')) === 'nothing') {
    await world.write(target, body.endsWith('\n') ? body : body + '\n', 'replace', 'echo');
  }
  return target;
}
