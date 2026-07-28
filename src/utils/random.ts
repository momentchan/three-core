/**
 * Deterministic, dependency-free pseudo-random helpers.
 *
 * Hash-based (sin-fract) so the same (index, salt, seed) always yields the same
 * value — useful for stable procedural layouts that must survive re-renders and
 * reloads (particle/instance placement, etc.). CPU-side, not a shader node.
 */

/** Deterministic value in [0, 1) for a given index/salt/seed. */
export function stableRandom01(index: number, salt = 0, seed = 0): number {
  const t = Math.sin((index + seed * 17.13) * 12.9898 + salt * 78.233) * 43758.5453;
  return t - Math.floor(t);
}

/** Deterministic value in [min, max) for a given index/salt/seed. */
export function stableRandomRange(
  index: number,
  salt: number,
  seed: number,
  min: number,
  max: number,
): number {
  const range = Math.max(0, max - min);
  return min + stableRandom01(index, salt, seed) * range;
}
