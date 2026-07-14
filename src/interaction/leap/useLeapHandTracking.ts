import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  applyLeapHandsToStore,
  clearHandStore,
  type LeapHandState,
} from '../store';
import {
  HAND_TRACKING_ALIVE_MS,
  HAND_TRACKING_SMOOTHING,
  smoothTowardInPlace,
  type HandLandmarks,
} from '../shared/smoothing';
import { LeapHandSource, type LeapFrame, type LeapInteractionBox } from './leap-browser.js';
import {
  leapHandToLandmarks,
  leapHandToRich,
  DEFAULT_DISPLAY_BOX,
} from './leapMapping';

export interface LeapHandTrackingOptions {
  /** Leap Motion Core Services WebSocket URL. */
  url?: string;
  /** Reach volume (mm) mapped to the [0,1] frame. */
  interactionBox?: LeapInteractionBox;
  /** Mirror X to match a selfie-style view (default true, like MediaPipe). */
  mirror?: boolean;
}

/**
 * Streams hand data straight from the Leap Motion service into handStore.
 * Populates handStore.hands (21-point MediaPipe layout) for existing consumers
 * plus handStore.leap (rich grab/pinch/palm/angles) for Leap-native features.
 * Replaces the MediaPipe WebSocket path; no Python process required.
 */
export function useLeapHandTracking(options: LeapHandTrackingOptions = {}) {
  const {
    url = 'ws://127.0.0.1:6437/v7.json',
    interactionBox = DEFAULT_DISPLAY_BOX,
    mirror = true,
  } = options;

  // Latest config in refs so a running LeapHandSource reads current values
  // without reconnecting on every calibration tweak.
  const boxRef = useRef(interactionBox);
  const mirrorRef = useRef(mirror);
  boxRef.current = interactionBox;
  mirrorRef.current = mirror;

  const targetLandmarks = useRef<HandLandmarks>([]);
  const targetRich = useRef<LeapHandState[]>([]);
  const smoothedLandmarks = useRef<HandLandmarks>([]);
  const lastUpdateTime = useRef(0);

  useEffect(() => {
    const source = new LeapHandSource({
      url,
      onFrame: ({ hands }: LeapFrame) => {
        const box = boxRef.current;
        const mir = mirrorRef.current;
        targetLandmarks.current = hands.map((h) => leapHandToLandmarks(h, box, mir));
        targetRich.current = hands.map((h) => leapHandToRich(h, box, mir));
        if (targetLandmarks.current.length > 0) {
          lastUpdateTime.current = performance.now();
        }
      },
      onStatus: (status) => {
        if (status === 'connected') {
          console.log(`[LeapHandTracking] Connected to ${url}`);
        } else if (status === 'disconnected') {
          console.warn('[LeapHandTracking] Connection lost. Retrying...');
        }
      },
    });

    source.connect();

    return () => {
      source.disconnect();
      clearHandStore();
    };
  }, [url]);

  useFrame((_state, delta) => {
    const target = targetLandmarks.current;
    const timedOut =
      performance.now() - lastUpdateTime.current > HAND_TRACKING_ALIVE_MS;

    if (target.length === 0 || timedOut) {
      if (smoothedLandmarks.current.length !== 0) {
        smoothedLandmarks.current.length = 0;
        clearHandStore();
      }
      return;
    }

    const alpha = 1 - Math.pow(HAND_TRACKING_SMOOTHING, delta * 60);
    smoothTowardInPlace(smoothedLandmarks.current, target, alpha);

    // Rich state is passed through raw (grab/pinch shouldn't lag); it stays
    // index-aligned with the landmarks since both derive from the same frame.
    applyLeapHandsToStore(smoothedLandmarks.current, targetRich.current);
  });
}
