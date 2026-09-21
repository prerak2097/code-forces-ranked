"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Loader2, PenLine, Shapes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { saveNotes } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

const LANGUAGES = [
  { value: "cpp", label: "C++" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "rust", label: "Rust" },
  { value: "go", label: "Go" },
  { value: "csharp", label: "C#" },
  { value: "kotlin", label: "Kotlin" },
];

const TEMPLATE = `## Read
<!-- restate the problem in your own words -->

## Observations

## Approach

## Complexity
- time:
- space:

## What tripped me up
`;

export interface WorkspaceValue {
  markdown: string;
  code: string;
  language: string;
  excalidrawUrl: string;
}

export function Workspace({
  attemptId,
  initial,
  readOnly = false,
}: {
  attemptId: number;
  initial: WorkspaceValue;
  readOnly?: boolean;
}) {
  const [value, setValue] = useState<WorkspaceValue>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  const timer = useRef<number | null>(null);
  const dirty = useRef(false);
  // Latest value, readable from callbacks that must not re-subscribe on typing.
  // `patch` is the only writer, so this never drifts from `value`.
  const latest = useRef(initial);

  const flush = useCallback(async () => {
    if (!dirty.current) return;
    const next = latest.current;
    dirty.current = false;
    setState("saving");
    try {
      await saveNotes(attemptId, {
        markdown: next.markdown,
        code: next.code,
        language: next.language,
        excalidrawUrl: next.excalidrawUrl.trim() || null,
      });
      setState("saved");
    } catch {
      dirty.current = true;
      setState("idle");
    }
  }, [attemptId]);

  const patch = useCallback(
    (p: Partial<WorkspaceValue>) => {
      const next = { ...latest.current, ...p };
      latest.current = next;
      dirty.current = true;
      setValue(next);

      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 700);
    },
    [flush],
  );

  // Save on tab close and on unmount — completing an attempt swaps this whole
  // panel out, and edits from the last debounce window must not be lost.
  useEffect(() => {
    const onHide = () => {
      if (timer.current) window.clearTimeout(timer.current);
      void flush();
    };
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.removeEventListener("beforeunload", onHide);
      onHide();
    };
  }, [flush]);

  const sketchUrl = value.excalidrawUrl.trim();
  const sketchValid = /^https?:\/\//i.test(sketchUrl);

  return (
    <Card>
      <CardContent className="pt-6">
        <Tabs defaultValue="notes">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="code">Solution</TabsTrigger>
              <TabsTrigger value="sketch">Sketch</TabsTrigger>
            </TabsList>
            <SaveIndicator state={state} readOnly={readOnly} />
          </div>

          <TabsContent value="notes" className="mt-4 space-y-2">
            {readOnly ? (
              <Markdown>{value.markdown}</Markdown>
            ) : (
              <NotesEditor value={value.markdown} onChange={(markdown) => patch({ markdown })} />
            )}
          </TabsContent>

          <TabsContent value="code" className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Language</Label>
              <Select
                value={value.language}
                onValueChange={(language) => patch({ language: String(language) })}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 w-40">
                  <SelectValue>
                    {(l) => LANGUAGES.find((x) => x.value === l)?.label ?? String(l)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {readOnly ? (
              <Markdown>{`\`\`\`${value.language}\n${value.code || "// no solution saved"}\n\`\`\``}</Markdown>
            ) : (
              <Textarea
                value={value.code}
                onChange={(e) => patch({ code: e.target.value })}
                spellCheck={false}
                placeholder="Paste or write your accepted solution here…"
                className="min-h-[340px] font-mono text-[13px] leading-relaxed"
              />
            )}
          </TabsContent>

          <TabsContent value="sketch" className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="excalidraw" className="text-sm">
                Excalidraw link
              </Label>
              <div className="flex gap-2">
                <Input
                  id="excalidraw"
                  value={value.excalidrawUrl}
                  onChange={(e) => patch({ excalidrawUrl: e.target.value })}
                  placeholder="https://excalidraw.com/#json=…"
                  disabled={readOnly}
                />
                {sketchValid ? (
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<a href={sketchUrl} target="_blank" rel="noreferrer" />}
                  >
                    Open <ExternalLink className="size-4" />
                  </Button>
                ) : (
                  <Button variant="outline" disabled>
                    Open <ExternalLink className="size-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Draw the graph, tree, or DP table on excalidraw.com, hit{" "}
                <span className="font-medium">Share → Create link</span>, and paste it here.
              </p>
            </div>

            {!sketchValid && !readOnly && (
              <Button
                variant="secondary"
                nativeButton={false}
                render={<a href="https://excalidraw.com" target="_blank" rel="noreferrer" />}
              >
                <Shapes className="size-4" />
                New Excalidraw canvas
              </Button>
            )}

            {sketchValid && (
              <a
                href={sketchUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/60"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-md bg-muted">
                  <Shapes className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">Excalidraw sketch</div>
                  <div className="truncate text-xs text-muted-foreground">{sketchUrl}</div>
                </div>
                <ExternalLink className="ml-auto size-4 shrink-0 text-muted-foreground" />
              </a>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function SaveIndicator({ state, readOnly }: { state: "idle" | "saving" | "saved"; readOnly: boolean }) {
  if (readOnly) return <span className="text-xs text-muted-foreground">Read-only</span>;
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground transition-opacity",
        state === "idle" && "opacity-0",
      )}
    >
      {state === "saving" ? (
        <>
          <Loader2 className="size-3 animate-spin" /> Saving…
        </>
      ) : (
        <>
          <Check className="size-3" /> Saved
        </>
      )}
    </span>
  );
}

function NotesEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [mode, setMode] = useState<"write" | "preview">("write");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(["write", "preview"] as const).map((m) => (
            <Button
              key={m}
              variant={mode === m ? "secondary" : "ghost"}
              size="sm"
              className="h-7 capitalize"
              onClick={() => setMode(m)}
            >
              {m}
            </Button>
          ))}
        </div>
        {!value.trim() && (
          <Button variant="ghost" size="sm" className="h-7" onClick={() => onChange(TEMPLATE)}>
            <PenLine className="size-3.5" />
            Insert template
          </Button>
        )}
      </div>

      {mode === "write" ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Markdown notes — restate the problem, list observations, sketch the approach…"
          className="min-h-[340px] font-mono text-[13px] leading-relaxed"
        />
      ) : (
        <div className="min-h-[340px] rounded-lg border p-4">
          <Markdown>{value}</Markdown>
        </div>
      )}
    </div>
  );
}
