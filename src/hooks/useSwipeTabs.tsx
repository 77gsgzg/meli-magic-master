import { useMemo, useRef, useState } from "react";

type SwipeDirection = "left" | "right" | null;

type SwipeTabsOptions<T extends string> = {
  tabs: readonly T[];
  value: T;
  onValueChange: (next: T) => void;
  enabled?: boolean;
  thresholdPx?: number;
};

type SwipeTabsResult = {
  handlers: {
    onTouchStart?: (e: React.TouchEvent) => void;
    onTouchEnd?: (e: React.TouchEvent) => void;
  };
  /** Direction of the last swipe: "left" (next tab), "right" (prev tab), or null */
  swipeDirection: SwipeDirection;
};

/**
 * Adds basic left/right swipe navigation for tabbed UIs on touch devices.
 * - No business logic changes (just an alternative input method)
 * - Ignores vertical scrolling gestures
 * - Returns swipe direction for directional animations
 */
export function useSwipeTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  enabled = true,
  thresholdPx = 40,
}: SwipeTabsOptions<T>): SwipeTabsResult {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection>(null);

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

        // Set direction: swipe left (dx < 0) goes to next = "left", swipe right goes to prev = "right"
        const direction: SwipeDirection = dx < 0 ? "left" : "right";
        setSwipeDirection(direction);

        // Haptic feedback - subtle vibration on successful swipe
        if (navigator.vibrate) {
          navigator.vibrate(10); // 10ms subtle vibration
        }

        onValueChange(tabs[nextIndex]);

        // Reset direction after animation completes
        setTimeout(() => setSwipeDirection(null), 300);
      },
    } as const;
  }, [enabled, onValueChange, tabs, thresholdPx, value]);

  return { handlers, swipeDirection };
}
