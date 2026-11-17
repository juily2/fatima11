import { describe, it, expect } from 'vitest';
import { createState, collectCrystal, activateRuin, completed, parseSave, encodeSave, safeWrite, CRYSTALS, RUINS, SPAWN } from '../src/state';
import { terrainHeight, isSafe, moveOnIsland } from '../src/terrain';

describe('exploration progress', () => {
  it('counts a crystal once and ignores unknown IDs', () => {
    const s = createState();
    expect(collectCrystal(s, 'tide-0')).toBe(true);
    expect(collectCrystal(s, 'tide-0')).toBe(false);
    expect(collectCrystal(s, 'unknown')).toBe(false);
    expect(s.collected).toEqual(['tide-0']);
  });
  it('requires all four matching crystals to activate a ruin', () => {
    const s = createState();
    ['tide-0', 'tide-1', 'tide-2', 'grove-0'].forEach(id => collectCrystal(s, id));
    expect(activateRuin(s, 'tide')).toBe(false);
    collectCrystal(s, 'tide-3');
    expect(activateRuin(s, 'tide')).toBe(true);
    expect(activateRuin(s, 'tide')).toBe(false);
    expect(s.active).toEqual(['tide']);
    expect(completed(s)).toBe(false);
  });
  it('completes only after activating all three ruins and resets independently', () => {
    const s = createState();
    CRYSTALS.forEach(c => collectCrystal(s, c.id));
    expect(completed(s)).toBe(false);
    RUINS.forEach(r => activateRuin(s, r.id));
    expect(completed(s)).toBe(true);
    expect(createState().collected).toEqual([]);
    expect(createState().active).toEqual([]);
  });
});

describe('local save recovery', () => {
  it('round trips progress, safe position and settings', () => {
    const s = createState();
    CRYSTALS.filter(c => c.ruin === 'tide').forEach(c => collectCrystal(s, c.id));
    activateRuin(s, 'tide');
    s.position = [20, 100]; s.sound = false; s.quality = 'low';
    expect(parseSave(encodeSave(s))).toEqual(s);
  });
  it.each([null, '', '{broken', 'null', '[]', '{"version":99}', '{"version":1,"collected":null,"active":42}'])('recovers from malformed save %s', raw => {
    expect(parseSave(raw).collected).toEqual([]);
    expect(parseSave(raw).active).toEqual([]);
    expect(parseSave(raw).position).toEqual(SPAWN);
  });
  it('deduplicates IDs, rejects impossible activations and unsafe positions', () => {
    const s = parseSave(JSON.stringify({version: 1, collected: ['tide-0', 'tide-0', 'fake'], active: ['tide', 'fake'], position: [900, 900], sound: 'yes', quality: 'ultra'}));
    expect(s.collected).toEqual(['tide-0']); expect(s.active).toEqual([]);
    expect(s.position).toEqual(SPAWN); expect(s.sound).toBe(true);
    expect(s.quality).toBe('auto');
  });
  it('continues safely when storage is denied', () => {
    expect(() => safeWrite({setItem: () => {throw new Error('denied');}}, createState())).not.toThrow();
    expect(safeWrite({setItem: () => {throw new Error('quota');}}, createState())).toBe(false);
  });
});

describe('navigable world', () => {
  it('places every objective and spawn above water on safe land', () => {
    for (const p of [SPAWN, ...CRYSTALS.map(c => c.position), ...RUINS.map(r => r.position)]) {
      expect(isSafe(p[0], p[1])).toBe(true);
      expect(terrainHeight(p[0], p[1])).toBeGreaterThan(0.8);
    }
  });
  it('blocks ocean and solid objects but allows movement and sliding', () => {
    expect(moveOnIsland([20, 100], [21, 100], [])).toEqual([21, 100]);
    expect(moveOnIsland([20, 100], [800, 800], [])).toEqual([20, 100]);
    expect(moveOnIsland([20, 100], [22, 100], [{x:22,z:100,radius:1}])).toEqual([20, 100]);
    expect(moveOnIsland([20, 100], [22, 102], [{x:22,z:102,radius:1}])).not.toEqual([22, 102]);
  });
});
