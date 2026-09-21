"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Eye, EyeOff, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { revealTags } from "@/lib/actions";
import { problemUrlClient } from "@/lib/problem-url";

export function ProblemCard({
  attemptId,
  contestId,
  index,
  name,
  rating,
  tags,
  solvedCount,
  tagsRevealed,
  onTagsRevealed,
}: {
  attemptId: number;
  contestId: number;
  index: string;
  name: string;
  rating: number;
  tags: string[];
  solvedCount: number | null;
  tagsRevealed: boolean;
  onTagsRevealed: () => void;
}) {
  const [revealed, setRevealed] = useState(tagsRevealed);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Problem {contestId}
              {index}
            </div>
            <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight">{name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="tnum font-medium text-foreground">{rating}</span>
              {solvedCount != null && (
                <span className="tnum flex items-center gap-1">
                  <Users className="size-3.5" />
                  {solvedCount.toLocaleString()} solved
                </span>
              )}
            </div>
          </div>
          <Button
            nativeButton={false}
            render={
              <a
                href={problemUrlClient(contestId, index)}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            Open on Codeforces
            <ExternalLink className="size-4" />
          </Button>
        </div>

        <div className="rounded-lg border border-dashed p-3">
          {revealed ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Eye className="size-3.5" />
                Tags revealed — this attempt is capped at &ldquo;solved, used tags&rdquo;
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tags.length ? (
                  tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No tags on this problem.</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <EyeOff className="size-4" />
                {tags.length} tag{tags.length === 1 ? "" : "s"} hidden
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await revealTags(attemptId);
                    setRevealed(true);
                    onTagsRevealed();
                  })
                }
              >
                <Eye className="size-4" />
                Show tags
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
