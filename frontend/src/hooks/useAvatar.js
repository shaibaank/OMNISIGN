import { useRef, useCallback } from 'react';

/**
 * useAvatar — Controls the Three.js 3D avatar's animation queue and morph targets.
 * Processes clip sequences from Agent 3 and schedules playback with transitions.
 */
export default function useAvatar() {
  const clipQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const currentTimeouts = useRef([]);

  /** Schedule an animation clip sequence for playback */
  const playSequence = useCallback((clips, onClipStart, onComplete) => {
    // Cancel any running sequence
    currentTimeouts.current.forEach(clearTimeout);
    currentTimeouts.current = [];
    clipQueueRef.current = [...clips];
    isPlayingRef.current = true;

    let delay = 0;
    clips.forEach((clip, index) => {
      const t = setTimeout(() => {
        if (onClipStart) onClipStart(clip, index);
      }, delay);
      currentTimeouts.current.push(t);
      delay += clip.duration_ms || 500;
    });

    // Signal completion
    const endTimer = setTimeout(() => {
      isPlayingRef.current = false;
      clipQueueRef.current = [];
      if (onComplete) onComplete();
    }, delay);
    currentTimeouts.current.push(endTimer);
  }, []);

  /** Stop all scheduled animations */
  const stop = useCallback(() => {
    currentTimeouts.current.forEach(clearTimeout);
    currentTimeouts.current = [];
    isPlayingRef.current = false;
    clipQueueRef.current = [];
  }, []);

  return { playSequence, stop, isPlayingRef };
}
