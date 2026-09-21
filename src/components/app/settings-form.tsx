"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, Loader2, RefreshCw, Save, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  resetProgress,
  seedRatingFromCf,
  syncProblemset,
  syncSubmissions,
  updateSettings,
} from "@/lib/actions";
import { RATING_CEILING, RATING_FLOOR } from "@/lib/rating";

const SELECTION_MODES: Record<string, { label: string; hint: string }> = {
  balanced: { label: "Balanced", hint: "Uniform across the whole window" },
  weakness: { label: "Weakness", hint: "Favours the tags you score worst on" },
  ascending: { label: "Ascending", hint: "Favours the upper half of the window" },
};

export interface SettingsValues {
  cfHandle: string;
  rating: number;
  ratingWindow: number;
  selectionMode: string;
  retryFailedAfterDays: number;
  targetSolveRate: number;
  pomodoroWorkMin: number;
  pomodoroShortBreakMin: number;
  pomodoroLongBreakMin: number;
  pomodoroRounds: number;
  pomodoroAutoStartBreaks: boolean;
  pomodoroAutoStartWork: boolean;
  pomodoroSound: boolean;
}

export function SettingsForm({
  initial,
  pool,
  lastProblemSync,
  lastSubmissionSync,
  savedHandle,
  gradedAttempts,
}: {
  initial: SettingsValues;
  pool: { lo: number; hi: number; available: number; total: number; availableTotal: number };
  lastProblemSync: string | null;
  lastSubmissionSync: string | null;
  /** What's actually stored in the database, as opposed to what's typed above. */
  savedHandle: string | null;
  gradedAttempts: number;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const set = <K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const run = (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    startTransition(async () => {
      try {
        toast.success(await fn());
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(null);
      }
    });
  };

  const save = () =>
    run("save", async () => {
      await updateSettings({
        cfHandle: v.cfHandle.trim() || null,
        rating: Math.round(v.rating),
        ratingWindow: Math.round(v.ratingWindow),
        selectionMode: v.selectionMode,
        retryFailedAfterDays: Math.round(v.retryFailedAfterDays),
        targetSolveRate: v.targetSolveRate,
        pomodoroWorkMin: Math.round(v.pomodoroWorkMin),
        pomodoroShortBreakMin: Math.round(v.pomodoroShortBreakMin),
        pomodoroLongBreakMin: Math.round(v.pomodoroLongBreakMin),
        pomodoroRounds: Math.round(v.pomodoroRounds),
        pomodoroAutoStartBreaks: v.pomodoroAutoStartBreaks,
        pomodoroAutoStartWork: v.pomodoroAutoStartWork,
        pomodoroSound: v.pomodoroSound,
      });
      return "Settings saved";
    });

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------- CF sync */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Codeforces</CardTitle>
          <CardDescription>
            Syncing your submissions stops the app serving problems you&apos;ve already solved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="handle">Handle</Label>
            <Input
              id="handle"
              value={v.cfHandle}
              onChange={(e) => set("cfHandle", e.target.value)}
              placeholder="tourist"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() =>
                run("problemset", async () => {
                  const r = await syncProblemset();
                  return `Cached ${r.imported.toLocaleString()} rated problems`;
                })
              }
            >
              {busy === "problemset" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Sync problemset
            </Button>

            <Button
              variant="outline"
              disabled={busy !== null || !v.cfHandle.trim()}
              onClick={() =>
                run("subs", async () => {
                  const r = await syncSubmissions(v.cfHandle);
                  return `${r.handle}: ${r.solved.toLocaleString()} solved problems excluded from your pool`;
                })
              }
            >
              {busy === "subs" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Sync my submissions
            </Button>

            <Button
              variant="outline"
              disabled={busy !== null || !v.cfHandle.trim() || gradedAttempts > 0}
              onClick={() =>
                run("seed", async () => {
                  const r = await seedRatingFromCf(v.cfHandle);
                  set("rating", r.rating);
                  return `Starting rating set to ${r.rating} from ${r.handle}`;
                })
              }
            >
              {busy === "seed" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              Seed rating from Codeforces
            </Button>
          </div>

          {gradedAttempts > 0 && (
            <p className="text-xs text-muted-foreground">
              Seeding is disabled once you&apos;ve graded attempts — reset progress below to
              re-seed.
            </p>
          )}

          <Separator />

          <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
            <Row
              label="Handle on file"
              value={savedHandle ?? "not saved yet"}
              tone={savedHandle ? "good" : "muted"}
            />
            <Row
              label="Solved on Codeforces"
              value={
                lastSubmissionSync
                  ? `${(pool.total - pool.availableTotal).toLocaleString()} excluded`
                  : "not synced"
              }
              tone={lastSubmissionSync ? "good" : "muted"}
            />
            <Row label="Problems cached" value={pool.total.toLocaleString()} />
            <Row
              label="Available in your window"
              value={`${pool.available.toLocaleString()} (${pool.lo}–${pool.hi})`}
            />
            <Row label="Problemset synced" value={lastProblemSync ?? "never"} />
            <Row label="Submissions synced" value={lastSubmissionSync ?? "never"} />
          </dl>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------- difficulty */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Problem selection</CardTitle>
          <CardDescription>How the next problem gets picked, and how hard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SliderRow
            label="Rating window"
            hint={`Problems are drawn from ${Math.max(RATING_FLOOR, v.rating - v.ratingWindow)}–${v.rating + v.ratingWindow}.`}
            value={v.ratingWindow}
            display={`±${v.ratingWindow}`}
            min={50}
            max={600}
            step={25}
            onChange={(n) => set("ratingWindow", n)}
          />

          <div className="space-y-1.5">
            <Label>Selection mode</Label>
            <Select
              value={v.selectionMode}
              onValueChange={(m) => set("selectionMode", String(m))}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{(m) => SELECTION_MODES[String(m)]?.label ?? String(m)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SELECTION_MODES).map(([value, m]) => (
                  <SelectItem key={value} value={value}>
                    <span className="flex flex-col items-start gap-0.5">
                      <span>{m.label}</span>
                      <span className="text-xs text-muted-foreground">{m.hint}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SliderRow
            label="Re-try cooldown"
            hint="How long a failed problem stays out of the pool before it can come back."
            value={v.retryFailedAfterDays}
            display={`${v.retryFailedAfterDays} days`}
            min={0}
            max={90}
            step={1}
            onChange={(n) => set("retryFailedAfterDays", n)}
          />

          <SliderRow
            label="Target solve rate"
            hint="The rate the rating engine considers 'holding your level'. Falling short throttles your gains."
            value={Math.round(v.targetSolveRate * 100)}
            display={`${Math.round(v.targetSolveRate * 100)}%`}
            min={30}
            max={90}
            step={5}
            onChange={(n) => set("targetSolveRate", n / 100)}
          />
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------ timer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pomodoro timer</CardTitle>
          <CardDescription>
            The focus length is also your time budget — solving past it is graded &ldquo;over
            time&rdquo;.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <NumberField
              label="Focus (min)"
              value={v.pomodoroWorkMin}
              min={1}
              max={240}
              onChange={(n) => set("pomodoroWorkMin", n)}
            />
            <NumberField
              label="Short break"
              value={v.pomodoroShortBreakMin}
              min={1}
              max={60}
              onChange={(n) => set("pomodoroShortBreakMin", n)}
            />
            <NumberField
              label="Long break"
              value={v.pomodoroLongBreakMin}
              min={1}
              max={120}
              onChange={(n) => set("pomodoroLongBreakMin", n)}
            />
            <NumberField
              label="Rounds"
              value={v.pomodoroRounds}
              min={1}
              max={12}
              onChange={(n) => set("pomodoroRounds", n)}
            />
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            {(
              [
                ["pomodoroAutoStartBreaks", "Auto-start breaks"],
                ["pomodoroAutoStartWork", "Auto-start next focus block"],
                ["pomodoroSound", "Chime at phase change"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key} className="font-normal">
                  {label}
                </Label>
                <Switch
                  id={key}
                  checked={v[key]}
                  onCheckedChange={(checked) => set(key, checked)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" onClick={save} disabled={busy !== null} className="shadow-lg">
          {busy === "save" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save settings
        </Button>
      </div>

      {/* ------------------------------------------------------ danger zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="size-4" />
            Reset progress
          </CardTitle>
          <CardDescription>
            Deletes every attempt and note, and restarts calibration. Your cached problemset and
            Codeforces sync are kept.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetControl currentRating={v.rating} onDone={() => router.refresh()} />
        </CardContent>
      </Card>
    </div>
  );
}

function ResetControl({
  currentRating,
  onDone,
}: {
  currentRating: number;
  onDone: () => void;
}) {
  const [confirm, setConfirm] = useState("");
  const [startRating, setStartRating] = useState(currentRating);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="startRating" className="text-xs">
          Restart at rating
        </Label>
        <Input
          id="startRating"
          type="number"
          min={RATING_FLOOR}
          max={RATING_CEILING}
          value={startRating}
          onChange={(e) => setStartRating(Number(e.target.value) || RATING_FLOOR)}
          className="w-28"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm" className="text-xs">
          Type RESET to confirm
        </Label>
        <Input
          id="confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-36"
          autoComplete="off"
        />
      </div>
      <Button
        variant="destructive"
        disabled={confirm !== "RESET" || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await resetProgress(startRating);
            toast.success(`Progress reset — starting again at ${startRating}`);
            setConfirm("");
            onDone();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Reset failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        Reset everything
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "muted";
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed py-1 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className="tnum text-right font-medium"
        style={
          tone === "good"
            ? { color: "var(--viz-good)" }
            : tone === "muted"
              ? { color: "var(--muted-foreground)" }
              : undefined
        }
      >
        {value}
      </dd>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </div>
  );
}

function SliderRow({
  label,
  hint,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="tnum text-sm font-medium">{display}</span>
      </div>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={(n) => onChange(Array.isArray(n) ? n[0] : (n as number))}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
