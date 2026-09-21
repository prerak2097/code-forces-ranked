/**
 * Rating engine.
 *
 * Plain Elo has a flaw for solo practice: a handful of lucky solves just above
 * your level will float you upward even if you can't repeat them. The fix here
 * is a *promotion factor* that throttles upward movement until recent form
 * actually justifies it. Losses are never throttled — you can always fall.
 *
 * Net effect (the behaviour you asked for): sitting at 800 and solving two or
 * three 900s nudges you a few dozen points at most. Only a sustained run of
 * solves at-or-above your level opens the throttle to full width.
 */

export const OUTCOMES = [
  "solved_clean",
  "solved_over_time",
  "solved_with_tags",
  "failed",
] as const;

export type Outcome = (typeof OUTCOMES)[number];

/** Partial credit. Peeking at tags or blowing the time budget both cost you. */
export const OUTCOME_SCORE: Record<Outcome, number> = {
  solved_clean: 1.0,
  solved_over_time: 0.7,
  solved_with_tags: 0.5,
  failed: 0.0,
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  solved_clean: "Solved clean",
  solved_over_time: "Solved, over time",
  solved_with_tags: "Solved, used tags",
  failed: "Did not solve",
};

export const RATING_FLOOR = 800;
export const RATING_CEILING = 3500;

/** Attempts before the engine trusts your rating; gains are unthrottled until then. */
export const CALIBRATION_ATTEMPTS = 10;

const K_CALIBRATION = 48;
const K_NORMAL = 24;
const MAX_DELTA_CALIBRATION = 40;
const MAX_DELTA_NORMAL = 20;

/** Window of recent attempts that feeds the promotion factor. */
export const FORM_WINDOW = 10;
/** Below this many relevant attempts we have no evidence, so gains are halved. */
const MIN_FORM_SAMPLE = 5;
/** Problems more than this far below your rating don't prove anything. */
const FORM_RELEVANCE_MARGIN = 50;

const PROMOTION_MIN = 0.25;
const PROMOTION_MAX = 1.0;
/** Promotion factor when we don't yet have MIN_FORM_SAMPLE relevant attempts. */
const PROMOTION_UNPROVEN = 0.5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Standard Elo expectation on the 400-point scale. */
export function expectedScore(playerRating: number, problemRating: number): number {
  return 1 / (1 + Math.pow(10, (problemRating - playerRating) / 400));
}

export interface FormEntry {
  problemRating: number;
  outcome: Outcome;
}

/**
 * How much of an upward Elo delta you actually get to keep, in [0.25, 1.0].
 *
 * Measured as your mean *score* (not raw solve rate, so partial credit counts)
 * over the last FORM_WINDOW attempts on problems at or near your level,
 * normalised against the target solve rate.
 */
export function promotionFactor(
  recent: FormEntry[],
  rating: number,
  targetSolveRate = 0.6,
): number {
  const relevant = recent
    .filter((a) => a.problemRating >= rating - FORM_RELEVANCE_MARGIN)
    .slice(0, FORM_WINDOW);

  if (relevant.length < MIN_FORM_SAMPLE) return PROMOTION_UNPROVEN;

  const mean =
    relevant.reduce((sum, a) => sum + OUTCOME_SCORE[a.outcome], 0) / relevant.length;

  return clamp(mean / targetSolveRate, PROMOTION_MIN, PROMOTION_MAX);
}

export interface RatingInput {
  rating: number;
  problemRating: number;
  outcome: Outcome;
  /** Most recent first. Used only for the promotion factor. */
  recent: FormEntry[];
  gradedAttempts: number;
  targetSolveRate?: number;
}

export interface RatingResult {
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  expected: number;
  actual: number;
  promotion: number;
  k: number;
  calibrating: boolean;
}

export function applyOutcome(input: RatingInput): RatingResult {
  const { rating, problemRating, outcome, recent, gradedAttempts } = input;
  const targetSolveRate = input.targetSolveRate ?? 0.6;

  const calibrating = gradedAttempts < CALIBRATION_ATTEMPTS;
  const k = calibrating ? K_CALIBRATION : K_NORMAL;
  const maxDelta = calibrating ? MAX_DELTA_CALIBRATION : MAX_DELTA_NORMAL;

  const expected = expectedScore(rating, problemRating);
  const actual = OUTCOME_SCORE[outcome];

  const raw = k * (actual - expected);

  // Gains are throttled by recent form; losses always land in full.
  const promotion = calibrating
    ? 1
    : promotionFactor(recent, rating, targetSolveRate);
  const adjusted = raw > 0 ? raw * promotion : raw;

  const delta = Math.round(clamp(adjusted, -maxDelta, maxDelta));
  const ratingAfter = clamp(rating + delta, RATING_FLOOR, RATING_CEILING);

  return {
    ratingBefore: rating,
    ratingAfter,
    delta: ratingAfter - rating,
    expected,
    actual,
    promotion,
    k,
    calibrating,
  };
}

/** Rounds a rating to the nearest Codeforces problem band (100s). */
export const toBand = (rating: number) => Math.round(rating / 100) * 100;

/** Codeforces rank names, used for the badge on the dashboard. */
export function rankName(rating: number): { name: string; tone: string } {
  if (rating < 1200) return { name: "Newbie", tone: "newbie" };
  if (rating < 1400) return { name: "Pupil", tone: "pupil" };
  if (rating < 1600) return { name: "Specialist", tone: "specialist" };
  if (rating < 1900) return { name: "Expert", tone: "expert" };
  if (rating < 2100) return { name: "Candidate Master", tone: "cm" };
  if (rating < 2300) return { name: "Master", tone: "master" };
  if (rating < 2400) return { name: "International Master", tone: "im" };
  if (rating < 2600) return { name: "Grandmaster", tone: "gm" };
  if (rating < 3000) return { name: "International GM", tone: "igm" };
  return { name: "Legendary Grandmaster", tone: "lgm" };
}
