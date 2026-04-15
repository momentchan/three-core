// tracker.ts
import { HandLandmarkManager } from '@core/interaction/index.ts';
import type { HandLandmarkManagerOptions } from '@core/interaction/index.ts';
import { handStore } from './store';

export const initHandTracking = async () => {
    try {
        const options: HandLandmarkManagerOptions = { modelType: 'LITE', mirror: true };
        const manager = new HandLandmarkManager(options);
        await manager.init();

        if (manager.video) {
            document.body.appendChild(manager.video);
            // Hide video, let WebGL handle visuals
            manager.video.style.display = 'none'; 
        }

        manager.addEventListener(HandLandmarkManager.EVENTS.HAND_DETECTED, (e: any) => {
            const results = e.detail;
            // Store the ENTIRE array of hands (Array of Arrays)
            handStore.landmarks = results.landmarks || []; 
        });

    } catch (e) {
        console.error("Tracking Error:", e);
    }
};