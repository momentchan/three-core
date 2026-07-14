/**
 * LeapHandSource - browser hand tracking straight from the Leap Motion service.
 *
 * Connects directly to the Leap Motion WebSocket server (ws://127.0.0.1:6437),
 * which the "Leap Motion Core Services" install exposes. No Python, no build
 * step, no extra process.
 *
 * This is a standalone Leap package: each tracking frame is delivered to your
 * onFrame callback as the FULL, raw Leap data (millimeters / orientation
 * matrices), with the per-finger `pointables` grouped under their owning hand
 * for convenience. Nothing is dropped and nothing is remapped to another
 * skeleton format.
 *
 * Usage (ES module):
 *   import { LeapHandSource } from "./leap-browser.js";
 *   const leap = new LeapHandSource({
 *     onFrame: ({ hands }) => {
 *       for (const h of hands) {
 *         // h.palmPosition, h.wrist, h.grabStrength, h.pinchStrength, ...
 *         // h.fingers[t] (t: 0 thumb .. 4 pinky) with mcpPosition, pipPosition,
 *         //   dipPosition, btipPosition, bases, extended, ...
 *       }
 *     },
 *   });
 *   leap.connect();
 */

// Leap finger `type` index -> human name.
export const FINGER_NAMES = ["thumb", "index", "middle", "ring", "pinky"];

// Per-finger joint fields, ordered base -> tip, for drawing/iteration.
export const FINGER_JOINTS = [
  "carpPosition",
  "mcpPosition",
  "pipPosition",
  "dipPosition",
  "btipPosition",
];

// Default Leap interaction box (mm): a volume in front of the sensor used to
// normalize positions to [0,1]. Matches leapjs's standard box; used when the
// stream doesn't provide its own `interactionBox` (the v7 stream does not).
export const DEFAULT_INTERACTION_BOX = {
  center: [0, 200, 0],
  size: [235, 235, 147],
};

/**
 * Map a Leap point [x, y, z] (mm) into [0, 1] within an interaction box
 * (leapjs's InteractionBox.normalizePoint equivalent). Returns { x, y, z } with
 * y still UP (Leap convention) - flip y yourself for image/screen space.
 * Unclamped by default so a hand can move to (and past) the box edges; pass
 * { clamp: true } to lock values into [0, 1].
 */
export function normalizePoint(p, box = DEFAULT_INTERACTION_BOX, { clamp = false } = {}) {
  const n = {
    x: (p[0] - box.center[0]) / box.size[0] + 0.5,
    y: (p[1] - box.center[1]) / box.size[1] + 0.5,
    z: (p[2] - box.center[2]) / box.size[2] + 0.5,
  };
  if (clamp) {
    n.x = Math.min(1, Math.max(0, n.x));
    n.y = Math.min(1, Math.max(0, n.y));
    n.z = Math.min(1, Math.max(0, n.z));
  }
  return n;
}

/**
 * Euler angles (radians) from a hand's orientation, matching Leap/leapjs
 * conventions (hand.roll()/pitch()/yaw()). Uses palmNormal + direction.
 */
export function handAngles(hand) {
  const n = hand.palmNormal;
  const d = hand.direction;
  return {
    roll: Math.atan2(n[0], -n[1]),
    pitch: Math.atan2(d[1], -d[2]),
    yaw: Math.atan2(d[0], -d[2]),
  };
}

export class LeapHandSource {
  constructor(opts = {}) {
    this.url = opts.url || "ws://127.0.0.1:6437/v7.json";
    this.onFrame = opts.onFrame || (() => {});
    this.onHand = opts.onHand || null;       // optional: called per hand per frame
    this.onStatus = opts.onStatus || (() => {});
    this.reconnectMs = opts.reconnectMs ?? 2000;
    this.interactionBox = opts.interactionBox || DEFAULT_INTERACTION_BOX;
    this._frameBox = null;                    // per-frame box if the stream sends one
    this._ws = null;
    this._stopped = false;
  }

  /**
   * Normalize a Leap point [x, y, z] (mm) to [0, 1] using the current frame's
   * interaction box if the stream provides one, else the configured default.
   */
  normalize(point, opts) {
    return normalizePoint(point, this._frameBox || this.interactionBox, opts);
  }

  connect() {
    this._stopped = false;
    this._open();
  }

  disconnect() {
    this._stopped = true;
    if (this._ws) this._ws.close();
  }

  _open() {
    this.onStatus("connecting");
    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch (e) {
      this._scheduleReconnect();
      return;
    }
    this._ws = ws;

    ws.onopen = () => {
      // Tell the Leap server to keep streaming to this client, even when the
      // browser tab is not the OS-focused application.
      ws.send(JSON.stringify({ background: true }));
      ws.send(JSON.stringify({ focused: true }));
      ws.send(JSON.stringify({ enableGestures: false }));
      this.onStatus("connected");
    };

    ws.onmessage = (ev) => {
      let data;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      this._handleMessage(data);
    };

    ws.onerror = () => ws.close();

    ws.onclose = () => {
      this.onStatus("disconnected");
      this._scheduleReconnect();
    };
  }

  _scheduleReconnect() {
    if (this._stopped) return;
    setTimeout(() => this._open(), this.reconnectMs);
  }

  _handleMessage(data) {
    // Non-tracking messages (version handshake, device events) have no hands.
    if (!Array.isArray(data.hands)) return;

    // Use the frame's own interaction box for normalize() if the stream sends
    // one (older protocols do); otherwise fall back to the configured default.
    this._frameBox = data.interactionBox
      ? { center: data.interactionBox.center, size: data.interactionBox.size }
      : null;

    // Group fingers (pointables) by their owning hand id, ordered thumb..pinky.
    const fingersByHand = {};
    for (const p of data.pointables || []) {
      (fingersByHand[p.handId] || (fingersByHand[p.handId] = [])).push(p);
    }

    const hands = data.hands.map((h) => ({
      ...h,
      fingers: (fingersByHand[h.id] || []).slice().sort((a, b) => a.type - b.type),
    }));

    const frame = {
      frameId: data.id,
      timestamp: data.timestamp,
      frameRate: data.currentFrameRate,
      hands,
    };

    this.onFrame(frame);
    if (this.onHand) {
      for (const h of hands) this.onHand(h, frame);
    }
  }
}
