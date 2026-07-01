import {
  handStore,
  MAX_INSTANCES,
  sharedHandPosNode,
} from '../store';
import { normalizedHandToAquarium, type AquariumBounds } from './handWorldPosition';

/**
 * Upload all active hand points into sharedHandPosNode for GPU consumers.
 * vec3 layout: (worldX, worldY, strength) — strength 0 means inactive slot.
 */
export function syncSharedHandPositions(bounds: AquariumBounds): void {
  const array = sharedHandPosNode.value.array as Float32Array;
  const active = handStore.source !== 'none';

  for (let i = 0; i < MAX_INSTANCES; i++) {
    const offset = i * 3;
    const point = handStore.hands[i]?.[0];

    if (active && point) {
      const { x, y } = normalizedHandToAquarium(point, bounds);
      const slotRatio = handStore.yolo?.slotActiveRatio?.[i] ?? 1;
      const confidence = handStore.yolo?.detections[i]?.confidence ?? 1;
      const strength = slotRatio * confidence;

      array[offset] = x;
      array[offset + 1] = y;
      array[offset + 2] = strength;
    } else {
      array[offset] = 0;
      array[offset + 1] = 0;
      array[offset + 2] = 0;
    }
  }

  sharedHandPosNode.value.needsUpdate = true;
}
