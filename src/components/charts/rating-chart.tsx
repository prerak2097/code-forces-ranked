"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RatingPoint } from "@/lib/queries";
import { OUTCOME_LABEL } from "@/lib/rating";
import { AXIS, GRID, TooltipShell } from "./chart-card";

export function RatingChart({ data }: { data: RatingPoint[] }) {
  if (data.length < 2) {
    return <Empty />;
  }

  const ratings = data.map((d) => d.rating);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const pad = Math.max(40, Math.round((max - min) * 0.2));
  // Snap the axis to 50-point steps so the ticks read as ratings, not arbitrary numbers.
  const lo = Math.max(0, Math.floor((min - pad) / 50) * 50);
  const hi = Math.ceil((max + pad) / 50) * 50;
  // Aim for ~10 labels however long the history gets.
  const tickInterval = Math.max(0, Math.ceil(data.length / 10) - 1);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis
          dataKey="index"
          {...AXIS}
          interval={tickInterval}
          minTickGap={16}
          axisLine={{ stroke: "var(--viz-axis)" }}
          label={{
            value: "attempt",
            position: "insideBottomRight",
            offset: -2,
            fill: "var(--viz-label)",
            fontSize: 11,
          }}
        />
        <YAxis
          {...AXIS}
          axisLine={false}
          width={48}
          domain={[lo, hi]}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as RatingPoint;
            if (p.index === 0) {
              return (
                <TooltipShell>
                  <div className="font-medium">Starting rating</div>
                  <div className="tnum text-muted-foreground">{p.rating}</div>
                </TooltipShell>
              );
            }
            return (
              <TooltipShell>
                <div className="max-w-48 truncate font-medium">{p.problemName}</div>
                <div className="mt-1 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-muted-foreground">
                  <span>Rating</span>
                  <span className="tnum text-right text-foreground">{p.rating}</span>
                  <span>Change</span>
                  <span
                    className="tnum text-right font-medium"
                    style={{ color: p.delta >= 0 ? "var(--viz-good)" : "var(--viz-critical)" }}
                  >
                    {p.delta >= 0 ? "+" : ""}
                    {p.delta}
                  </span>
                  <span>Problem</span>
                  <span className="tnum text-right text-foreground">{p.problemRating}</span>
                  <span>Result</span>
                  <span className="text-right text-foreground">{OUTCOME_LABEL[p.outcome]}</span>
                </div>
              </TooltipShell>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="rating"
          stroke="var(--viz-series-1)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--viz-surface)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return (
    <div className="grid h-[260px] place-items-center text-sm text-muted-foreground">
      Complete a couple of attempts to see your curve.
    </div>
  );
}
