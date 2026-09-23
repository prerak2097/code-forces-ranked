# Codeforces Ranked

**Solo ranked practice for Codeforces.** It draws a problem near your level, hides the
tags until you ask for them, times you against an interview-length budget, and moves a
rating you have to *earn* rather than luck into.

Runs entirely on your machine — Next.js plus a Postgres container. No account, no
hosted service, no data leaves your laptop except read-only calls to the public
Codeforces API.

> **Why this exists.** Picking your own practice problems is a bad feedback loop: you
> drift toward what you're already good at, you peek at tags for free, and you have no
> honest signal about whether you're improving. This puts a rating on it that only
> moves when your results actually justify it.

---

## Practice Mode
<img width="1539" height="1049" alt="Screenshot-20260923-12:25:38" src="https://github.com/user-attachments/assets/e52aff4b-2d6f-43c2-8595-21280248cf1b" />

## Contents

- [Features](#features)
- [Quickstart](#quickstart)
- [Using it](#using-it)
- [How the rating works](#how-the-rating-works)
- [Problem selection](#problem-selection)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Project layout](#project-layout)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Rated problem draws** from the live Codeforces problemset, within ±200 of your
  rating (configurable), never serving something you've already solved.
- **An Elo rating that resists inflation.** A couple of lucky solves above your level
  barely move it; a sustained run moves it properly. [Details below](#how-the-rating-works).
- **Tags stay hidden** behind a button — and revealing them costs you rating, so it's
  a real decision instead of a free lookup.
- **A per-problem workspace**: markdown notes with live preview, a code pane, and an
  Excalidraw link for sketching out graphs and DP tables. All autosaved, all readable
  later.
- **A fully configurable Pomodoro timer** that doubles as your time budget — default
  40/5/15, because that's what a technical interview feels like.
- **Analytics that name your weak spots**: solve rate per tag, per difficulty band,
  your rating curve, and the split between clean solves, tag-assisted, and over-budget.
- **Light and dark**, keyboard-reachable, with a table view behind every chart.

Built with Next.js 16, React 19, [shadcn/ui](https://ui.shadcn.com), Tailwind v4,
Drizzle ORM, Postgres 17, and Recharts.

---

## Quickstart

**Prerequisites:** [Node 20+](https://nodejs.org) and
[Docker](https://docs.docker.com/get-docker/). You do *not* need Postgres installed —
the container provides it.

```bash
git clone https://github.com/<your-username>/codeforces-ranked.git
cd codeforces-ranked
npm install
npm run setup
```

Open **http://localhost:3000**.

### `npm run setup` is the only command you need

Run it every time — first install and every session after. It:

1. creates `.env.local` if missing,
2. starts the Postgres container and waits for it to report healthy,
3. applies the schema (a clean no-op when nothing changed),
4. refreshes the problemset and re-syncs your solves, so new contests show up,
5. starts the app.

It takes a couple of seconds and is **completely non-destructive** — your attempts,
notes, and rating are never touched. If Codeforces is unreachable, the sync is skipped
with a warning and the app still starts.

`npm run up` is an alias for the same thing. If you want *only* the app, with no
database or sync step, use `npm run dev`.

### Link your Codeforces account

Open **Settings** and:

1. Enter your Codeforces handle.
2. Hit **Sync my submissions** — this excludes everything you've already solved, so
   you never get served a problem you've seen.
3. Optionally hit **Seed rating from Codeforces** to start from your real rating
   instead of 800. This is only available before your first graded attempt.

You don't need to press **Save settings** first — the sync buttons persist the handle
themselves.

Both steps also work from the terminal:

```bash
npm run sync -- <your-handle>
```

You only need to pass the handle once. After that `npm run setup` reuses the saved one
automatically, so your solved list stays current without you doing anything.

#### Confirming it worked

The Codeforces card shows what's *stored*, not what's typed in the box:

| Row | Healthy state |
|---|---|
| Handle on file | your handle, in green — `not saved yet` means it didn't persist |
| Solved on Codeforces | `N excluded`, not `not synced` |
| Submissions synced | a timestamp, not `never` |
| Available in your window | **drops** after a sync, since your solves are removed |

---

## Using it

**Practice** (`/`) is the main screen.

1. **Draw a problem.** You get the name, rating, how many people have solved it, and a
   link to Codeforces. Tags are hidden.
2. **Start the timer** and work the problem wherever you normally do. Only focus
   phases count toward your budget — breaks don't.
3. **Take notes as you go.** The Notes tab has a template for the
   restate → observations → approach → complexity structure that makes problems stick.
   Paste your accepted solution into the Solution tab and any sketch into Sketch.
4. **Grade yourself honestly.** Four buttons, each showing the rating change it would
   produce *before* you commit:

   | Outcome | Credit |
   |---|---|
   | Solved clean | 1.0 |
   | Solved, over the time budget | 0.7 |
   | Solved, revealed the tags | 0.5 |
   | Did not solve | 0.0 |

   Revealing tags or blowing the budget **disables the clean-solve button** — the app
   grades you down automatically rather than trusting your memory. **Skip** drops a
   problem without scoring it.

**Analytics** (`/analytics`) fills in as you go: your rating curve, weakest and
strongest tags, solve rate against your target, attempt volume per difficulty band,
and how your solves break down. Every chart has a table view behind the toggle in its
header.

**History** (`/history`) lists every graded attempt with its rating change — click the
document icon on any row to read back the notes, code, and sketch you saved.

---

## How the rating works

The core is Elo on the standard 400-point scale. Your expected score against a problem
is `1 / (1 + 10^((problemRating - yourRating) / 400))`, and you move by
`K × (actual - expected)`.

Two additions make it behave like practice rather than a slot machine.

### 1. Graded outcomes, not solved/unsolved

Partial credit (the table above) means a tag-assisted solve is worth half a win. This
is what gives "Show tags" a price.

### 2. The promotion factor

Upward moves are multiplied by a factor in `[0.25, 1.0]`, derived from your mean score
over the last 10 attempts **at or near your level**, normalised against your target
solve rate (60% by default). Downward moves are never throttled — you can always fall.

The result:

| Scenario | Outcome |
|---|---|
| Stuck at 800, solve three 900s | 800 → **832** (+9, +11, +12) |
| 20 straight solves at 900–1000 | 800 → **1028** |
| Realistic 60% at level, 30 attempts | 800 → **891** |
| Farming 800s while rated 1200 | 1200 → **1215** (+1 each) |
| Failing at level, 10 times | 1000 → **868** |

Solving a handful of problems just above your level gets you almost nothing. Doing it
*consistently* opens the throttle to full width.

Your **first 10 attempts are calibration**: `K` is 48 instead of 24 and the throttle is
off, so a genuine 1400 starting cold converges in about a dozen problems instead of a
hundred. Be honest during those.

Rating is floored at 800 and capped at 3500.

The engine lives in [`src/lib/rating.ts`](src/lib/rating.ts) — pure functions, no I/O,
so you can simulate changes to the curve before committing to them.

---

## Problem selection

Problems are drawn from `[rating - window, rating + window]`, excluding:

- anything solved on Codeforces under your synced handle,
- anything already solved here,
- anything failed here inside the re-try cooldown (14 days by default).

Three modes, in Settings:

| Mode | Behaviour |
|---|---|
| **Balanced** | Uniform across the window. |
| **Weakness** | Weights each problem by how badly you score on its tags, so your worst areas come up more. Unseen tags sit at neutral, so it still explores. |
| **Ascending** | Weights the upper half of the window, for deliberately pushing difficulty. |

---

## Configuration

Everything is in **Settings** — nothing requires editing code.

| Setting | Default | What it does |
|---|---|---|
| Rating window | ±200 | How far from your rating problems are drawn |
| Selection mode | Balanced | See above |
| Re-try cooldown | 14 days | How long a failed problem stays out of the pool |
| Target solve rate | 60% | The rate the engine treats as "holding your level" |
| Focus / breaks / rounds | 40 / 5 / 15 / 4 | Pomodoro, with presets for classic, deep work, and contest sprint |
| Auto-start, chime | off / on | Timer behaviour |

**Reset progress** (at the bottom of Settings) deletes every attempt and note and
restarts calibration at a rating you choose. Your cached problemset and Codeforces
sync are kept.

### Scripts

| Command | What it does |
|---|---|
| `npm run setup` | **The one you want** — env, database, schema, sync, app |
| `npm run up` | Alias for `setup` |
| `npm run dev` | App only — no database, no sync |
| `npm run build` / `npm start` | Production build and serve |
| `npm run db:up` / `db:down` | Start / stop the Postgres container |
| `npm run db:push` | Apply `src/db/schema.ts` to the database |
| `npm run db:studio` | Drizzle Studio, to inspect the data |
| `npm run sync [handle]` | Refresh the problemset and re-sync your solves (reuses the saved handle) |
| `npm run env` | Create `.env.local` from `.env.example` (runs automatically) |
| `npm run lint` | ESLint |

### Environment

`.env.local` is created for you on first `npm run setup` / `npm run up`, copied from
the committed `.env.example`. It holds one variable:

```
DATABASE_URL="postgresql://cfranked:cfranked@localhost:5433/cfranked"
```

Port **5433** is deliberate — it won't collide with a Postgres you install natively
later. To point at an existing Postgres instead of Docker, edit this value and skip
`db:up`.

Data lives in a named Docker volume (`cf-ranked-pgdata`), so `db:down` keeps your
history. `docker compose down -v` destroys it.

---

## Troubleshooting

**`npm run up` says port 3000 is in use.** Something else is on it — Next will fall
back to 3001 and tell you, or stop the other process first.

**"No unsolved problems left between X and Y."** You've exhausted the band. Widen the
rating window or lower the re-try cooldown in Settings.

**"Enter your Codeforces handle first."** The handle hasn't reached the database yet —
type it into Settings and use a sync button, which persists it.

**Sync fails or the app can't reach Codeforces.** The API is occasionally down or rate
limited. Wait a minute and retry; nothing is lost.

**Database connection errors.** Check the container is healthy:

```bash
docker compose ps
```

If it isn't, `npm run db:up` and try again. To inspect the data directly:

```bash
docker exec -it cf-ranked-db psql -U cfranked -d cfranked
```

**Starting completely over.** `docker compose down -v && npm run setup`.

---

## Project layout

```
src/
  app/            practice (/), analytics, history, settings
  components/
    app/          problem card, workspace, pomodoro, outcome panel, settings form
    charts/       Recharts components + shared chart chrome
    ui/           shadcn/ui primitives
  db/             Drizzle schema + client
  lib/
    rating.ts     the Elo engine — pure, no I/O, easy to simulate
    actions.ts    server actions (draw, grade, sync, save notes)
    queries.ts    reads + analytics aggregation
    codeforces.ts Codeforces API client (server-only)
scripts/sync.mts  CLI problemset + submission sync
```

There's no separate backend service. Next.js server components and server actions
*are* the backend — the request path is browser → Next.js → Drizzle → Postgres.

---

## Contributing

Issues and pull requests are welcome. Before opening a PR:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

If you're changing the rating curve, `src/lib/rating.ts` has no dependencies — write a
small script that imports `applyOutcome` and prints the scenarios in the table above,
so the behavioural change is visible in the PR description.

---

## Screen Shots
<img width="1544" height="547" alt="Screenshot-20260923-12:24:56" src="https://github.com/user-attachments/assets/ae299070-b726-4015-bef4-54a152cca67e" />
<img width="786" height="1262" alt="Screenshot-20260923-12:24:13" src="https://github.com/user-attachments/assets/4e0b6785-8d47-4388-ace7-0ed322a6bcb7" />
<img width="2545" height="1268" alt="Screenshot-20260923-12:23:25" src="https://github.com/user-attachments/assets/84e087c4-cec1-4963-94f6-0bd597385cad" />

## License

MIT — see [LICENSE](LICENSE).

Codeforces problem data is fetched from the public
[Codeforces API](https://codeforces.com/apiHelp) and belongs to Codeforces and the
respective problem setters. This project is not affiliated with Codeforces.
