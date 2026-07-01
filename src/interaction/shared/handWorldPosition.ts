import { handStore, type HandLandmark } from '../store';

export type AquariumBounds = { x: number; y: number };

export type AquariumHandPosition = {
  x: number;
  y: number;
  active: boolean;
};

/**
 * Map a normalized hand point (0–1 image space, origin top-left) into
 * aquarium world XY — same space as R3F pointer * bounds.
 */
export function normalizedHandToAquarium(
  hand: HandLandmark,
  bounds: AquariumBounds,
): { x: number; y: number } {
  const pointerX = hand.x * 2 - 1;
  const pointerY = 1 - hand.y * 2;

  return {
    x: pointerX * bounds.x,
    y: pointerY * bounds.y,
  };
}

/**
 * Primary interaction point for creatures. Uses the first detected hand when
 * tracking is active; otherwise returns inactive so callers can fall back to mouse.
 */
export function getPrimaryHandAquariumPosition(
  bounds: AquariumBounds,
): AquariumHandPosition {
  if (handStore.source === 'none' || handStore.hands.length === 0) {
    return { x: 0, y: 0, active: false };
  }

  const point = handStore.hands[0]?.[0];
  if (!point) {
    return { x: 0, y: 0, active: false };
  }

  const { x, y } = normalizedHandToAquarium(point, bounds);
  return { x, y, active: true };
}
