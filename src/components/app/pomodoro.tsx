"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Coffee, Pause, Play, RotateCcw, Settings2, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { PomodoroSettingsDialog } from "./pomodoro-settings-dialog";

export interface PomodoroConfig {
  workMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  rounds: number;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
  sound: boolean;
}

type Phase = "work" | "short" | "long";

const PHASE_LABEL: Record<Phase, string> = {
  work: "Focus",
  short: "Short break",
  long: "Long break",
};

export const formatClock = (totalSec: number) => {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return h > 0
    ? `${h}:${mm}:${String(sec).padStart(2, "0")}`
    : `${mm}:${String(sec).padStart(2, "0")}`;
};

/** Short rising chime, synthesised so there's no audio asset to ship. */
function chime(up: boolean) {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = up ? [523.25, 659.25, 783.99] : [783.99, 587.33];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.36);
    });
    setTimeout(() => void ctx.close(), 1400);
  } catch {
    /* audio is a nicety, never a failure */
  }
}

export function Pomodoro({
  config,
  storageKey,
  onWorkSecondsChange,
  onConfigSaved,
}: {
  config: PomodoroConfig;
  /** Namespaces persisted elapsed time, so a refresh mid-problem doesn't lose it. */
  storageKey: string;
  onWorkSecondsChange?: (sec: number) => void;
  onConfigSaved?: () => void;
}) {
  const phaseSeconds = useCallback(
    (p: Phase) =>
      (p === "work"
        ? config.workMin
        : p === "short"
          ? config.shortBreakMin
          : config.longBreakMin) * 60,
    [config.workMin, config.shortBreakMin, config.longBreakMin],
  );

  const [phase, setPhase] = useState<Phase>("work");
  const [remaining, setRemaining] = useState(() => config.workMin * 60);
  const [running, setRunning] = useState(false);
  const [{ round, workSeconds, hydrated }, setProgress] = useState({
    round: 1,
    workSeconds: 0,
    hydrated: false,
  });
  const setWorkSeconds = (fn: (w: number) => number) =>
    setProgress((p) => ({ ...p, workSeconds: fn(p.workSeconds) }));
  const setRound = (fn: (r: number) => number) =>
    setProgress((p) => ({ ...p, round: fn(p.round) }));

  const lastTick = useRef<number | null>(null);

  // Restore accumulated focus time for this problem. localStorage is only
  // readable after mount, so this restore genuinely has to run in an effect.
  useEffect(() => {
    let saved: { workSeconds?: number; round?: number } = {};
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    } catch {
      /* unreadable storage just means we start from zero */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration from localStorage
    setProgress({
      workSeconds: typeof saved.workSeconds === "number" ? saved.workSeconds : 0,
      round: typeof saved.round === "number" ? saved.round : 1,
      hydrated: true,
    });
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ workSeconds, round }));
    } catch {
      /* ignore */
    }
  }, [hydrated, storageKey, workSeconds, round]);

  useEffect(() => {
    onWorkSecondsChange?.(workSeconds);
  }, [workSeconds, onWorkSecondsChange]);

  const advance = useCallback(() => {
    if (config.sound) chime(phase !== "work");

    if (phase === "work") {
      const isLong = round % Math.max(1, config.rounds) === 0;
      const next: Phase = isLong ? "long" : "short";
      setPhase(next);
      setRemaining(phaseSeconds(next));
      setRunning(config.autoStartBreaks);
    } else {
      setPhase("work");
      setRemaining(phaseSeconds("work"));
      setRound((r) => r + 1);
      setRunning(config.autoStartWork);
    }
  }, [config.autoStartBreaks, config.autoStartWork, config.rounds, config.sound, phase, phaseSeconds, round]);

  // Wall-clock driven so the timer stays accurate if the tab is throttled.
  useEffect(() => {
    if (!running) {
      lastTick.current = null;
      return;
    }
    lastTick.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const deltaSec = (now - (lastTick.current ?? now)) / 1000;
      lastTick.current = now;

      if (phase === "work") setWorkSeconds((w) => w + deltaSec);

      setRemaining((prev) => {
        const next = prev - deltaSec;
        if (next <= 0) {
          queueMicrotask(advance);
          return 0;
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [running, phase, advance]);

  const total = phaseSeconds(phase);
  const progress = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const budget = config.workMin * 60;
  const overBudget = workSeconds > budget;
  const budgetUsed = Math.min(100, (workSeconds / budget) * 100);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                phase === "work"
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {phase !== "work" && <Coffee className="size-3" />}
              {PHASE_LABEL[phase]}
            </span>
            <span className="text-xs text-muted-foreground">
              round {round}
              {config.rounds > 1 && ` · long break every ${config.rounds}`}
            </span>
          </div>
          <PomodoroSettingsDialog config={config} onSaved={onConfigSaved}>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Timer settings">
              <Settings2 className="size-4" />
            </Button>
          </PomodoroSettingsDialog>
        </div>

        <div className="text-center">
          <div className="tnum text-6xl font-semibold tracking-tight">
            {formatClock(remaining)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {PHASE_LABEL[phase].toLowerCase()} remaining
          </div>
        </div>

        <Progress value={progress} className="h-1.5" />

        <div className="space-y-1.5 rounded-lg border p-3">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Focused on this problem</span>
            <span className={cn("tnum font-medium", overBudget && "text-[var(--viz-warning)]")}>
              {formatClock(workSeconds)} / {formatClock(budget)}
            </span>
          </div>
          <Progress value={budgetUsed} className="h-1" />
          {overBudget && (
            <p className="text-xs text-[var(--viz-warning)]">
              Past budget — a solve from here is graded &ldquo;over time&rdquo;.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setRunning((r) => !r)}>
            {running ? <Pause className="size-4" /> : <Play className="size-4" />}
            {running ? "Pause" : remaining < total ? "Resume" : "Start"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Reset phase"
            onClick={() => {
              setRunning(false);
              setRemaining(phaseSeconds(phase));
            }}
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Skip phase" onClick={advance}>
            <SkipForward className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
