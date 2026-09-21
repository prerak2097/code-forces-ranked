"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEntry } from "@/lib/rating";
import { OutcomePanel } from "./outcome-panel";
import { Pomodoro, type PomodoroConfig } from "./pomodoro";
import { ProblemCard } from "./problem-card";
import { Workspace, type WorkspaceValue } from "./workspace";

export function PracticeClient({
  attemptId,
  problem,
  attempt,
  workspace,
  pomodoro,
  rating,
  recent,
  gradedAttempts,
  targetSolveRate,
  calibrationRemaining,
}: {
  attemptId: number;
  problem: {
    contestId: number;
    index: string;
    name: string;
    rating: number;
    tags: string[];
    solvedCount: number | null;
  };
  attempt: { tagsRevealed: boolean; budgetSec: number };
  workspace: WorkspaceValue;
  pomodoro: PomodoroConfig;
  rating: number;
  recent: FormEntry[];
  gradedAttempts: number;
  targetSolveRate: number;
  calibrationRemaining: number;
}) {
  const router = useRouter();
  const [workSeconds, setWorkSeconds] = useState(0);
  const [tagsRevealed, setTagsRevealed] = useState(attempt.tagsRevealed);

  const handleWork = useCallback((sec: number) => setWorkSeconds(sec), []);
  const budget = pomodoro.workMin * 60;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <ProblemCard
          attemptId={attemptId}
          {...problem}
          tagsRevealed={tagsRevealed}
          onTagsRevealed={() => {
            setTagsRevealed(true);
            router.refresh();
          }}
        />
        <Workspace attemptId={attemptId} initial={workspace} />
      </div>

      <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
        <Pomodoro
          key={`${pomodoro.workMin}-${pomodoro.shortBreakMin}-${pomodoro.longBreakMin}-${pomodoro.rounds}`}
          config={pomodoro}
          storageKey={`cf-ranked:timer:${attemptId}`}
          onWorkSecondsChange={handleWork}
          onConfigSaved={() => router.refresh()}
        />

        <OutcomePanel
          attemptId={attemptId}
          rating={rating}
          problemRating={problem.rating}
          budgetSec={budget}
          workSeconds={workSeconds}
          tagsRevealed={tagsRevealed}
          recent={recent}
          gradedAttempts={gradedAttempts}
          targetSolveRate={targetSolveRate}
        />

        {calibrationRemaining > 0 && (
          <p className="px-1 text-xs text-muted-foreground">
            Calibrating — {calibrationRemaining} more attempt
            {calibrationRemaining === 1 ? "" : "s"} before your rating settles down.
          </p>
        )}
      </div>
    </div>
  );
}
