"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dices, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { drawProblem } from "@/lib/actions";

export function DrawButton({
  label = "Draw a problem",
  size = "default",
}: {
  label?: string;
  size?: "default" | "lg";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size={size}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await drawProblem();
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not draw a problem");
          }
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Dices className="size-4" />}
      {pending ? "Finding one…" : label}
    </Button>
  );
}
