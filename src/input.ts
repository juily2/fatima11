import type { Motion } from './world';
export class Input {
  private keys=new Set<string>();
  private stick={x:0,y:0};
  private jumpRequested=false;
  private sprint=false;
  private dragging:number|null=null;
  private lastX=0;private lastY=0;
  enabled=false;
  constructor(canvas:HTMLCanvasElement,onLook:(x:number,y:number)=>void,onInteract:()=>void,onPause:()=>void,onZoom:(delta:number)=>void){
    const editable=()=>['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName??'');
    window.addEventListener('keydown',e=>{
      if(e.code==='Escape'){e.preventDefault();if(!e.repeat)onPause();return;}
      if(!this.enabled||editable())return;
      if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyE'].includes(e.code))e.preventDefault();
      this.keys.add(e.code);if(e.code==='Space'&&!e.repeat)this.jumpRequested=true;if(e.code==='KeyE'&&!e.repeat)onInteract();
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>this.clear());
    const bindLook=(el:HTMLElement)=>{
      el.addEventListener('pointerdown',e=>{if(!this.enabled||this.dragging!==null||e.button!==0)return;this.dragging=e.pointerId;this.lastX=e.clientX;this.lastY=e.clientY;el.setPointerCapture(e.pointerId);});
      el.addEventListener('pointermove',e=>{if(this.dragging!==e.pointerId||!this.enabled)return;onLook(e.clientX-this.lastX,e.clientY-this.lastY);this.lastX=e.clientX;this.lastY=e.clientY;});
      const stop=(e:PointerEvent)=>{if(e.pointerId===this.dragging)this.dragging=null;};
      el.addEventListener('pointerup',stop);el.addEventListener('pointercancel',stop);el.addEventListener('lostpointercapture',stop);
    };
    bindLook(canvas);bindLook(document.getElementById('look-zone')!);
    canvas.addEventListener('wheel',e=>{if(this.enabled){e.preventDefault();onZoom(e.deltaY);}},{passive:false});
    const stick=document.getElementById('joystick')!,knob=document.getElementById('joystick-knob')!;
    let id:number|null=null;
    const set=(e:PointerEvent)=>{const b=stick.getBoundingClientRect(),max=b.width*.33;let x=e.clientX-b.x-b.width/2,y=e.clientY-b.y-b.height/2;const len=Math.hypot(x,y);if(len>max){x=x/len*max;y=y/len*max;}this.stick={x:x/max,y:-y/max};knob.style.transform=`translate(${x}px,${y}px)`;};
    stick.addEventListener('pointerdown',e=>{if(!this.enabled||id!==null)return;id=e.pointerId;stick.setPointerCapture(id);set(e);e.preventDefault();});
    stick.addEventListener('pointermove',e=>{if(id===e.pointerId&&this.enabled)set(e);});
    const release=(e:PointerEvent)=>{if(id!==e.pointerId)return;id=null;this.stick={x:0,y:0};knob.style.transform='';};
    stick.addEventListener('pointerup',release);stick.addEventListener('pointercancel',release);stick.addEventListener('lostpointercapture',release);
    document.getElementById('jump')!.addEventListener('pointerdown',e=>{if(this.enabled){this.jumpRequested=true;e.preventDefault();}});
    document.getElementById('run')!.addEventListener('click',()=>{if(this.enabled){this.sprint=!this.sprint;document.getElementById('run')!.setAttribute('aria-pressed',String(this.sprint));}});
  }
  clear():void {this.keys.clear();this.stick={x:0,y:0};this.jumpRequested=false;this.sprint=false;this.dragging=null;document.getElementById('joystick-knob')!.style.transform='';document.getElementById('run')!.setAttribute('aria-pressed','false');}
  sample():Motion {
    if(!this.enabled)return {forward:0,right:0,jump:false,sprint:false};
    const k=(...codes:string[])=>codes.some(c=>this.keys.has(c))?1:0;
    const result={forward:k('KeyW','ArrowUp')-k('KeyS','ArrowDown')+this.stick.y,right:k('KeyD','ArrowRight')-k('KeyA','ArrowLeft')+this.stick.x,jump:this.jumpRequested,sprint:this.sprint||!!k('ShiftLeft','ShiftRight')};
    this.jumpRequested=false;return result;
  }
}
