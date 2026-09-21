"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleSlash, Clock, SkipForward, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { completeAttempt, skipAttempt } from "@/lib/actions";
import {
  applyOutcome,
  OUTCOME_LABEL,
  type FormEntry,
  type Outcome,
} from "@/lib/rating";
import { cn } from "@/lib/utils";

const CHOICES: Array<{
  outcome: Outcome;
  icon: typeof Check;
  hint: string;
}> = [
  { outcome: "solved_clean", icon: Check, hint: "No tags, inside the time budget. Full credit." },
  { outcome: "solved_over_time", icon: Clock, hint: "Got it, but past the focus budget. 70% credit." },
  { outcome: "solved_with_tags", icon: Tag, hint: "Needed the tags or a hint. 50% credit." },
  { outcome: "failed", icon: X, hint: "Didn't get it. No credit — and your rating drops." },
];

export function OutcomePanel({
  attemptId,
  rating,
  problemRating,
  budgetSec,
  workSeconds,
  tagsRevealed,
  recent,
  gradedAttempts,
  targetSolveRate,
}: {
  attemptId: number;
  rating: number;
  problemRating: number;
  budgetSec: number;
  workSeconds: number;
  tagsRevealed: boolean;
  recent: FormEntry[];
  gradedAttempts: number;
  targetSolveRate: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<Outcome | "skip" | null>(null);

  const overBudget = workSeconds > budgetSec;
  const cleanBlocked = tagsRevealed || overBudget;

  const previews = useMemo(() => {
    const map = {} as Record<Outcome, number>;
    for (const { outcome } of CHOICES) {
      map[outcome] = applyOutcome({
        rating,
        problemRating,
        outcome,
        recent,
        gradedAttempts,
        targetSolveRate,
      }).delta;
    }
    return map;
  }, [rating, problemRating, recent, gradedAttempts, targetSolveRate]);

  function submit(outcome: Outcome) {
    setBusy(outcome);
    startTransition(async () => {
      try {
        const res = await completeAttempt(attemptId, outcome, Math.round(workSeconds));
        const sign = res.delta >= 0 ? "+" : "";
        toast.success(`${OUTCOME_LABEL[res.outcome]} · ${sign}${res.delta} → ${res.ratingAfter}`, {
          description: res.coerced
            ? `Graded as "${OUTCOME_LABEL[res.outcome]}" — tags were revealed or the budget was exceeded.`
            : res.calibrating
              ? "Still calibrating — ratings move faster for your first 10 attempts."
              : `Gains throttled to ${Math.round(res.promotion * 100)}% of full Elo by your recent form.`,
        });
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not record that attempt");
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">How did it go?</h2>
          <span className="text-xs text-muted-foreground">projected Δ</span>
        </div>

        <div className="space-y-2">
          {CHOICES.map(({ outcome, icon: Icon, hint }) => {
            const blocked = outcome === "solved_clean" && cleanBlocked;
            const delta = previews[outcome];
            const button = (
              <Button
                variant={outcome === "failed" ? "outline" : "secondary"}
                className={cn(
                  "h-auto w-full justify-start gap-3 py-2.5 text-left",
                  blocked && "pointer-events-none opacity-40",
                )}
                disabled={pending || blocked}
                onClick={() => submit(outcome)}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 truncate">{OUTCOME_LABEL[outcome]}</span>
                <span
                  className="tnum text-xs font-semibold"
                  style={{
                    color: delta >= 0 ? "var(--viz-good)" : "var(--viz-critical)",
                  }}
                >
                  {delta >= 0 ? "+" : ""}
                  {delta}
                </span>
              </Button>
            );

            return (
              <Tooltip key={outcome}>
                <TooltipTrigger
                  render={
                    <div className={cn(blocked && "cursor-not-allowed")}>
                      {busy === outcome ? (
                        <Button variant="secondary" className="w-full justify-start py-2.5" disabled>
                          Recording…
                        </Button>
                      ) : (
                        button
                      )}
                    </div>
                  }
                />
                <TooltipContent side="left" className="max-w-56">
                  {blocked
                    ? tagsRevealed
                      ? "You revealed the tags on this problem."
                      : "You're past the focus budget on this problem."
                    : hint}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          disabled={pending}
          onClick={() => {
            setBusy("skip");
            startTransition(async () => {
              await skipAttempt(attemptId);
              toast("Problem skipped — rating unchanged");
              router.refresh();
            });
          }}
        >
          {busy === "skip" ? (
            <CircleSlash className="size-4" />
          ) : (
            <SkipForward className="size-4" />
          )}
          Skip — don&apos;t score this one
        </Button>
      </CardContent>
    </Card>
  );
}
