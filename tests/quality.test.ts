import { expect, it } from 'vitest';
import { QualityMonitor } from '../src/quality';
it('adapts again after returning to automatic quality', () => {
  const m=new QualityMonitor();
  for(let i=0;i<7;i++)expect(m.shouldLower(.12)).toBe(false);
  expect(m.shouldLower(.12)).toBe(true);
  expect(m.shouldLower(.12)).toBe(false);
  m.reset();
  for(let i=0;i<7;i++)expect(m.shouldLower(.12)).toBe(false);
  expect(m.shouldLower(.12)).toBe(true);
});
it('does not lower quality for isolated slow frames',()=>{
  const m=new QualityMonitor();
  for(let i=0;i<40;i++){expect(m.shouldLower(.12)).toBe(false);expect(m.shouldLower(.016)).toBe(false);}
});
