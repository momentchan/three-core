// Map raw Leap Motion hands into the shapes handStore consumes.
//
// Two outputs per hand:
//  1. `HandLandmark[]` in the 21-point MediaPipe index layout, normalized to
//     [0,1] with a top-left origin — so all existing consumers (position at
//     index 0, the 21-point gesture heuristic, projection, glow) keep working.
//  2. `LeapHandState` — the rich native Leap data (grab/pinch/palm/angles/
//     extended fingers) for grab/pinch-driven features to build on later.
//
// Leap coordinates are millimeters, Y-up, from the device origin. We normalize
// with an interaction box, flip Y for image/screen space, and optionally mirror
// X to match a selfie-style view (handStore.mirror).

import type { HandLandmark, LeapHandState } from '../store';
import {
  normalizePoint,
  handAngles,
  DEFAULT_INTERACTION_BOX,
  type LeapInteractionBox,
  type LeapRawHand,
  type LeapVec3,
} from './leap-browser.js';

export { DEFAULT_INTERACTION_BOX };
export type { LeapInteractionBox, LeapRawHand };

// A comfortable default reach volume for a controller lying flat, facing up.
// Larger than the library default so a hand has room to travel the frame.
// Mirrors the box used by leap-demo.html.
export const DEFAULT_DISPLAY_BOX: LeapInteractionBox = {
  center: [0, 250, 0],
  size: [560, 420, 400],
};

const NUM_FINGERS = 5;

// Per-finger joint fields mapped to MediaPipe finger indices (mcp, pip, dip,
// tip). MediaPipe uses 4 points per finger after the wrist.
const FINGER_JOINT_FIELDS = [
  'mcpPosition',
  'pipPosition',
  'dipPosition',
  'btipPosition',
] as const;

/** Normalize a Leap point (mm, Y-up) to [0,1] image space (top-left origin). */
function toImagePoint(
  p: LeapVec3,
  box: LeapInteractionBox,
  mirror: boolean,
): HandLandmark {
  const n = normalizePoint(p, box);
  return {
    x: mirror ? 1 - n.x : n.x,
    y: 1 - n.y, // Leap Y is up; image space is top-down.
    z: n.z,
  };
}

/**
 * Build a 21-point MediaPipe-layout landmark array from one Leap hand.
 * Index 0 = wrist, then thumb..pinky each contributing mcp/pip/dip/tip.
 */
export function leapHandToLandmarks(
  hand: LeapRawHand,
  box: LeapInteractionBox = DEFAULT_DISPLAY_BOX,
  mirror = true,
): HandLandmark[] {
  const landmarks: HandLandmark[] = new Array(21);
  landmarks[0] = toImagePoint(hand.wrist, box, mirror);

  for (let f = 0; f < NUM_FINGERS; f++) {
    const finger = hand.fingers[f];
    const base = 1 + f * 4;
    for (let j = 0; j < FINGER_JOINT_FIELDS.length; j++) {
      const field = FINGER_JOINT_FIELDS[j];
      // Fall back to the wrist if a joint is missing so the array stays 21-long
      // and the gesture heuristic degrades gracefully.
      const p = (finger?.[field] as LeapVec3 | undefined) ?? hand.wrist;
      landmarks[base + j] = toImagePoint(p, box, mirror);
    }
  }

  return landmarks;
}

/** Extract the rich native Leap state (grab/pinch/palm/angles/fingers). */
export function leapHandToRich(
  hand: LeapRawHand,
  box: LeapInteractionBox = DEFAULT_DISPLAY_BOX,
  mirror = true,
): LeapHandState {
  const extended: boolean[] = new Array(NUM_FINGERS);
  for (let f = 0; f < NUM_FINGERS; f++) {
    extended[f] = Boolean(hand.fingers[f]?.extended);
  }

  return {
    type: hand.type,
    grabStrength: hand.grabStrength,
    pinchStrength: hand.pinchStrength,
    pinchDistance: hand.pinchDistance,
    palm: toImagePoint(hand.palmPosition, box, mirror),
    angles: handAngles(hand),
    extended,
  };
}
