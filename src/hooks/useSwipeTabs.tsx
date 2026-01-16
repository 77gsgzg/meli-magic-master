import { useMemo, useRef, useState, useCallback } from "react";

type SwipeDirection = "left" | "right" | null;

type SwipeTabsOptions<T extends string> = {
  tabs: readonly T[];
  value: T;
  onValueChange: (next: T) => void;
  enabled?: boolean;
  thresholdPx?: number;
  hapticEnabled?: boolean;
  soundEnabled?: boolean;
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
 * - Supports haptic feedback (vibration) and sound feedback
 */
export function useSwipeTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  enabled = true,
  thresholdPx = 40,
  hapticEnabled = true,
  soundEnabled = false,
}: SwipeTabsOptions<T>): SwipeTabsResult {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playClickSound = useCallback(() => {
    if (!soundEnabled) return;

    try {
      const audioContext = getAudioContext();
      
      // Create a short "click" sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // High frequency for a subtle "tick" sound
      oscillator.frequency.setValueAtTime(1800, audioContext.currentTime);
      oscillator.type = "sine";
      
      // Quick fade in/out for a clean click
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.002);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.015);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.015);
    } catch (error) {
      // Silently fail if audio context is not available
      console.debug("Audio feedback not available:", error);
    }
  }, [soundEnabled, getAudioContext]);

  const triggerFeedback = useCallback(() => {
    // Haptic feedback - subtle vibration on successful swipe
    if (hapticEnabled && navigator.vibrate) {
      navigator.vibrate(10); // 10ms subtle vibration
    }
    
    // Sound feedback
    playClickSound();
  }, [hapticEnabled, playClickSound]);

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

        // Trigger haptic and sound feedback
        triggerFeedback();

        onValueChange(tabs[nextIndex]);

        // Reset direction after animation completes
        setTimeout(() => setSwipeDirection(null), 300);
      },
    } as const;
  }, [enabled, onValueChange, tabs, thresholdPx, value, triggerFeedback]);

  return { handlers, swipeDirection };
}
