"use server";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { attempts, notes, problems, settings } from "@/db/schema";
import {
  fetchProblemset,
  fetchUserRating,
  fetchUserSubmissions,
  problemKey,
} from "./codeforces";
import { getAnalytics, getRecentForm, getSettings } from "./queries";
import {
  applyOutcome,
  OUTCOME_SCORE,
  RATING_CEILING,
  RATING_FLOOR,
  type Outcome,
} from "./rating";

function revalidateAll() {
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ sync */

/** Pulls the full Codeforces problemset into the local cache. */
export async function syncProblemset() {
  const { problems: cfProblems, problemStatistics } = await fetchProblemset();

  const solvedCounts = new Map<string, number>();
  for (const s of problemStatistics) {
    if (s.contestId != null) solvedCounts.set(problemKey(s.contestId, s.index), s.solvedCount);
  }

  const rows = cfProblems
    .filter((p) => p.contestId != null && p.rating != null)
    .map((p) => ({
      id: problemKey(p.contestId!, p.index),
      contestId: p.contestId!,
      index: p.index,
      name: p.name,
      rating: p.rating!,
      tags: p.tags,
      solvedCount: solvedCounts.get(problemKey(p.contestId!, p.index)) ?? null,
      updatedAt: new Date(),
    }));

  // Chunked upsert — the problemset is ~10k rows and Postgres has a parameter cap.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db
      .insert(problems)
      .values(rows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: problems.id,
        set: {
          name: sql`excluded.name`,
          rating: sql`excluded.rating`,
          tags: sql`excluded.tags`,
          solvedCount: sql`excluded.solved_count`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  await db.update(settings).set({ lastProblemSync: new Date() }).where(eq(settings.id, 1));
  revalidateAll();
  return { imported: rows.length };
}

/**
 * Marks everything you've already solved on Codeforces so it never gets served.
 * Accepts the handle directly so syncing straight from the Settings field works
 * without a separate save — the handle is persisted as part of the sync.
 */
export async function syncSubmissions(handleArg?: string) {
  const cfg = await getSettings();
  const handle = handleArg?.trim() || cfg.cfHandle;
  if (!handle) throw new Error("Enter your Codeforces handle first.");

  const subs = await fetchUserSubmissions(handle);

  const solved = new Set<string>();
  const attempted = new Set<string>();
  for (const s of subs) {
    const cid = s.problem.contestId ?? s.contestId;
    if (cid == null) continue;
    const key = problemKey(cid, s.problem.index);
    attempted.add(key);
    if (s.verdict === "OK") solved.add(key);
  }

  await db.update(problems).set({ solvedOnCf: false, attemptedOnCf: false });

  const apply = async (keys: string[], patch: Partial<typeof problems.$inferInsert>) => {
    const CHUNK = 1000;
    for (let i = 0; i < keys.length; i += CHUNK) {
      const slice = keys.slice(i, i + CHUNK);
      await db
        .update(problems)
        .set(patch)
        .where(sql`${problems.id} in ${slice}`);
    }
  };

  if (attempted.size) await apply([...attempted], { attemptedOnCf: true });
  if (solved.size) await apply([...solved], { solvedOnCf: true });

  await db
    .update(settings)
    .set({ cfHandle: handle, lastSubmissionSync: new Date(), updatedAt: new Date() })
    .where(eq(settings.id, 1));
  revalidateAll();
  return { handle, submissions: subs.length, solved: solved.size, attempted: attempted.size };
}

/** Seeds the practice rating from your real Codeforces rating. */
export async function seedRatingFromCf(handleArg?: string) {
  const cfg = await getSettings();
  const handle = handleArg?.trim() || cfg.cfHandle;
  if (!handle) throw new Error("Enter your Codeforces handle first.");

  const cfRating = await fetchUserRating(handle);
  if (cfRating == null) throw new Error(`${handle} has no rated contests on Codeforces.`);

  const rating = Math.min(RATING_CEILING, Math.max(RATING_FLOOR, cfRating));
  await db
    .update(settings)
    .set({
      cfHandle: handle,
      rating,
      peakRating: Math.max(rating, cfg.peakRating),
      updatedAt: new Date(),
    })
    .where(eq(settings.id, 1));
  revalidateAll();
  return { handle, rating };
}

/* -------------------------------------------------------------- settings */

export async function updateSettings(patch: Partial<typeof settings.$inferInsert>) {
  const allowed = {
    cfHandle: patch.cfHandle,
    rating: patch.rating,
    ratingWindow: patch.ratingWindow,
    selectionMode: patch.selectionMode,
    retryFailedAfterDays: patch.retryFailedAfterDays,
    targetSolveRate: patch.targetSolveRate,
    pomodoroWorkMin: patch.pomodoroWorkMin,
    pomodoroShortBreakMin: patch.pomodoroShortBreakMin,
    pomodoroLongBreakMin: patch.pomodoroLongBreakMin,
    pomodoroRounds: patch.pomodoroRounds,
    pomodoroAutoStartBreaks: patch.pomodoroAutoStartBreaks,
    pomodoroAutoStartWork: patch.pomodoroAutoStartWork,
    pomodoroSound: patch.pomodoroSound,
  };
  const clean = Object.fromEntries(Object.entries(allowed).filter(([, v]) => v !== undefined));
  if (!Object.keys(clean).length) return;

  if (typeof clean.rating === "number") {
    clean.rating = Math.min(RATING_CEILING, Math.max(RATING_FLOOR, clean.rating));
  }

  await db
    .update(settings)
    .set({ ...clean, updatedAt: new Date() })
    .where(eq(settings.id, 1));
  revalidateAll();
}

/* ------------------------------------------------------- problem drawing */

type Candidate = typeof problems.$inferSelect;

function weightFor(
  p: Candidate,
  mode: string,
  lo: number,
  hi: number,
  tagScore: Map<string, number>,
): number {
  if (mode === "weakness") {
    // Unseen tags sit at a neutral 0.5 so they still get explored.
    const weakness = p.tags.length
      ? p.tags.reduce((s, t) => s + (1 - (tagScore.get(t) ?? 0.5)), 0) / p.tags.length
      : 0.5;
    return 0.25 + weakness * 2;
  }
  if (mode === "ascending") {
    const span = Math.max(1, hi - lo);
    return 0.25 + ((p.rating ?? lo) - lo) / span * 3;
  }
  return 1; // balanced
}

function weightedPick(items: Candidate[], weights: number[]): Candidate {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Picks the next problem inside the rating window and opens an attempt.
 * Excludes anything solved on Codeforces, anything already solved here, and
 * anything failed here too recently to be a fair re-test.
 */
export async function drawProblem() {
  const cfg = await getSettings();

  const active = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(eq(attempts.status, "active"))
    .limit(1);
  if (active[0]) return { attemptId: active[0].id, alreadyActive: true };

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(problems);
  if (count === 0) await syncProblemset();

  const lo = Math.max(RATING_FLOOR, cfg.rating - cfg.ratingWindow);
  const hi = cfg.rating + cfg.ratingWindow;
  const retryDays = cfg.retryFailedAfterDays;

  const candidates = await db
    .select()
    .from(problems)
    .where(
      and(
        isNotNull(problems.rating),
        sql`${problems.rating} >= ${lo}`,
        sql`${problems.rating} <= ${hi}`,
        eq(problems.solvedOnCf, false),
        sql`not exists (
          select 1 from ${attempts} a
          where a.problem_id = ${problems.id}
            and (
              a.status = 'active'
              or (a.status = 'completed' and a.outcome <> 'failed')
              or (a.status = 'completed' and a.outcome = 'failed'
                  and a.completed_at > now() - make_interval(days => ${retryDays}))
            )
        )`,
      ),
    )
    .orderBy(sql`random()`)
    .limit(400);

  if (!candidates.length) {
    throw new Error(
      `No unsolved problems left between ${lo} and ${hi}. Widen the rating window in Settings, or lower the re-try cooldown.`,
    );
  }

  let tagScore = new Map<string, number>();
  if (cfg.selectionMode === "weakness") {
    const analytics = await getAnalytics();
    tagScore = new Map(analytics.tags.map((t) => [t.tag, t.score]));
  }

  const weights = candidates.map((p) => weightFor(p, cfg.selectionMode, lo, hi, tagScore));
  const chosen = weightedPick(candidates, weights);

  const [attempt] = await db
    .insert(attempts)
    .values({
      problemId: chosen.id,
      status: "active",
      problemRating: chosen.rating!,
      problemTags: chosen.tags,
      ratingBefore: cfg.rating,
      budgetSec: cfg.pomodoroWorkMin * 60,
    })
    .returning();

  await db.insert(notes).values({ attemptId: attempt.id }).onConflictDoNothing();

  revalidateAll();
  return { attemptId: attempt.id, alreadyActive: false };
}

export async function revealTags(attemptId: number) {
  await db
    .update(attempts)
    .set({ tagsRevealed: true, tagsRevealedAt: new Date() })
    .where(and(eq(attempts.id, attemptId), eq(attempts.status, "active")));
  revalidateAll();
}

/** Drops the current problem without recording a result. Does not move your rating. */
export async function skipAttempt(attemptId: number) {
  await db
    .update(attempts)
    .set({ status: "abandoned", completedAt: new Date() })
    .where(eq(attempts.id, attemptId));
  revalidateAll();
}

export async function completeAttempt(
  attemptId: number,
  requestedOutcome: Outcome,
  durationSec?: number,
) {
  const cfg = await getSettings();

  const [row] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.id, attemptId), eq(attempts.status, "active")))
    .limit(1);
  if (!row) throw new Error("That attempt is no longer active.");

  const elapsed =
    durationSec ?? Math.round((Date.now() - row.startedAt.getTime()) / 1000);

  // Honesty guards: a clean solve means no tags and inside the time budget.
  let outcome = requestedOutcome;
  if (outcome === "solved_clean" && row.tagsRevealed) outcome = "solved_with_tags";
  if (outcome === "solved_clean" && elapsed > row.budgetSec) outcome = "solved_over_time";

  const recent = await getRecentForm();

  const result = applyOutcome({
    rating: cfg.rating,
    problemRating: row.problemRating,
    outcome,
    recent,
    gradedAttempts: cfg.gradedAttempts,
    targetSolveRate: cfg.targetSolveRate,
  });

  await db
    .update(attempts)
    .set({
      status: "completed",
      outcome,
      completedAt: new Date(),
      durationSec: elapsed,
      ratingAfter: result.ratingAfter,
      ratingDelta: result.delta,
      expectedScore: result.expected,
      actualScore: result.actual,
      promotionFactor: result.promotion,
      kFactor: result.k,
    })
    .where(eq(attempts.id, attemptId));

  await db
    .update(settings)
    .set({
      rating: result.ratingAfter,
      peakRating: Math.max(cfg.peakRating, result.ratingAfter),
      gradedAttempts: cfg.gradedAttempts + 1,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, 1));

  revalidateAll();
  return {
    outcome,
    coerced: outcome !== requestedOutcome,
    delta: result.delta,
    ratingAfter: result.ratingAfter,
    promotion: result.promotion,
    expected: result.expected,
    calibrating: result.calibrating,
    score: OUTCOME_SCORE[outcome],
  };
}

/* ----------------------------------------------------------------- notes */

export async function saveNotes(
  attemptId: number,
  patch: { markdown?: string; code?: string; language?: string; excalidrawUrl?: string | null },
) {
  await db
    .insert(notes)
    .values({
      attemptId,
      markdown: patch.markdown ?? "",
      code: patch.code ?? "",
      language: patch.language ?? "cpp",
      excalidrawUrl: patch.excalidrawUrl ?? null,
    })
    .onConflictDoUpdate({
      target: notes.attemptId,
      set: {
        ...(patch.markdown !== undefined && { markdown: patch.markdown }),
        ...(patch.code !== undefined && { code: patch.code }),
        ...(patch.language !== undefined && { language: patch.language }),
        ...(patch.excalidrawUrl !== undefined && { excalidrawUrl: patch.excalidrawUrl }),
        updatedAt: new Date(),
      },
    });
}

export async function getNotesForAttempt(attemptId: number) {
  const [row] = await db.select().from(notes).where(eq(notes.attemptId, attemptId)).limit(1);
  return row ?? null;
}

/** Wipes practice history and resets the rating. Problem cache is kept. */
export async function resetProgress(newRating: number) {
  await db.delete(attempts);
  await db
    .update(settings)
    .set({
      rating: Math.min(RATING_CEILING, Math.max(RATING_FLOOR, newRating)),
      peakRating: Math.min(RATING_CEILING, Math.max(RATING_FLOOR, newRating)),
      gradedAttempts: 0,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, 1));
  revalidateAll();
}
