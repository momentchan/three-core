import {
  useLeapHandTracking,
  type LeapHandTrackingOptions,
} from './useLeapHandTracking';

export type LeapHandTrackingProps = LeapHandTrackingOptions;

/** Drop inside <Canvas> to stream Leap Motion hand data into handStore. */
export function LeapHandTracking(props: LeapHandTrackingProps = {}) {
  useLeapHandTracking(props);
  return null;
}
