# mini-commander

A terminal adventure for a 7-year-old. CHIP is a robot who lives in your
computer, and he needs help.

```
npx mini-commander
```

That is the whole setup. No install, no account, no configuration.

---

## What it is

Twenty short missions that take a child who has never used a computer from
"I can make it say hello" to "the Internet is machines passing messages
along". Each one is five to fifteen minutes, and ends while they still want
another.

They are not memorising commands. They are building a picture:

> I can tell a computer what to do → it has places and things inside → I can
> move around and change them → I can put instructions together → programs
> are instructions written down → computers send messages to each other.

Along the way they learn `echo`, `pwd`, `ls`, `cd`, `cat`, `mkdir`, `touch`,
`mv`, `ping`, `nslookup` and `traceroute` — real commands, which work in any
terminal on any computer, and which they will still be using in thirty
years.

## What a session looks like

```
[] CHIP
+------------------------------------------+
| Oh! Someone is there.                    |
| I am CHIP. I live in this computer.      |
| I have been shouting for ages and nobody |
| heard me.                                |
| Can you hear me?                         |
+------------------------------------------+

What we are doing: Get the computer to say something back.

[] CHIP
+-----------------------------------------+
| This is the control room. When you type |
| in here, the computer listens.          |
| Type this and press Enter:              |
| echo hello                              |
+-----------------------------------------+

What do you think will happen when you press Enter?

   1. It says hello back
   2. Nothing happens
   3. Something else

(1-3, or just press Enter) 1

control-room > echo hello
hello
```

## Is it safe?

Yes, and specifically:

- **Everything happens in one folder**, `~/.mini-commander`. Nothing outside
  it can be read, written or reached, and the game refuses to start if that
  folder turns out to be somewhere else or to contain files it did not make.
- **`sudo`, `chmod`, `kill` and real `rm -rf` are not implemented.** Not
  blocked — absent. There is no code path that could run them.
- **Nothing is ever deleted.** `rm` moves things to a recycling bin and
  `undo` brings them back.
- **The game opens no network connections at all.** The networking missions
  run on a pretend network inside the game. This is checked by a test, not
  just promised.
- **It spawns no other programs.** Also checked by a test.
- **No telemetry, no accounts, no analytics.** It does not phone anywhere,
  because it cannot.

Children are meant to break things here. That is what the folder is for.

## For the grown-up

```
npx mini-commander grown-ups     how to sit with your child
npx mini-commander journal       what happened in past sessions
npx mini-commander reset         start the world over (badges are kept)
```

Read the grown-ups guide before the first session. It is short, and the
three things in it are the difference between this working and not working.
The shortest version: **don't take the keyboard, don't correct their typos
before the computer does, and stop while they still want more.**

## Options

```
--theme high-contrast    bigger contrast, no greys
--theme mono             no colour at all
--no-color               same, via the standard NO_COLOR convention
--ascii                  plain characters, for older Windows consoles
--self-check             play a scripted mission and exit (for CI)
```

The single most useful thing you can do is **make the terminal font much
bigger** before you start. Bigger than you think.

## Requirements

Node 20 or newer. Works on macOS Terminal, Linux, and Windows PowerShell —
the game implements its own commands, so a child on Windows and a child on a
Mac learn exactly the same words.

## Where things are kept

```
~/.mini-commander/
  chip-world/     the world. Real folders and real files.
  save.json       progress, badges, and which ideas are sticking
  journal.md      a few plain lines for you after each session
```

Set `MINI_COMMANDER_HOME` to put it somewhere else.

The world persists. A room built in week one is still there in week six,
which matters to them more than you would expect.

## Development

```
npm install
npm test          # unit, transcript and mission-lint suites
npm run build
node bin/mini-commander.js --self-check
```

Three test layers, each catching something different:

- **Unit tests**, including ~50 hostile paths thrown at the sandbox.
- **Mission lint**, which holds every mission to the same pedagogical
  standard — five hint rungs, at most two new ideas, three levels of
  scaffolding, a prediction, a short recap. It also _runs each step's
  solution_ and asserts the step then completes, which is an executable
  proof that every mission is finishable and no hint lies.
- **Golden transcripts**, which record what a child actually sees. Re-record
  with `npm run test:update`, then **read the diff** — a transcript that
  looks worse is a failing test even when the suite is green. Most of the
  real problems in this project were found that way and not by assertions.

## Licence

MIT.
