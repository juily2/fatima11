export type Position = [number, number];
export interface Obstacle { x: number; z: number; radius: number }
export const WORLD_SIZE = 440;
export const GRID = 160;
export function coastRadius(angle: number): number {
  return 177 + 15 * Math.sin(angle * 3 + 0.5) + 10 * Math.cos(angle * 5 - 0.8);
}
export function rawHeight(x: number, z: number): number {
  const edge = coastRadius(Math.atan2(z, x)) - Math.hypot(x, z);
  if (edge < 0) return Math.max(-22, edge * 0.42);
  const inland = Math.min(1, edge / 28);
  const hill = 38 * Math.exp(-((x - 65) ** 2 + (z + 45) ** 2) / 3200);
  const woods = 13 * Math.exp(-((x + 60) ** 2 + (z + 58) ** 2) / 5000);
  return 0.65 + inland * (4 + hill + woods + 1.3 * Math.sin(x * 0.045) * Math.cos(z * 0.038));
}
// Match the terrain mesh triangles, including their diagonal, for solid footing.
export function terrainHeight(x: number, z: number): number {
  const step = WORLD_SIZE / GRID;
  const gx = (x + WORLD_SIZE / 2) / step, gz = (z + WORLD_SIZE / 2) / step;
  const ix = Math.floor(gx), iz = Math.floor(gz), tx = gx - ix, tz = gz - iz;
  const x0 = ix * step - WORLD_SIZE / 2, z0 = iz * step - WORLD_SIZE / 2;
  const a = rawHeight(x0,z0), b = rawHeight(x0,z0+step), d = rawHeight(x0+step,z0);
  if (tx + tz <= 1) return a + tx * (d-a) + tz * (b-a);
  const c = rawHeight(x0+step,z0+step);
  return c + (1-tx) * (b-c) + (1-tz) * (d-c);
}
export function isSafe(x: number, z: number): boolean {
  return Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x,z) < coastRadius(Math.atan2(z,x))-5 && terrainHeight(x,z)>0.8;
}
export function moveOnIsland(from: Position, to: Position, obstacles: Obstacle[]): Position {
  const free = (p: Position) => isSafe(...p) && !obstacles.some(o => Math.hypot(p[0]-o.x,p[1]-o.z)<o.radius+0.55);
  if (free(to)) return to;
  const x: Position=[to[0],from[1]], z: Position=[from[0],to[1]];
  if (free(x)) return x;
  if (free(z)) return z;
  return [...from];
}
