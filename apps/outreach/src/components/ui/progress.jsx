// shadcn/ui · MIT · upstream e62c9435fff729a175f38983dee73b2cb4f6a069
"use client";
import { cn } from "@/lib/utils";
import { Progress as ProgressPrimitive } from "radix-ui";
function Progress({
  className,
  value,
  ...props
}) {
  return <ProgressPrimitive.Root
    data-slot="progress"
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
      className
    )}
    {...props}
  >
      <ProgressPrimitive.Indicator
    data-slot="progress-indicator"
    className="h-full w-full flex-1 bg-primary transition-all"
    style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
  />
    </ProgressPrimitive.Root>;
}
export {
  Progress
};
