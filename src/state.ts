import { isSafe, type Position } from './terrain';
export const SAVE_KEY = 'wind-island-v1';
export const SPAWN: Position = [18,130];
export type RuinId = 'tide' | 'grove' | 'summit';
export interface Ruin { id: RuinId; name: string; subtitle: string; position: Position; color: number }
export const RUINS: Ruin[] = [
  {id:'tide',name:'潮汐遗迹',subtitle:'沿着海风，去往西岸',position:[-78,78],color:0x60e6df},
  {id:'grove',name:'森语遗迹',subtitle:'在树影深处，听见回响',position:[-60,-58],color:0xb7e990},
  {id:'summit',name:'日光遗迹',subtitle:'登上山坡，追逐日光',position:[65,-45],color:0xffcb75},
];
export interface Crystal { id:string; ruin:RuinId; position:Position }
export const CRYSTALS: Crystal[] = [
  {id:'tide-0',ruin:'tide',position:[8,115]}, {id:'tide-1',ruin:'tide',position:[-24,102]},
  {id:'tide-2',ruin:'tide',position:[-61,116]}, {id:'tide-3',ruin:'tide',position:[-104,66]},
  {id:'grove-0',ruin:'grove',position:[-99,22]}, {id:'grove-1',ruin:'grove',position:[-96,-33]},
  {id:'grove-2',ruin:'grove',position:[-40,-86]}, {id:'grove-3',ruin:'grove',position:[-25,-23]},
  {id:'summit-0',ruin:'summit',position:[12,15]}, {id:'summit-1',ruin:'summit',position:[61,9]},
  {id:'summit-2',ruin:'summit',position:[98,-55]}, {id:'summit-3',ruin:'summit',position:[51,-91]},
];
export type Quality = 'auto' | 'low' | 'high';
export interface GameState { version:1; collected:string[]; active:RuinId[]; position:Position; sound:boolean; quality:Quality }
export const createState = ():GameState => ({version:1,collected:[],active:[],position:[...SPAWN],sound:true,quality:'auto'});
export function collectCrystal(s:GameState,id:string):boolean {
  if(!CRYSTALS.some(c=>c.id===id)||s.collected.includes(id)) return false;
  s.collected.push(id); return true;
}
export function ruinCount(s:GameState,id:RuinId):number {return CRYSTALS.filter(c=>c.ruin===id&&s.collected.includes(c.id)).length;}
export function activateRuin(s:GameState,id:RuinId):boolean {
  if(!RUINS.some(r=>r.id===id)||s.active.includes(id)||ruinCount(s,id)!==4)return false;
  s.active.push(id);return true;
}
export function completed(s:GameState):boolean {return RUINS.every(r=>s.active.includes(r.id));}
export function encodeSave(s:GameState):string {return JSON.stringify(s);}
export function parseSave(raw:string|null):GameState {
  const s=createState();
  try {
    const v=JSON.parse(raw??'null'); if(!v||v.version!==1)return s;
    if(Array.isArray(v.collected))s.collected=[...new Set<string>(v.collected.filter((id:unknown)=>typeof id==='string'&&CRYSTALS.some(c=>c.id===id)))];
    if(Array.isArray(v.active))for(const id of v.active)activateRuin(s,id);
    if(Array.isArray(v.position)&&v.position.length===2&&v.position.every((n:unknown)=>typeof n==='number')&&isSafe(v.position[0],v.position[1]))s.position=[v.position[0],v.position[1]];
    if(typeof v.sound==='boolean')s.sound=v.sound;
    if(['auto','low','high'].includes(v.quality))s.quality=v.quality;
  } catch { /* Broken or unavailable storage is a new journey. */ }
  return s;
}
export function safeWrite(storage:Pick<Storage,'setItem'>,s:GameState):boolean {
  try{storage.setItem(SAVE_KEY,encodeSave(s));return true;}catch{return false;}
}
export function loadState():GameState {try{return parseSave(localStorage.getItem(SAVE_KEY));}catch{return createState();}}
