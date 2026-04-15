// @core/interaction/store.ts
import { instancedArray } from "three/tsl";

export const MAX_HANDS = 10;
export const POINTS_PER_HAND = 1; // use index 9
export const MAX_INSTANCES = MAX_HANDS * POINTS_PER_HAND;

// 1. Create a global TSL InstancedArray node
// 這個節點會自動成為 Storage Buffer，Compute Shader 和 Render 都能直接讀取
export const sharedHandPosNode = instancedArray(MAX_INSTANCES, 'vec3');

export const handStore = {
  landmarks: [] as any[][],
  worldLandmarks: [] as any[][],
  videoWidth: 640,
  videoHeight: 480,
  mirror: true,
  gestures: [] as string[]
};

/**
 * Reuse the same outer arrays on handStore to avoid churning references every frame.
 * Inner landmark arrays are the current MediaPipe result references (read before next detect).
 */
export function syncHandResultsToStore(results: {
  landmarks?: any[][];
  worldLandmarks?: any[][];
} | null): void {
  const newLandmarks = results?.landmarks;
  const newWorld = results?.worldLandmarks;

  handStore.landmarks.length = 0;
  handStore.worldLandmarks.length = 0;

  if (!newLandmarks?.length) {
    return;
  }

  for (let i = 0; i < newLandmarks.length; i++) {
    handStore.landmarks.push(newLandmarks[i]);
  }

  if (newWorld?.length) {
    for (let i = 0; i < newWorld.length; i++) {
      handStore.worldLandmarks.push(newWorld[i]);
    }
  }
}