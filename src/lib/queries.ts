import "server-only";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { attempts, notes, problems, settings } from "@/db/schema";
import { FORM_WINDOW, OUTCOME_SCORE, type FormEntry, type Outcome } from "./rating";

/**
 * Reads the singleton settings row, creating it on first run.
 * Insert-then-reselect so concurrent server components can't race each other
 * into a duplicate-key error on a cold database.
 */
export async function getSettings() {
  const existing = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(settings)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return row;
}

export async function getActiveAttempt() {
  const rows = await db
    .select({ attempt: attempts, problem: problems, note: notes })
    .from(attempts)
    .innerJoin(problems, eq(attempts.problemId, problems.id))
    .leftJoin(notes, eq(notes.attemptId, attempts.id))
    .where(eq(attempts.status, "active"))
    .orderBy(desc(attempts.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Most recent completed attempts, newest first — feeds the promotion factor. */
export async function getRecentForm(limit = FORM_WINDOW * 3): Promise<FormEntry[]> {
  const rows = await db
    .select({ problemRating: attempts.problemRating, outcome: attempts.outcome })
    .from(attempts)
    .where(and(eq(attempts.status, "completed"), isNotNull(attempts.outcome)))
    .orderBy(desc(attempts.completedAt))
    .limit(limit);
  return rows.map((r) => ({
    problemRating: r.problemRating,
    outcome: r.outcome as Outcome,
  }));
}

export async function getHistory(limit = 100) {
  return db
    .select({ attempt: attempts, problem: problems })
    .from(attempts)
    .innerJoin(problems, eq(attempts.problemId, problems.id))
    .where(eq(attempts.status, "completed"))
    .orderBy(desc(attempts.completedAt))
    .limit(limit);
}

export interface TagStat {
  tag: string;
  attempts: number;
  solved: number;
  score: number;
  solveRate: number;
  avgDurationSec: number | null;
  avgRating: number;
}

export interface BandStat {
  band: number;
  attempts: number;
  solved: number;
  solveRate: number;
}

export interface RatingPoint {
  index: number;
  date: string;
  rating: number;
  problemRating: number;
  delta: number;
  outcome: Outcome;
  problemName: string;
}

export interface Analytics {
  total: number;
  solved: number;
  solveRate: number;
  cleanSolves: number;
  tagAssistedSolves: number;
  overTimeSolves: number;
  medianDurationSec: number | null;
  currentStreak: number;
  tags: TagStat[];
  bands: BandStat[];
  history: RatingPoint[];
  formScore: number | null;
}

const isSolved = (o: Outcome) => o !== "failed";

export async function getAnalytics(): Promise<Analytics> {
  const cfg = await getSettings();

  const rows = await db
    .select({ attempt: attempts, problem: problems })
    .from(attempts)
    .innerJoin(problems, eq(attempts.problemId, problems.id))
    .where(and(eq(attempts.status, "completed"), isNotNull(attempts.outcome)))
    .orderBy(attempts.completedAt);

  const total = rows.length;

  const tagMap = new Map<string, { attempts: number; solved: number; score: number; durations: number[]; ratings: number[] }>();
  const bandMap = new Map<number, { attempts: number; solved: number }>();
  const history: RatingPoint[] = [];
  const durations: number[] = [];

  let solved = 0;
  let cleanSolves = 0;
  let tagAssistedSolves = 0;
  let overTimeSolves = 0;

  rows.forEach((row, i) => {
    const a = row.attempt;
    const outcome = a.outcome as Outcome;
    const score = OUTCOME_SCORE[outcome];
    const ok = isSolved(outcome);

    if (ok) solved++;
    if (outcome === "solved_clean") cleanSolves++;
    if (outcome === "solved_with_tags") tagAssistedSolves++;
    if (outcome === "solved_over_time") overTimeSolves++;
    if (a.durationSec != null) durations.push(a.durationSec);

    for (const tag of a.problemTags) {
      const t = tagMap.get(tag) ?? { attempts: 0, solved: 0, score: 0, durations: [], ratings: [] };
      t.attempts++;
      if (ok) t.solved++;
      t.score += score;
      if (a.durationSec != null) t.durations.push(a.durationSec);
      t.ratings.push(a.problemRating);
      tagMap.set(tag, t);
    }

    const band = Math.round(a.problemRating / 100) * 100;
    const b = bandMap.get(band) ?? { attempts: 0, solved: 0 };
    b.attempts++;
    if (ok) b.solved++;
    bandMap.set(band, b);

    history.push({
      index: i + 1,
      date: (a.completedAt ?? a.startedAt).toISOString(),
      rating: a.ratingAfter ?? a.ratingBefore,
      problemRating: a.problemRating,
      delta: a.ratingDelta ?? 0,
      outcome,
      problemName: row.problem.name,
    });
  });

  // Seed the chart with the starting point so a single attempt still draws a line.
  if (history.length > 0) {
    history.unshift({
      index: 0,
      date: rows[0].attempt.startedAt.toISOString(),
      rating: rows[0].attempt.ratingBefore,
      problemRating: rows[0].attempt.problemRating,
      delta: 0,
      outcome: "solved_clean",
      problemName: "Start",
    });
  }

  const tags: TagStat[] = [...tagMap.entries()]
    .map(([tag, t]) => ({
      tag,
      attempts: t.attempts,
      solved: t.solved,
      score: t.score / t.attempts,
      solveRate: t.solved / t.attempts,
      avgDurationSec: t.durations.length
        ? Math.round(t.durations.reduce((s, d) => s + d, 0) / t.durations.length)
        : null,
      avgRating: Math.round(t.ratings.reduce((s, r) => s + r, 0) / t.ratings.length),
    }))
    .sort((a, b) => b.attempts - a.attempts);

  const bands: BandStat[] = [...bandMap.entries()]
    .map(([band, b]) => ({
      band,
      attempts: b.attempts,
      solved: b.solved,
      solveRate: b.solved / b.attempts,
    }))
    .sort((a, b) => a.band - b.band);

  const sortedDurations = [...durations].sort((a, b) => a - b);
  const medianDurationSec = sortedDurations.length
    ? sortedDurations[Math.floor(sortedDurations.length / 2)]
    : null;

  // Current streak of consecutive solves, counting backwards from the newest.
  let currentStreak = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (isSolved(rows[i].attempt.outcome as Outcome)) currentStreak++;
    else break;
  }

  const formEntries = rows
    .slice(-FORM_WINDOW * 3)
    .reverse()
    .map((r) => ({ problemRating: r.attempt.problemRating, outcome: r.attempt.outcome as Outcome }))
    .filter((e) => e.problemRating >= cfg.rating - 50)
    .slice(0, FORM_WINDOW);

  const formScore = formEntries.length
    ? formEntries.reduce((s, e) => s + OUTCOME_SCORE[e.outcome], 0) / formEntries.length
    : null;

  return {
    total,
    solved,
    solveRate: total ? solved / total : 0,
    cleanSolves,
    tagAssistedSolves,
    overTimeSolves,
    medianDurationSec,
    currentStreak,
    tags,
    bands,
    history,
    formScore,
  };
}

export async function getProblemPoolStats() {
  const cfg = await getSettings();
  const lo = Math.max(800, cfg.rating - cfg.ratingWindow);
  const hi = cfg.rating + cfg.ratingWindow;

  const [row] = await db
    .select({
      inBand: sql<number>`count(*)::int`,
      available: sql<number>`count(*) filter (where ${problems.solvedOnCf} = false)::int`,
    })
    .from(problems)
    .where(
      and(
        isNotNull(problems.rating),
        sql`${problems.rating} >= ${lo}`,
        sql`${problems.rating} <= ${hi}`,
      ),
    );

  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      availableTotal: sql<number>`count(*) filter (where ${problems.solvedOnCf} = false)::int`,
    })
    .from(problems);

  return {
    lo,
    hi,
    inBand: row?.inBand ?? 0,
    available: row?.available ?? 0,
    total: totals?.total ?? 0,
    availableTotal: totals?.availableTotal ?? 0,
  };
}
