import { handStore } from '../store';

const GRAB_FIST_ENTER = 0.6;
const GRAB_FIST_EXIT = 0.4;
const leapSignBySlot: number[] = [];

function distance3D(
  a: { x: number; y: number; z?: number },
  b: { x: number; y: number; z?: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Classify a MediaPipe 21-point hand as open (+1) or fist (-1).
 *
 * Three or more fingers folded (tip closer to wrist than PIP joint) reads as
 * a fist. Hands with fewer than 21 landmarks (e.g. YOLO bounding-box centres)
 * fall back to +1 (open / repel).
 */
export function getHandOpenState(
  landmarks: { x: number; y: number; z?: number }[] | null | undefined,
): 1 | -1 {
  if (!landmarks || landmarks.length < 21) return 1;

  const wrist = landmarks[0];
  let foldedCount = 0;

  // [tip, pip] pairs for index, middle, ring, pinky
  const fingers: [number, number][] = [[8, 6], [12, 10], [16, 14], [20, 18]];

  for (const [tip, pip] of fingers) {
    if (distance3D(landmarks[tip], wrist) < distance3D(landmarks[pip], wrist)) {
      foldedCount++;
    }
  }

  return foldedCount >= 3 ? -1 : 1;
}

/**
 * Signed gesture for a hand slot: +1 open (repel), -1 fist (attract).
 *
 * Uses Leap's native grabStrength when the active source is Leap (more reliable
 * than the geometric heuristic), with hysteresis to avoid flicker. Falls back
 * to the 21-point landmark heuristic for every other source.
 */
export function getHandSign(
  slotIndex: number,
  hand: { x: number; y: number; z?: number }[] | null | undefined,
): 1 | -1 {
  const leapHand = handStore.source === 'leap' ? handStore.leap?.[slotIndex] : null;

  if (leapHand) {
    const prev = leapSignBySlot[slotIndex] ?? 1;
    const grab = leapHand.grabStrength ?? 0;
    let sign: 1 | -1 = prev as 1 | -1;
    if (grab >= GRAB_FIST_ENTER) sign = -1;
    else if (grab <= GRAB_FIST_EXIT) sign = 1;
    leapSignBySlot[slotIndex] = sign;
    return sign;
  }

  return getHandOpenState(hand);
}
