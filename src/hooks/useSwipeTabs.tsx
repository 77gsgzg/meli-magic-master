import { useMemo, useRef } from "react";

type SwipeTabsOptions<T extends string> = {
  tabs: readonly T[];
  value: T;
  onValueChange: (next: T) => void;
  enabled?: boolean;
  thresholdPx?: number;
};

/**
 * Adds basic left/right swipe navigation for tabbed UIs on touch devices.
 * - No business logic changes (just an alternative input method)
 * - Ignores vertical scrolling gestures
 */
export function useSwipeTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  enabled = true,
  thresholdPx = 40,
}: SwipeTabsOptions<T>) {
  const start = useRef<{ x: number; y: number } | null>(null);

  const handlers = useMemo(() => {
    if (!enabled) return {} as const;

    return {
      onTouchStart: (e: React.TouchEvent) => {
        const t = e.touches[0];
        if (!t) return;
        start.current = { x: t.clientX, y: t.clientY };
      },
      onTouchEnd: (e: React.TouchEvent) => {
        const s = start.current;
        start.current = null;
        if (!s) return;

        const t = e.changedTouches[0];
        if (!t) return;

        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;

        // Ignore mostly-vertical gestures (scroll)
        if (Math.abs(dy) > Math.abs(dx)) return;
        if (Math.abs(dx) < thresholdPx) return;

        const currentIndex = tabs.indexOf(value);
        if (currentIndex < 0) return;

        const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex < 0 || nextIndex >= tabs.length) return;

        onValueChange(tabs[nextIndex]);
      },
    } as const;
  }, [enabled, onValueChange, tabs, thresholdPx, value]);

  return handlers;
}
