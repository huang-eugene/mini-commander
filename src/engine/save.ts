/**
 * Progress on disk.
 *
 * The save lives OUTSIDE the world directory, deliberately. Two reasons:
 * the child must not be able to `rm` their own badges, and the world is the
 * one place they are encouraged to break things.
 *
 * Writes are atomic (temp file, then rename) and the previous save is kept
 * as a .bak. A corrupt save is never deleted — it is renamed aside and a
 * fresh one started, because losing a 7-year-old's badges is the one bug
 * this project cannot recover from socially, whatever the code does.
 */

import { promises as fs } from 'node:fs';
import * as nodePath from 'node:path';
import { decay, freshConceptState, type ConceptBook } from './learner.js';
import type { BadgeId } from '../missions/types.js';

export const SAVE_VERSION = 1;

export interface MissionRecord {
  plays: number;
  completed: boolean;
  lastSessionIndex: number;
  hintsUsed: number;
}

export interface SessionRecord {
  startedAt: string;
  endedAt: string;
  missions: string[];
  /** Plain-English notes for the grown-up's journal. */
  notes: string[];
}

export interface SaveFile {
  version: number;
  createdAt: string;
  updatedAt: string;
  explorerName?: string;
  /** Counts play sessions. Drives the spacing schedule. */
  sessionIndex: number;
  /** Highest stage reached; gates the command vocabulary. */
  stage: number;
  concepts: ConceptBook;
  missions: Record<string, MissionRecord>;
  badges: { id: BadgeId; earnedAt: string; missionId: string }[];
  cosmetics: string[];
  artifacts: string[];
  roomsVisited: string[];
  predictionsMade: number;
  chipCorrections: number;
  sessions: SessionRecord[];
  prefs: {
    theme: 'default' | 'high-contrast' | 'mono';
    ascii: boolean;
    slowMs: number;
    speak: boolean;
  };
  /** Shown once, on the very first run. */
  seenWelcome: boolean;
  seenCaseTip: boolean;
}

export function freshSave(now = new Date()): SaveFile {
  const iso = now.toISOString();
  return {
    version: SAVE_VERSION,
    createdAt: iso,
    updatedAt: iso,
    sessionIndex: 0,
    stage: 1,
    concepts: {},
    missions: {},
    badges: [],
    cosmetics: [],
    artifacts: [],
    roomsVisited: [],
    predictionsMade: 0,
    chipCorrections: 0,
    sessions: [],
    prefs: { theme: 'default', ascii: false, slowMs: 0, speak: false },
    seenWelcome: false,
    seenCaseTip: false,
  };
}

function savePath(home: string): string {
  return nodePath.join(home, 'save.json');
}

/**
 * Reads the save, applying forgetting to every concept as it loads. That is
 * the only place decay happens, so a child who comes back after three weeks
 * gets more help without anything else in the system needing to know why.
 */
export async function loadSave(home: string, now = new Date()): Promise<SaveFile> {
  const file = savePath(home);

  const parse = async (path: string): Promise<SaveFile | undefined> => {
    try {
      const raw = await fs.readFile(path, 'utf8');
      const parsed = JSON.parse(raw) as SaveFile;
      if (typeof parsed !== 'object' || parsed === null) return undefined;
      return migrate(parsed);
    } catch {
      return undefined;
    }
  };

  let save = await parse(file);

  if (!save) {
    // Try the backup before giving up on the child's progress.
    save = await parse(file + '.bak');
    if (save) {
      await fs.rename(file, file + '.broken-' + Date.now()).catch(() => undefined);
    }
  }

  if (!save) {
    // Never delete a save we could not read. Move it aside so a grown-up can
    // look, and start clean.
    const exists = await fs
      .access(file)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      await fs.rename(file, file + '.broken-' + Date.now()).catch(() => undefined);
    }
    return freshSave(now);
  }

  for (const id of Object.keys(save.concepts)) {
    save.concepts[id] = decay(save.concepts[id] ?? freshConceptState(), now);
  }

  return save;
}

function migrate(save: SaveFile): SaveFile {
  // Only one version so far. Future migrations chain here, and every old
  // shape gets a fixture in the tests so upgrades never silently drop data.
  if (save.version === SAVE_VERSION) return { ...freshSave(), ...save };
  return { ...freshSave(), ...save, version: SAVE_VERSION };
}

export async function writeSave(home: string, save: SaveFile, now = new Date()): Promise<void> {
  const file = savePath(home);
  const temp = file + '.tmp';

  save.updatedAt = now.toISOString();
  const text = JSON.stringify(save, null, 2);

  await fs.mkdir(home, { recursive: true });
  await fs.writeFile(temp, text, 'utf8');

  // Keep the last good copy before replacing it.
  await fs.copyFile(file, file + '.bak').catch(() => undefined);
  await fs.rename(temp, file);
}

/**
 * The grown-up's journal: a few plain lines per session, appended. Not a
 * report card — it exists so the adult knows what to reinforce next time and
 * what the child enjoyed.
 */
export async function appendJournal(home: string, record: SessionRecord): Promise<void> {
  const file = nodePath.join(home, 'journal.md');
  const date = new Date(record.startedAt).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const body = [`## ${date}`, '', ...record.notes.map((n) => `- ${n}`), '', ''].join('\n');

  await fs.mkdir(home, { recursive: true });
  await fs.appendFile(file, body, 'utf8');
}
