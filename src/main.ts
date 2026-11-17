import './style.css';
import { IslandWorld } from './world';
import { Input } from './input';
import { IslandMap } from './map';
import { IslandAudio } from './audio';
import { CRYSTALS, RUINS, SPAWN, SAVE_KEY, createState, loadState, safeWrite, collectCrystal, activateRuin, ruinCount, completed, type RuinId, type Quality } from './state';
import { terrainHeight } from './terrain';

const $=<T extends HTMLElement=HTMLElement>(id:string):T=>document.getElementById(id) as T;
let state=loadState();
let world:IslandWorld;
let input:Input;
let mode:'landing'|'playing'|'paused'|'reset'|'complete'|'error'='landing';
const audio=new IslandAudio();audio.setEnabled(state.sound);
const mobile=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
let nearby:RuinId|null=null;
let toastTimeout=0;
let savedAt=0;
let mapAt=0;
let started=false;
let completionAcknowledged=completed(state);
const hasJourney=()=>state.collected.length>0||Math.hypot(state.position[0]-SPAWN[0],state.position[1]-SPAWN[1])>.5;
const show=(id:string,visible:boolean)=>{$(id).hidden=!visible;};
function toast(message:string):void {
  $('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimeout);
  toastTimeout=window.setTimeout(()=>$('toast').classList.remove('visible'),3700);
}
function persist():void {
  if(world&&mode==='playing')state.position=world.safePosition;
  let ok=false;try{ok=safeWrite(localStorage,state);}catch{/* Storage access itself can be denied. */}
  $('save-indicator').innerHTML=ok?'<span class="status-dot"></span> 已自动保存':'本次进度仅暂存，请保持页面开启';
}
function updateSound():void {
  audio.setEnabled(state.sound);$('sound').setAttribute('aria-label',state.sound?'关闭声音':'开启声音');
  $('sound-icon').textContent=state.sound?'♫':'♪';$('sound').classList.toggle('muted',!state.sound);
  $('modal-sound').textContent=state.sound?'已开启':'已关闭';$('modal-sound').setAttribute('aria-pressed',String(state.sound));
}
function updateProgress():void {
  $('crystal-count').textContent=String(state.collected.length);$('ruin-count').textContent=String(state.active.length);
  $('progress-fill').style.width=`${state.collected.length/12*100}%`;
  $('journey-status').textContent=completed(state)?'小岛已被唤醒':'旅程进行中';
  $('ruin-list').innerHTML=RUINS.map(r=>{const active=state.active.includes(r.id),count=ruinCount(state,r.id);return `<div class="ruin-row" style="color:#${r.color.toString(16)}"><i class="ruin-dot ${active?'active':''}"></i><span>${r.name}</span><small class="${count===4?'ready':''}">${active?'已唤醒 ✓':count===4?'可前往唤醒':`${count} / 4 水晶`}</small></div>`;}).join('');
  world?.sync(state);
}
function hideModals():void {for(const id of ['pause-modal','complete-modal','reset-modal'])show(id,false);}
function setPlay():void {
  const first=!started;hideModals();mode='playing';started=true;input.clear();input.enabled=true;if(first)world.snapCamera();
  show('landing',false);show('hud',true);show('pause',true);show('touch-controls',mobile);document.body.classList.add('playing');
  (document.activeElement as HTMLElement)?.blur();audio.setPlaying(true);void audio.unlock();persist();
}
function pause():void {
  if(mode==='landing'||mode==='error')return;
  if(mode==='reset'){cancelReset();return;}
  if(mode==='paused'){setPlay();return;}
  if(mode==='complete')return;
  persist();mode='paused';input.enabled=false;input.clear();audio.setPlaying(false);
  show('touch-controls',false);show('interact',false);show('nearby-hint',false);show('pause-modal',true);
  $<HTMLSelectElement>('quality').value=state.quality;$('resume').focus();
}
function cancelReset():void{mode='paused';show('reset-modal',false);show('pause-modal',true);$('reset').focus();}
function interact():void {
  if(mode!=='playing'||!nearby)return;
  const r=RUINS.find(r=>r.id===nearby)!;
  if(!activateRuin(state,r.id)){toast(`${r.name}需要这片区域的 4 枚水晶`);return;}
  updateProgress();persist();audio.chime(true);toast(`${r.name}已被唤醒 · 一束光，连向天空`);
  if(completed(state)&&!completionAcknowledged){completionAcknowledged=true;persist();mode='complete';input.enabled=false;input.clear();show('touch-controls',false);show('interact',false);show('nearby-hint',false);show('complete-modal',true);$('continue').focus();}
}
function error(message?:string):void {
  mode='error';if(input){input.enabled=false;input.clear();}audio.setPlaying(false);hideModals();
  show('landing',false);show('hud',false);show('touch-controls',false);show('interact',false);show('nearby-hint',false);show('error-modal',true);
  if(message)$('error-message').textContent=message;
}
$('reload').addEventListener('click',()=>location.reload());
$('sound').addEventListener('click',()=>{state.sound=!state.sound;updateSound();void audio.unlock();if(started)persist();});
$('modal-sound').addEventListener('click',()=>{state.sound=!state.sound;updateSound();void audio.unlock();persist();});
$('start').addEventListener('click',()=>{setPlay();toast(state.collected.length?'海风还在，欢迎继续你的旅程。':mobile?'左侧摇杆移动，右侧拖动环顾。跟着地图寻找水晶吧。':'WASD 移动，拖动鼠标环顾。前方亮着的，是第一枚水晶。');});
$('pause').addEventListener('click',pause);$('resume').addEventListener('click',setPlay);$('continue').addEventListener('click',setPlay);
$('interact').addEventListener('click',interact);
$('reset').addEventListener('click',()=>{mode='reset';show('pause-modal',false);show('reset-modal',true);$('cancel-reset').focus();});
$('cancel-reset').addEventListener('click',cancelReset);
$('confirm-reset').addEventListener('click',()=>{
  const {sound,quality}=state;state=createState();state.sound=sound;state.quality=quality;completionAcknowledged=false;
  world.resetPosition(SPAWN);world.snapCamera();updateProgress();setPlay();toast('新的旅程，从一阵海风开始。');
});
$('quality').addEventListener('change',()=>{state.quality=$<HTMLSelectElement>('quality').value as Quality;world.setQuality(state.quality);persist();});
$('pause-modal').addEventListener('click',e=>{if(e.target===$('pause-modal'))setPlay();});
// Keep keyboard focus within the visible dialog.
window.addEventListener('keydown',e=>{
  if(e.code!=='Tab')return;
  const modal=[...document.querySelectorAll<HTMLElement>('.modal')].find(el=>!el.hidden);if(!modal)return;
  const nodes=[...modal.querySelectorAll<HTMLElement>('button,select,[tabindex="0"]')].filter(el=>!el.hasAttribute('disabled'));
  const first=nodes[0],last=nodes.at(-1);if(!first||!last)return;
  if(e.shiftKey&&(document.activeElement===first||!modal.contains(document.activeElement))){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&(document.activeElement===last||!modal.contains(document.activeElement))){e.preventDefault();first.focus();}
});
window.addEventListener('resize',()=>world?.resize());
window.addEventListener('pagehide',()=>{if(started)persist();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause();});
window.addEventListener('blur',()=>{if(mode==='playing')pause();});
$('world').addEventListener('webglcontextlost',e=>{e.preventDefault();if(started)persist();error('3D 图形连接暂时中断。已尝试保存进度，请重新加载；如果反复出现，可降低画质或关闭其他占用图形资源的页面。');});

async function init():Promise<void>{
  $<HTMLButtonElement>('start').disabled=true;updateSound();
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  try {
    world=new IslandWorld($<HTMLCanvasElement>('world'),state);
    input=new Input($<HTMLCanvasElement>('world'),(x,y)=>world.look(x,y),interact,pause,delta=>world.zoom(delta));
    const map=new IslandMap($<HTMLCanvasElement>('minimap'));
    updateProgress();
    if(hasJourney()){$('start').innerHTML='继续旅程 <span aria-hidden="true">↗</span>';$('save-note').textContent=`旅程已保存 · 已找到 ${state.collected.length} / 12 枚水晶`;}
    let previous=performance.now(),elapsed=0,slowFrames=0,adapted=false;
    let lastNear='';
    const frame=(now:number)=>{
      if(mode==='error')return;
      const wallDelta=(now-previous)/1000;
      const dt=Math.min(wallDelta,.1);previous=now;elapsed+=dt;
      if(state.quality==='auto'&&!adapted){slowFrames=wallDelta>.085?slowFrames+1:Math.max(0,slowFrames-1);if(slowFrames>=8){world.setQuality('low');adapted=true;}}
      const playing=mode==='playing';
      if(playing||mode==='landing')world.step(dt,elapsed,playing,input.sample(),mode==='landing');
      if(playing){
        const [x,z]=world.position;
        for(const c of CRYSTALS){if(!state.collected.includes(c.id)&&Math.hypot(c.position[0]-x,c.position[1]-z)<2.5&&Math.abs(world.player.position.y-terrainHeight(...c.position))<4){
          if(collectCrystal(state,c.id)){updateProgress();persist();audio.chime();const r=RUINS.find(r=>r.id===c.ruin)!;toast(`◇ 风之水晶 ${state.collected.length} / 12 · ${r.name} ${ruinCount(state,r.id)} / 4`);}
        }}
        const nearest=RUINS.find(r=>Math.hypot(r.position[0]-x,r.position[1]-z)<6.3&&!state.active.includes(r.id));
        nearby=nearest?.id??null;const key=nearest?`${nearest.id}-${ruinCount(state,nearest.id)}`:'';
        if(key!==lastNear){lastNear=key;show('interact',false);show('nearby-hint',false);
          if(nearest){if(ruinCount(state,nearest.id)===4){$('interact').innerHTML=`${mobile?'':'<kbd>E</kbd>'}<span>唤醒${nearest.name}</span>`;$('interact').setAttribute('aria-label',`唤醒${nearest.name}`);show('interact',true);}else{$('nearby-hint').textContent=`${nearest.name} · 还需要 ${4-ruinCount(state,nearest.id)} 枚对应水晶`;show('nearby-hint',true);}}
        }
        const region=Math.hypot(x-65,z+45)<58?'日光山丘':x<0&&z<43?'森语林地':z>63?'风起海滩':'风息草甸';
        if($('region-name').textContent!==region)$('region-name').textContent=region;
        if(now-savedAt>1000){persist();savedAt=now;}
      }else lastNear='__refresh__';
      if(elapsed-mapAt>.12){map.draw(state,world.position,world.heading,elapsed);mapAt=elapsed;}
      requestAnimationFrame(frame);
    };
    frame(performance.now());show('loading',false);$<HTMLButtonElement>('start').disabled=false;
  }catch(e){console.error('Unable to open Wind Island',e);error();}
}
void init();
