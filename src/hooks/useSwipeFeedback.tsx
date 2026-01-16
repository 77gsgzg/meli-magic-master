import { useCallback, useRef } from "react";

type SwipeFeedbackOptions = {
  hapticEnabled?: boolean;
  soundEnabled?: boolean;
  soundFrequency?: number;
  soundDuration?: number;
};

/**
 * Provides haptic and audio feedback for swipe gestures.
 * Uses Web Audio API for subtle click sounds (no external dependencies).
 */
export function useSwipeFeedback({
  hapticEnabled = true,
  soundEnabled = false,
  soundFrequency = 1800,
  soundDuration = 15,
}: SwipeFeedbackOptions = {}) {
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
      oscillator.frequency.setValueAtTime(soundFrequency, audioContext.currentTime);
      oscillator.type = "sine";
      
      // Quick fade in/out for a clean click
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.002);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + soundDuration / 1000);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + soundDuration / 1000);
    } catch (error) {
      // Silently fail if audio context is not available
      console.debug("Audio feedback not available:", error);
    }
  }, [soundEnabled, soundFrequency, soundDuration, getAudioContext]);

  const triggerHaptic = useCallback(() => {
    if (!hapticEnabled) return;
    
    if (navigator.vibrate) {
      navigator.vibrate(10); // 10ms subtle vibration
    }
  }, [hapticEnabled]);

  const triggerFeedback = useCallback(() => {
    triggerHaptic();
    playClickSound();
  }, [triggerHaptic, playClickSound]);

  return {
    triggerFeedback,
    triggerHaptic,
    playClickSound,
  };
}
