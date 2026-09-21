import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatTile } from "@/components/app/stat-tile";
import { BandChart } from "@/components/charts/band-chart";
import { ChartCard } from "@/components/charts/chart-card";
import { RatingChart } from "@/components/charts/rating-chart";
import { TagChart } from "@/components/charts/tag-chart";
import { getAnalytics, getSettings, type TagStat } from "@/lib/queries";
import { FORM_WINDOW } from "@/lib/rating";

export const dynamic = "force-dynamic";

/** Tags need a few data points before "weak" means anything. */
const MIN_SAMPLE = 3;

const pct = (v: number) => `${Math.round(v * 100)}%`;
const mins = (s: number | null) => (s == null ? "—" : `${Math.round(s / 60)}m`);

export default async function AnalyticsPage() {
  const [cfg, a] = await Promise.all([getSettings(), getAnalytics()]);

  const ranked = a.tags.filter((t) => t.attempts >= MIN_SAMPLE);
  const weakest = [...ranked].sort((x, y) => x.score - y.score).slice(0, 5);
  const strongest = [...ranked].sort((x, y) => y.score - x.score).slice(0, 5);
  const chartTags = [...ranked].sort((x, y) => x.solveRate - y.solveRate).slice(0, 14);

  if (a.total === 0) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="max-w-sm space-y-2 text-center">
          <h1 className="text-xl font-semibold">Nothing to analyse yet</h1>
          <p className="text-sm text-muted-foreground">
            Finish a few problems and this page fills in with your tag strengths, difficulty
            bands, and rating curve.
          </p>
        </div>
      </div>
    );
  }

  const formTone =
    a.formScore == null
      ? undefined
      : a.formScore >= cfg.targetSolveRate
        ? ("good" as const)
        : a.formScore >= cfg.targetSolveRate * 0.6
          ? ("warning" as const)
          : ("critical" as const);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          {a.total} graded attempt{a.total === 1 ? "" : "s"} · {a.solved} solved
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Rating"
          value={String(cfg.rating)}
          sub={cfg.peakRating > cfg.rating ? `peak ${cfg.peakRating}` : "at peak"}
        />
        <StatTile label="Solve rate" value={pct(a.solveRate)} sub={`${a.solved} of ${a.total}`} />
        <StatTile
          label={`Form (last ${FORM_WINDOW} at level)`}
          value={a.formScore == null ? "—" : pct(a.formScore)}
          sub={`target ${pct(cfg.targetSolveRate)}`}
          tone={formTone}
        />
        <StatTile label="Median time" value={mins(a.medianDurationSec)} sub="per attempt" />
        <StatTile
          label="Current streak"
          value={String(a.currentStreak)}
          sub={a.currentStreak === 1 ? "solve" : "solves"}
        />
      </div>

      <ChartCard
        title="Rating progression"
        description="Every graded attempt, in order. Gains are throttled until recent form justifies them."
      >
        <RatingChart data={a.history} />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where you lose time</CardTitle>
            <CardDescription>
              Weakest tags with at least {MIN_SAMPLE} attempts — scored with partial credit, so
              tag-assisted solves count as half.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TagList tags={weakest} direction="down" empty="Not enough data yet." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What you&apos;re good at</CardTitle>
            <CardDescription>
              Your strongest tags over the same sample threshold.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TagList tags={strongest} direction="up" empty="Not enough data yet." />
          </CardContent>
        </Card>
      </div>

      <ChartCard
        title="Solve rate by tag"
        description={`Weakest first. n = attempts; tags with fewer than ${MIN_SAMPLE} are hidden.`}
        table={<TagTable tags={ranked} />}
      >
        <TagChart data={chartTags} target={cfg.targetSolveRate} />
      </ChartCard>

      <ChartCard
        title="Attempts by difficulty band"
        description="Volume matters as much as rate — a perfect record over two problems proves nothing."
        table={<BandTable bands={a.bands} />}
      >
        <BandChart data={a.bands} currentRating={cfg.rating} />
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How you solve</CardTitle>
          <CardDescription>The shape of your solves, not just the count.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <StatTile
            label="Clean solves"
            value={String(a.cleanSolves)}
            sub={a.solved ? `${pct(a.cleanSolves / a.solved)} of solves` : undefined}
          />
          <StatTile
            label="Needed tags"
            value={String(a.tagAssistedSolves)}
            sub={a.solved ? `${pct(a.tagAssistedSolves / a.solved)} of solves` : undefined}
          />
          <StatTile
            label="Over time budget"
            value={String(a.overTimeSolves)}
            sub={a.solved ? `${pct(a.overTimeSolves / a.solved)} of solves` : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function TagList({
  tags,
  direction,
  empty,
}: {
  tags: TagStat[];
  direction: "up" | "down";
  empty: string;
}) {
  if (!tags.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const Icon = direction === "up" ? ArrowUpRight : ArrowDownRight;
  const color = direction === "up" ? "var(--viz-good)" : "var(--viz-critical)";

  return (
    <ul className="space-y-2.5">
      {tags.map((t) => (
        <li key={t.tag} className="flex items-center gap-3">
          <Icon className="size-4 shrink-0" style={{ color }} />
          <span className="min-w-0 flex-1 truncate text-sm">{t.tag}</span>
          <span className="tnum text-sm font-medium">{pct(t.score)}</span>
          <span className="tnum w-14 text-right text-xs text-muted-foreground">
            {t.solved}/{t.attempts}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TagTable({ tags }: { tags: TagStat[] }) {
  return (
    <div className="max-h-[420px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tag</TableHead>
            <TableHead className="text-right">Rate</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead className="text-right">Record</TableHead>
            <TableHead className="text-right">Avg rating</TableHead>
            <TableHead className="text-right">Avg time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tags.map((t) => (
            <TableRow key={t.tag}>
              <TableCell className="font-medium">{t.tag}</TableCell>
              <TableCell className="tnum text-right">{pct(t.solveRate)}</TableCell>
              <TableCell className="tnum text-right">{pct(t.score)}</TableCell>
              <TableCell className="tnum text-right">
                {t.solved}/{t.attempts}
              </TableCell>
              <TableCell className="tnum text-right">{t.avgRating}</TableCell>
              <TableCell className="tnum text-right">{mins(t.avgDurationSec)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function BandTable({
  bands,
}: {
  bands: { band: number; attempts: number; solved: number; solveRate: number }[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Band</TableHead>
          <TableHead className="text-right">Attempts</TableHead>
          <TableHead className="text-right">Solved</TableHead>
          <TableHead className="text-right">Rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bands.map((b) => (
          <TableRow key={b.band}>
            <TableCell className="tnum font-medium">{b.band}</TableCell>
            <TableCell className="tnum text-right">{b.attempts}</TableCell>
            <TableCell className="tnum text-right">{b.solved}</TableCell>
            <TableCell className="tnum text-right">{pct(b.solveRate)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
