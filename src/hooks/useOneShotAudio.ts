import { useLoader } from '@react-three/fiber';
import { AudioLoader, Vector3 } from 'three';
import { AudioListener } from 'three/webgpu'; 

const _listenerPos = new Vector3();

interface PlayOptions {
    position?: Vector3;
    volume?: number;
    detuneRange?: number;
    refDistance?: number;
    maxDistance?: number;
}

/**
 * High-performance one-shot audio player using Web Audio API nodes.
 * Suitable for frequent sounds like footsteps or collisions.
 */
export function useOneShotAudio(listener: AudioListener, filePaths: string[]) {
    const buffers = useLoader(AudioLoader, filePaths);

    const play = ({
        position,
        volume = 1,
        detuneRange = 200,
        refDistance = 5,
        maxDistance = 100
    }: PlayOptions = {}) => {
        if (!listener || !buffers || buffers.length === 0) return;

        const context = listener.context;

        if (context.state === 'suspended') {
            context.resume();
        }

        let finalVolume = volume;

        if (position) {
            listener.getWorldPosition(_listenerPos);
            const distance = _listenerPos.distanceTo(position);

            if (distance > maxDistance) return;

            if (distance > refDistance) {
                const rollover = 1 - (distance - refDistance) / (maxDistance - refDistance);
                finalVolume = volume * Math.max(0, rollover);
            }
        }

        if (finalVolume <= 0.01) return;

        const source = context.createBufferSource();
        const gainNode = context.createGain();

        const buffer = Array.isArray(buffers) 
            ? buffers[Math.floor(Math.random() * buffers.length)]
            : buffers;
            
        source.buffer = buffer;

        if (detuneRange > 0) {
            source.detune.value = (Math.random() - 0.5) * detuneRange;
        }

        gainNode.gain.setValueAtTime(finalVolume, context.currentTime);

        source.connect(gainNode);
        gainNode.connect(listener.getInput());

        source.start(0);

        source.onended = () => {
            source.disconnect();
            gainNode.disconnect();
        };
    };

    return { play };
}