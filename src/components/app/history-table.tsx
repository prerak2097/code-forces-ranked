"use client";

import { useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getNotesForAttempt } from "@/lib/actions";
import { problemUrlClient } from "@/lib/problem-url";
import { OUTCOME_LABEL, type Outcome } from "@/lib/rating";
import { Markdown } from "./markdown";

export interface HistoryRow {
  id: number;
  contestId: number;
  index: string;
  name: string;
  problemRating: number;
  tags: string[];
  outcome: Outcome;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  durationSec: number | null;
  completedAt: string;
}

const OUTCOME_TONE: Record<Outcome, string> = {
  solved_clean: "var(--viz-good)",
  solved_over_time: "var(--viz-warning)",
  solved_with_tags: "var(--viz-series-2)",
  failed: "var(--viz-critical)",
};

export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<HistoryRow | null>(null);
  const [note, setNote] = useState<{
    markdown: string;
    code: string;
    language: string;
    excalidrawUrl: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function show(row: HistoryRow) {
    setActive(row);
    setOpen(true);
    setLoading(true);
    setNote(null);
    try {
      const n = await getNotesForAttempt(row.id);
      setNote(
        n
          ? {
              markdown: n.markdown,
              code: n.code,
              language: n.language,
              excalidrawUrl: n.excalidrawUrl,
            }
          : null,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">Problem</TableHead>
              <TableHead className="text-right">Rated</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="text-right">Δ</TableHead>
              <TableHead className="text-right">Rating</TableHead>
              <TableHead className="text-right">Time</TableHead>
              <TableHead className="text-right">When</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {r.tags.slice(0, 4).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] font-normal">
                        {t}
                      </Badge>
                    ))}
                    {r.tags.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{r.tags.length - 4}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="tnum text-right">{r.problemRating}</TableCell>
                <TableCell>
                  <span
                    className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs"
                    style={{ color: OUTCOME_TONE[r.outcome] }}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: OUTCOME_TONE[r.outcome] }}
                    />
                    {OUTCOME_LABEL[r.outcome]}
                  </span>
                </TableCell>
                <TableCell
                  className="tnum text-right font-medium"
                  style={{ color: r.delta >= 0 ? "var(--viz-good)" : "var(--viz-critical)" }}
                >
                  {r.delta >= 0 ? "+" : ""}
                  {r.delta}
                </TableCell>
                <TableCell className="tnum text-right text-muted-foreground">
                  {r.ratingAfter}
                </TableCell>
                <TableCell className="tnum text-right text-muted-foreground">
                  {r.durationSec == null ? "—" : `${Math.round(r.durationSec / 60)}m`}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(r.completedAt), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="View notes"
                      onClick={() => void show(r)}
                    >
                      <FileText className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="Open on Codeforces"
                      nativeButton={false}
                      render={
                        <a
                          href={problemUrlClient(r.contestId, r.index)}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      <ExternalLink className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{active?.name}</SheetTitle>
            <SheetDescription>
              {active && (
                <>
                  Rated {active.problemRating} · {OUTCOME_LABEL[active.outcome]} ·{" "}
                  {active.ratingBefore} → {active.ratingAfter}
                </>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-4 pb-8">
            {loading && <p className="text-sm text-muted-foreground">Loading notes…</p>}

            {!loading && note && (
              <>
                <section className="space-y-2">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Notes
                  </h3>
                  <Markdown>{note.markdown}</Markdown>
                </section>

                {note.code.trim() && (
                  <section className="space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Solution
                    </h3>
                    <Markdown>{`\`\`\`${note.language}\n${note.code}\n\`\`\``}</Markdown>
                  </section>
                )}

                {note.excalidrawUrl && (
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={
                      <a href={note.excalidrawUrl} target="_blank" rel="noreferrer" />
                    }
                  >
                    Open sketch <ExternalLink className="size-4" />
                  </Button>
                )}
              </>
            )}

            {!loading && !note && (
              <p className="text-sm text-muted-foreground">No notes saved for this attempt.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
