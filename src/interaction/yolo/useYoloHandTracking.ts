import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  HAND_TRACKING_ALIVE_MS,
  HAND_TRACKING_SMOOTHING,
  smoothTowardInPlace,
  type HandLandmarks,
} from '../shared/smoothing';
import {
  applyYoloHandsToStore,
  clearHandStore,
  handStore,
  syncYoloDetectionsToStore,
} from '../store';
import { parseYoloHandFrame, yoloDetectionsToLandmarks } from './adapter';

export interface YoloWebSocketOptions {
  url?: string;
}

/**
 * Receives YOLO hand-detection bounding boxes from a local Python backend
 * (e.g. cansik/yolo-hand-detection) and maps them into handStore.hands.
 */
export function useYoloHandTracking(options: YoloWebSocketOptions = {}) {
  const { url = 'ws://127.0.0.1:8765' } = options;

  const targetLandmarks = useRef<HandLandmarks>([]);
  const smoothedLandmarks = useRef<HandLandmarks>([]);

  const hasConnectedOnce = useRef(false);
  const lastUpdateTime = useRef(0);

  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (disposed) return;

      ws = new WebSocket(url);

      ws.onopen = () => {
        hasConnectedOnce.current = true;
        console.log(`[YoloHandTracking] WebSocket connected to ${url}`);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const frame = parseYoloHandFrame(payload);
          if (!frame) {
            return;
          }

          syncYoloDetectionsToStore(frame);
          targetLandmarks.current = yoloDetectionsToLandmarks(frame);

          if (targetLandmarks.current.length > 0) {
            lastUpdateTime.current = performance.now();
          }
        } catch (err) {
          console.error('[YoloHandTracking] Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = () => {
        if (hasConnectedOnce.current) {
          // Stay silent during reconnect churn.
        }
      };

      ws.onclose = () => {
        if (!disposed) {
          if (hasConnectedOnce.current) {
            console.warn('[YoloHandTracking] Connection lost. Retrying in 2 seconds...');
          } else {
            console.log('[YoloHandTracking] Waiting for YOLO backend to initialize...');
          }
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
      clearHandStore();
    };
  }, [url]);

  useFrame((_state, delta) => {
    const target = targetLandmarks.current;
    const timedOut = performance.now() - lastUpdateTime.current > HAND_TRACKING_ALIVE_MS;

    if (target.length === 0 || timedOut) {
      if (smoothedLandmarks.current.length !== 0) {
        smoothedLandmarks.current.length = 0;
        clearHandStore();
      }
      return;
    }

    const alpha = 1 - Math.pow(HAND_TRACKING_SMOOTHING, delta * 60);

    smoothTowardInPlace(smoothedLandmarks.current, target, alpha);
    applyYoloHandsToStore(smoothedLandmarks.current);
  });
}
