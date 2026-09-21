import Link from "next/link";
import { Dices, Sparkles, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DrawButton } from "@/components/app/draw-button";
import { PracticeClient } from "@/components/app/practice-client";
import { RatingBadge } from "@/components/app/rating-badge";
import {
  getActiveAttempt,
  getProblemPoolStats,
  getRecentForm,
  getSettings,
} from "@/lib/queries";
import { CALIBRATION_ATTEMPTS } from "@/lib/rating";

export const dynamic = "force-dynamic";

export default async function PracticePage() {
  const [cfg, active, recent, pool] = await Promise.all([
    getSettings(),
    getActiveAttempt(),
    getRecentForm(),
    getProblemPoolStats(),
  ]);

  const pomodoro = {
    workMin: cfg.pomodoroWorkMin,
    shortBreakMin: cfg.pomodoroShortBreakMin,
    longBreakMin: cfg.pomodoroLongBreakMin,
    rounds: cfg.pomodoroRounds,
    autoStartBreaks: cfg.pomodoroAutoStartBreaks,
    autoStartWork: cfg.pomodoroAutoStartWork,
    sound: cfg.pomodoroSound,
  };

  if (active) {
    return (
      <PracticeClient
        attemptId={active.attempt.id}
        problem={{
          contestId: active.problem.contestId,
          index: active.problem.index,
          name: active.problem.name,
          rating: active.attempt.problemRating,
          tags: active.attempt.problemTags,
          solvedCount: active.problem.solvedCount,
        }}
        attempt={{
          tagsRevealed: active.attempt.tagsRevealed,
          budgetSec: active.attempt.budgetSec,
        }}
        workspace={{
          markdown: active.note?.markdown ?? "",
          code: active.note?.code ?? "",
          language: active.note?.language ?? "cpp",
          excalidrawUrl: active.note?.excalidrawUrl ?? "",
        }}
        pomodoro={pomodoro}
        rating={cfg.rating}
        recent={recent}
        gradedAttempts={cfg.gradedAttempts}
        targetSolveRate={cfg.targetSolveRate}
        calibrationRemaining={Math.max(0, CALIBRATION_ATTEMPTS - cfg.gradedAttempts)}
      />
    );
  }

  const empty = pool.total === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-10">
      <div className="space-y-3 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-xl bg-muted">
          <Dices className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Ready for the next one</h1>
        <p className="text-sm text-muted-foreground">
          {empty
            ? "Sync the Codeforces problemset to get started."
            : `Drawing from ${pool.available.toLocaleString()} unsolved problems rated ${pool.lo}–${pool.hi}.`}
        </p>
      </div>

      <div className="flex justify-center">
        <RatingBadge rating={cfg.rating} peakRating={cfg.peakRating} size="lg" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Target} label="Window" value={`±${cfg.ratingWindow}`} />
        <Stat
          icon={TrendingUp}
          label="Mode"
          value={
            cfg.selectionMode === "weakness"
              ? "Weakness"
              : cfg.selectionMode === "ascending"
                ? "Ascending"
                : "Balanced"
          }
        />
        <Stat icon={Sparkles} label="Graded" value={String(cfg.gradedAttempts)} />
      </div>

      <div className="flex flex-col items-center gap-3">
        {empty ? (
          <Button size="lg" nativeButton={false} render={<Link href="/settings" />}>
            Go to Settings to sync
          </Button>
        ) : (
          <DrawButton size="lg" />
        )}
        {cfg.gradedAttempts < CALIBRATION_ATTEMPTS && !empty && (
          <p className="text-center text-xs text-muted-foreground">
            {CALIBRATION_ATTEMPTS - cfg.gradedAttempts} attempts left in calibration — your
            rating moves fast until then, so be honest about results.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="truncate text-sm font-medium">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
