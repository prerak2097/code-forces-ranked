"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateSettings } from "@/lib/actions";
import type { PomodoroConfig } from "./pomodoro";

const PRESETS = [
  { label: "Interview (40/5)", work: 40, short: 5, long: 15, rounds: 4 },
  { label: "Classic (25/5)", work: 25, short: 5, long: 15, rounds: 4 },
  { label: "Deep work (50/10)", work: 50, short: 10, long: 20, rounds: 3 },
  { label: "Contest sprint (90/15)", work: 90, short: 15, long: 30, rounds: 2 },
];

export function PomodoroSettingsDialog({
  config,
  children,
  onSaved,
}: {
  config: PomodoroConfig;
  children: ReactNode;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(config);
  const [saving, setSaving] = useState(false);

  const num = (key: keyof PomodoroConfig, min: number, max: number) => ({
    type: "number" as const,
    min,
    max,
    value: String(draft[key] as number),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setDraft((d) => ({ ...d, [key]: Number.isFinite(v) ? v : d[key] }));
    },
  });

  async function save() {
    setSaving(true);
    try {
      await updateSettings({
        pomodoroWorkMin: Math.min(240, Math.max(1, Math.round(draft.workMin))),
        pomodoroShortBreakMin: Math.min(60, Math.max(1, Math.round(draft.shortBreakMin))),
        pomodoroLongBreakMin: Math.min(120, Math.max(1, Math.round(draft.longBreakMin))),
        pomodoroRounds: Math.min(12, Math.max(1, Math.round(draft.rounds))),
        pomodoroAutoStartBreaks: draft.autoStartBreaks,
        pomodoroAutoStartWork: draft.autoStartWork,
        pomodoroSound: draft.sound,
      });
      toast.success("Timer updated");
      setOpen(false);
      onSaved?.();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save timer settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(config); }}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Timer settings</DialogTitle>
          <DialogDescription>
            The focus length doubles as your time budget — solving past it is graded
            &ldquo;over time&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    workMin: p.work,
                    shortBreakMin: p.short,
                    longBreakMin: p.long,
                    rounds: p.rounds,
                  }))
                }
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="work">Focus (min)</Label>
              <Input id="work" {...num("workMin", 1, 240)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rounds">Rounds before long break</Label>
              <Input id="rounds" {...num("rounds", 1, 12)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="short">Short break (min)</Label>
              <Input id="short" {...num("shortBreakMin", 1, 60)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="long">Long break (min)</Label>
              <Input id="long" {...num("longBreakMin", 1, 120)} />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            {(
              [
                ["autoStartBreaks", "Auto-start breaks"],
                ["autoStartWork", "Auto-start next focus block"],
                ["sound", "Chime at phase change"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key} className="font-normal">
                  {label}
                </Label>
                <Switch
                  id={key}
                  checked={draft[key]}
                  onCheckedChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
