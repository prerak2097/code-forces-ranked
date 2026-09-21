import { HistoryTable, type HistoryRow } from "@/components/app/history-table";
import { getHistory } from "@/lib/queries";
import type { Outcome } from "@/lib/rating";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const rows = await getHistory(200);

  const data: HistoryRow[] = rows.map(({ attempt, problem }) => ({
    id: attempt.id,
    contestId: problem.contestId,
    index: problem.index,
    name: problem.name,
    problemRating: attempt.problemRating,
    tags: attempt.problemTags,
    outcome: attempt.outcome as Outcome,
    ratingBefore: attempt.ratingBefore,
    ratingAfter: attempt.ratingAfter ?? attempt.ratingBefore,
    delta: attempt.ratingDelta ?? 0,
    durationSec: attempt.durationSec,
    completedAt: (attempt.completedAt ?? attempt.startedAt).toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">
          {data.length
            ? `Your last ${data.length} graded attempt${data.length === 1 ? "" : "s"}.`
            : "Nothing here yet."}
        </p>
      </div>

      {data.length ? (
        <HistoryTable rows={data} />
      ) : (
        <div className="grid min-h-[40vh] place-items-center rounded-lg border border-dashed">
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            Completed attempts land here with their notes, code, and rating change.
          </p>
        </div>
      )}
    </div>
  );
}
