import { rankName } from "@/lib/rating";
import { cn } from "@/lib/utils";

export function RatingBadge({
  rating,
  peakRating,
  size = "sm",
}: {
  rating: number;
  peakRating?: number;
  size?: "sm" | "lg";
}) {
  const { name, tone } = rankName(rating);
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex items-baseline gap-2 rounded-md border px-2.5 py-1",
          size === "lg" && "gap-3 px-4 py-2",
        )}
        style={{ borderColor: `var(--rank-${tone})` }}
      >
        <span
          className={cn("tnum font-semibold", size === "lg" ? "text-3xl" : "text-sm")}
          style={{ color: `var(--rank-${tone})` }}
        >
          {rating}
        </span>
        <span
          className={cn("text-muted-foreground", size === "lg" ? "text-sm" : "text-[11px]")}
        >
          {name}
        </span>
      </div>
      {peakRating != null && peakRating > rating && size === "lg" && (
        <span className="text-xs text-muted-foreground">peak {peakRating}</span>
      )}
    </div>
  );
}
