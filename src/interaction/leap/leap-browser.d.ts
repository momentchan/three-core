// Ambient types for the dependency-free Leap Motion browser library.

export type LeapVec3 = [number, number, number];

export interface LeapInteractionBox {
  center: LeapVec3;
  size: LeapVec3;
}

/** One finger (pointable), joints in mm, ordered base -> tip. */
export interface LeapFinger {
  type: number; // 0 thumb .. 4 pinky
  extended: boolean;
  direction: LeapVec3;
  length: number;
  width: number;
  carpPosition: LeapVec3;
  mcpPosition: LeapVec3;
  pipPosition: LeapVec3;
  dipPosition: LeapVec3;
  btipPosition: LeapVec3;
  tipPosition?: LeapVec3;
}

/** One tracked hand as delivered by LeapHandSource (fingers regrouped). */
export interface LeapRawHand {
  id: number;
  type: 'left' | 'right';
  confidence: number;
  grabStrength: number;
  grabAngle: number;
  pinchStrength: number;
  pinchDistance: number;
  palmPosition: LeapVec3;
  palmNormal: LeapVec3;
  palmVelocity: LeapVec3;
  palmWidth: number;
  direction: LeapVec3;
  wrist: LeapVec3;
  elbow: LeapVec3;
  timeVisible: number;
  fingers: LeapFinger[];
}

export interface LeapFrame {
  frameId: number;
  timestamp: number;
  frameRate: number;
  hands: LeapRawHand[];
}

export interface LeapHandSourceOptions {
  url?: string;
  onFrame?: (frame: LeapFrame) => void;
  onHand?: ((hand: LeapRawHand, frame: LeapFrame) => void) | null;
  onStatus?: (status: 'connecting' | 'connected' | 'disconnected') => void;
  reconnectMs?: number;
  interactionBox?: LeapInteractionBox;
}

export const FINGER_NAMES: string[];
export const FINGER_JOINTS: string[];
export const DEFAULT_INTERACTION_BOX: LeapInteractionBox;

export function normalizePoint(
  p: LeapVec3,
  box?: LeapInteractionBox,
  opts?: { clamp?: boolean },
): { x: number; y: number; z: number };

export function handAngles(hand: LeapRawHand): {
  roll: number;
  pitch: number;
  yaw: number;
};

export class LeapHandSource {
  constructor(opts?: LeapHandSourceOptions);
  url: string;
  interactionBox: LeapInteractionBox;
  normalize(point: LeapVec3, opts?: { clamp?: boolean }): { x: number; y: number; z: number };
  connect(): void;
  disconnect(): void;
}
