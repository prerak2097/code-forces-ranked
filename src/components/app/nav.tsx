"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, History, Settings as SettingsIcon, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { RatingBadge } from "./rating-badge";

const LINKS = [
  { href: "/", label: "Practice", icon: Swords },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Nav({ rating, peakRating }: { rating: number; peakRating: number }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-1 px-4 sm:px-6">
        <Link href="/" className="mr-4 flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-foreground text-background text-[11px] font-bold">
            CF
          </span>
          <span className="hidden sm:inline">Ranked</span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors sm:px-3",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <RatingBadge rating={rating} peakRating={peakRating} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
