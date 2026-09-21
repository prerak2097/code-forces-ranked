"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TagStat } from "@/lib/queries";
import { AXIS, GRID, TooltipShell } from "./chart-card";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Solve rate per tag, weakest first. One series, so one colour — length carries
 * the magnitude and the sort carries the ranking.
 */
export function TagChart({ data, target }: { data: TagStat[]; target: number }) {
  if (!data.length) {
    return (
      <div className="grid h-[300px] place-items-center text-sm text-muted-foreground">
        No tagged attempts yet.
      </div>
    );
  }

  const height = Math.max(220, data.length * 30 + 60);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 20, right: 52, bottom: 4, left: 4 }}
        barCategoryGap="22%"
      >
        <CartesianGrid {...GRID} horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 1]}
          tickFormatter={pct}
          {...AXIS}
          axisLine={{ stroke: "var(--viz-axis)" }}
        />
        <YAxis
          type="category"
          dataKey="tag"
          width={150}
          {...AXIS}
          axisLine={false}
          interval={0}
        />
        <ReferenceLine
          x={target}
          stroke="var(--viz-label)"
          strokeDasharray="4 4"
          label={{
            value: `target ${pct(target)}`,
            position: "top",
            offset: 8,
            fill: "var(--viz-label)",
            fontSize: 10,
          }}
        />
        <Tooltip
          cursor={{ fill: "var(--viz-grid)", fillOpacity: 0.5 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const t = payload[0].payload as TagStat;
            return (
              <TooltipShell>
                <div className="font-medium">{t.tag}</div>
                <div className="mt-1 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-muted-foreground">
                  <span>Solve rate</span>
                  <span className="tnum text-right text-foreground">{pct(t.solveRate)}</span>
                  <span>Record</span>
                  <span className="tnum text-right text-foreground">
                    {t.solved}/{t.attempts}
                  </span>
                  <span>Avg difficulty</span>
                  <span className="tnum text-right text-foreground">{t.avgRating}</span>
                  {t.avgDurationSec != null && (
                    <>
                      <span>Avg time</span>
                      <span className="tnum text-right text-foreground">
                        {Math.round(t.avgDurationSec / 60)}m
                      </span>
                    </>
                  )}
                </div>
              </TooltipShell>
            );
          }}
        />
        <Bar
          dataKey="solveRate"
          fill="var(--viz-series-1)"
          radius={[0, 4, 4, 0]}
          maxBarSize={18}
          minPointSize={2}
        >
          <LabelList
            dataKey="attempts"
            position="right"
            offset={8}
            fontSize={10}
            fill="var(--viz-label)"
            formatter={(v) => (v == null ? "" : `n=${v}`)}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
