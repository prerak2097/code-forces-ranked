"use client";

import { useState, type ReactNode } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Chart frame with a table fallback. Identity is never carried by colour alone —
 * every chart here can be read as numbers.
 */
export function ChartCard({
  title,
  description,
  children,
  table,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  table?: ReactNode;
  action?: ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <CardAction className="flex items-center gap-1">
          {action}
          {table && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={view === "chart" ? "Show as table" : "Show as chart"}
              onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
            >
              {view === "chart" ? <Table2 className="size-4" /> : <BarChart3 className="size-4" />}
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>{view === "chart" || !table ? children : table}</CardContent>
    </Card>
  );
}

/** Shared tooltip chrome so every chart's hover layer looks identical. */
export function TooltipShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">{children}</div>
  );
}

export const AXIS = {
  stroke: "var(--viz-axis)",
  tick: { fill: "var(--viz-label)", fontSize: 11 },
  tickLine: false,
} as const;

export const GRID = {
  stroke: "var(--viz-grid)",
  strokeDasharray: "0",
  strokeWidth: 1,
} as const;
