import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Single-row table (id = 1) holding the player's profile + preferences. */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),

  // identity
  cfHandle: text("cf_handle"),

  // rating state
  rating: integer("rating").notNull().default(800),
  peakRating: integer("peak_rating").notNull().default(800),
  gradedAttempts: integer("graded_attempts").notNull().default(0),

  // problem selection
  ratingWindow: integer("rating_window").notNull().default(200),
  selectionMode: text("selection_mode").notNull().default("balanced"), // balanced | weakness | ascending
  retryFailedAfterDays: integer("retry_failed_after_days").notNull().default(14),

  // rating engine tuning
  targetSolveRate: real("target_solve_rate").notNull().default(0.6),

  // pomodoro (all user-editable)
  pomodoroWorkMin: integer("pomodoro_work_min").notNull().default(40),
  pomodoroShortBreakMin: integer("pomodoro_short_break_min").notNull().default(5),
  pomodoroLongBreakMin: integer("pomodoro_long_break_min").notNull().default(15),
  pomodoroRounds: integer("pomodoro_rounds").notNull().default(4),
  pomodoroAutoStartBreaks: boolean("pomodoro_auto_start_breaks").notNull().default(false),
  pomodoroAutoStartWork: boolean("pomodoro_auto_start_work").notNull().default(false),
  pomodoroSound: boolean("pomodoro_sound").notNull().default(true),

  // sync bookkeeping
  lastProblemSync: timestamp("last_problem_sync", { withTimezone: true }),
  lastSubmissionSync: timestamp("last_submission_sync", { withTimezone: true }),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Local cache of the Codeforces problemset. */
export const problems = pgTable(
  "problems",
  {
    id: text("id").primaryKey(), // `${contestId}-${index}`, e.g. "1850-A"
    contestId: integer("contest_id").notNull(),
    index: text("index").notNull(),
    name: text("name").notNull(),
    rating: integer("rating"),
    tags: text("tags").array().notNull(),
    solvedCount: integer("solved_count"),

    // from user.status sync
    solvedOnCf: boolean("solved_on_cf").notNull().default(false),
    attemptedOnCf: boolean("attempted_on_cf").notNull().default(false),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("problems_rating_idx").on(t.rating),
    index("problems_solved_on_cf_idx").on(t.solvedOnCf),
  ],
);

/**
 * One practice attempt. Problem rating + tags are snapshotted so analytics stay
 * stable even if Codeforces re-rates a problem later.
 */
export const attempts = pgTable(
  "attempts",
  {
    id: serial("id").primaryKey(),
    problemId: text("problem_id")
      .notNull()
      .references(() => problems.id, { onDelete: "cascade" }),

    status: text("status").notNull().default("active"), // active | completed | abandoned
    outcome: text("outcome"), // solved_clean | solved_over_time | solved_with_tags | failed

    tagsRevealed: boolean("tags_revealed").notNull().default(false),
    tagsRevealedAt: timestamp("tags_revealed_at", { withTimezone: true }),

    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationSec: integer("duration_sec"),
    budgetSec: integer("budget_sec").notNull().default(2400),

    // rating math, recorded for auditability
    problemRating: integer("problem_rating").notNull(),
    problemTags: text("problem_tags").array().notNull(),
    ratingBefore: integer("rating_before").notNull(),
    ratingAfter: integer("rating_after"),
    ratingDelta: integer("rating_delta"),
    expectedScore: real("expected_score"),
    actualScore: real("actual_score"),
    promotionFactor: real("promotion_factor"),
    kFactor: real("k_factor"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("attempts_status_idx").on(t.status),
    index("attempts_completed_at_idx").on(t.completedAt),
    index("attempts_problem_id_idx").on(t.problemId),
  ],
);

/** Free-form workspace attached to an attempt: markdown notes, code, a sketch link. */
export const notes = pgTable(
  "notes",
  {
    id: serial("id").primaryKey(),
    attemptId: integer("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    markdown: text("markdown").notNull().default(""),
    code: text("code").notNull().default(""),
    language: text("language").notNull().default("cpp"),
    excalidrawUrl: text("excalidraw_url"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("notes_attempt_id_unique").on(t.attemptId)],
);

export type Settings = typeof settings.$inferSelect;
export type Problem = typeof problems.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type Note = typeof notes.$inferSelect;
