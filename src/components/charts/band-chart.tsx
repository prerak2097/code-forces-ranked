"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BandStat } from "@/lib/queries";
import { AXIS, GRID, TooltipShell } from "./chart-card";

/** Attempt volume per difficulty band, split solved vs not. Volume is the point: */
/** a 100% rate on two attempts is noise, and the stack shows you that. */
export function BandChart({ data, currentRating }: { data: BandStat[]; currentRating: number }) {
  if (!data.length) {
    return (
      <div className="grid h-[240px] place-items-center text-sm text-muted-foreground">
        No completed attempts yet.
      </div>
    );
  }

  const rows = data.map((d) => ({ ...d, unsolved: d.attempts - d.solved }));

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-4">
        {[
          { label: "Solved", color: "var(--viz-series-1)" },
          { label: "Not solved", color: "var(--viz-series-2)" },
        ].map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={230}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: -16 }} barCategoryGap="28%">
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="band" {...AXIS} axisLine={{ stroke: "var(--viz-axis)" }} />
        <YAxis {...AXIS} axisLine={false} allowDecimals={false} width={40} />
        <Tooltip
          cursor={{ fill: "var(--viz-grid)", fillOpacity: 0.5 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const b = payload[0].payload as BandStat & { unsolved: number };
            return (
              <TooltipShell>
                <div className="font-medium">
                  Rated {b.band}
                  {b.band === Math.round(currentRating / 100) * 100 && (
                    <span className="ml-1.5 text-muted-foreground">· your band</span>
                  )}
                </div>
                <div className="mt-1 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-muted-foreground">
                  <span>Solved</span>
                  <span className="tnum text-right text-foreground">{b.solved}</span>
                  <span>Not solved</span>
                  <span className="tnum text-right text-foreground">{b.unsolved}</span>
                  <span>Rate</span>
                  <span className="tnum text-right text-foreground">
                    {Math.round(b.solveRate * 100)}%
                  </span>
                </div>
              </TooltipShell>
            );
          }}
        />
        <Bar
          dataKey="solved"
          name="Solved"
          stackId="a"
          fill="var(--viz-series-1)"
          stroke="var(--viz-surface)"
          strokeWidth={2}
          maxBarSize={44}
        />
        <Bar
          dataKey="unsolved"
          name="Not solved"
          stackId="a"
          fill="var(--viz-series-2)"
          stroke="var(--viz-surface)"
          strokeWidth={2}
          radius={[4, 4, 0, 0]}
          maxBarSize={44}
        />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
