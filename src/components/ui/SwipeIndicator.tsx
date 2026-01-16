import { ChevronLeft, ChevronRight } from "lucide-react";

interface SwipeIndicatorProps {
  currentIndex: number;
  totalTabs: number;
  tabLabels?: string[];
  className?: string;
}

/**
 * Visual indicator for swipe navigation on mobile.
 * Shows dots representing tabs and swipe hint.
 */
export function SwipeIndicator({
  currentIndex,
  totalTabs,
  tabLabels,
  className = "",
}: SwipeIndicatorProps) {
  const canGoLeft = currentIndex > 0;
  const canGoRight = currentIndex < totalTabs - 1;

  return (
    <div className={`flex items-center justify-center gap-3 py-2 text-muted-foreground ${className}`}>
      {/* Left arrow hint */}
      <ChevronLeft
        className={`h-4 w-4 transition-opacity ${canGoLeft ? "opacity-70" : "opacity-20"}`}
      />

      {/* Dots */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalTabs }).map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all ${
              i === currentIndex
                ? "w-2 h-2 bg-primary"
                : "w-1.5 h-1.5 bg-muted-foreground/40"
            }`}
            title={tabLabels?.[i]}
          />
        ))}
      </div>

      {/* Right arrow hint */}
      <ChevronRight
        className={`h-4 w-4 transition-opacity ${canGoRight ? "opacity-70" : "opacity-20"}`}
      />

      {/* Swipe text */}
      <span className="text-[10px] ml-1">Deslize</span>
    </div>
  );
}
