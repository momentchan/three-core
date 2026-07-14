import { useEffect, useRef } from "react";
import { WaterSoundEngine, type WaterSoundOptions } from "../audio/WaterSoundEngine";

/**
 * React lifecycle wrapper for {@link WaterSoundEngine}. Creates the engine and
 * starts it on the first user gesture (autoplay policy), disposing on unmount.
 *
 * Input-agnostic: it does not know about hands, pointers, or any app state —
 * drive the returned engine yourself each frame:
 *
 *   const engine = useWaterSound({ volume: 0.6 });
 *   useFrame(() => engine.current?.setMotion(level, panX));
 *
 * @returns A ref holding the engine (null until mounted).
 */
export function useWaterSound(options: WaterSoundOptions = {}) {
  const engineRef = useRef<WaterSoundEngine | null>(null);

  useEffect(() => {
    const engine = new WaterSoundEngine(options);
    engineRef.current = engine;

    const start = () => engine.start();
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });

    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      engine.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
    // Options are the initial config; change live via engine setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return engineRef;
}
