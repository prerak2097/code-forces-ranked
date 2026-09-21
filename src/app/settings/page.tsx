import { formatDistanceToNow } from "date-fns";
import { SettingsForm } from "@/components/app/settings-form";
import { getProblemPoolStats, getSettings } from "@/lib/queries";

export const dynamic = "force-dynamic";

const ago = (d: Date | null) =>
  d ? formatDistanceToNow(d, { addSuffix: true }) : null;

export default async function SettingsPage() {
  const [cfg, pool] = await Promise.all([getSettings(), getProblemPoolStats()]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Everything about how problems are picked and how your rating moves.
        </p>
      </div>

      <SettingsForm
        initial={{
          cfHandle: cfg.cfHandle ?? "",
          rating: cfg.rating,
          ratingWindow: cfg.ratingWindow,
          selectionMode: cfg.selectionMode,
          retryFailedAfterDays: cfg.retryFailedAfterDays,
          targetSolveRate: cfg.targetSolveRate,
          pomodoroWorkMin: cfg.pomodoroWorkMin,
          pomodoroShortBreakMin: cfg.pomodoroShortBreakMin,
          pomodoroLongBreakMin: cfg.pomodoroLongBreakMin,
          pomodoroRounds: cfg.pomodoroRounds,
          pomodoroAutoStartBreaks: cfg.pomodoroAutoStartBreaks,
          pomodoroAutoStartWork: cfg.pomodoroAutoStartWork,
          pomodoroSound: cfg.pomodoroSound,
        }}
        pool={pool}
        lastProblemSync={ago(cfg.lastProblemSync)}
        lastSubmissionSync={ago(cfg.lastSubmissionSync)}
        savedHandle={cfg.cfHandle}
        gradedAttempts={cfg.gradedAttempts}
      />
    </div>
  );
}
