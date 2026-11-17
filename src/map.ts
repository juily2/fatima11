import { CRYSTALS, RUINS, SPAWN, type GameState } from './state';
import { terrainHeight, coastRadius, type Position } from './terrain';
export class IslandMap {
  private ctx:CanvasRenderingContext2D;
  private base:HTMLCanvasElement;
  constructor(private canvas:HTMLCanvasElement){
    this.ctx=canvas.getContext('2d')!;this.base=document.createElement('canvas');this.base.width=this.base.height=340;
    const c=this.base.getContext('2d')!;c.fillStyle='#1b4742';c.fillRect(0,0,340,340);
    c.strokeStyle='#d8e7b00d';c.lineWidth=1;
    for(let x=10;x<340;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,340);c.stroke();c.beginPath();c.moveTo(0,x);c.lineTo(340,x);c.stroke();}
    for(let x=0;x<340;x+=3)for(let z=0;z<340;z+=3){const wx=(x-170)/.83,wz=(z-170)/.83;if(Math.hypot(wx,wz)>coastRadius(Math.atan2(wz,wx)))continue;const h=terrainHeight(wx,wz);c.fillStyle=h<4?'#9fae7c':h<14?'#678962':h<30?'#7d966a':'#a4ac7c';c.fillRect(x,z,3.5,3.5);}
    c.strokeStyle='#dce9b928';c.lineWidth=1;c.setLineDash([3,6]);c.beginPath();c.moveTo(...this.point(SPAWN));for(const r of RUINS)c.lineTo(...this.point(r.position));c.stroke();c.setLineDash([]);
  }
  private point(p:Position):Position{return [170+p[0]*.83,170+p[1]*.83];}
  draw(state:GameState,p:Position,heading:number,time:number):void {
    const c=this.ctx;c.clearRect(0,0,340,340);c.drawImage(this.base,0,0);
    for(const crystal of CRYSTALS){if(state.collected.includes(crystal.id))continue;const [x,y]=this.point(crystal.position);c.save();c.translate(x,y);c.rotate(Math.PI/4);c.strokeStyle='#f1e5a5';c.lineWidth=1.6;c.strokeRect(-2.4,-2.4,4.8,4.8);c.restore();}
    for(const r of RUINS){const [x,y]=this.point(r.position);c.beginPath();c.arc(x,y,7,0,Math.PI*2);c.strokeStyle=state.active.includes(r.id)?'#e8edab':'#e9e6bd90';c.lineWidth=1.6;c.stroke();c.fillStyle=state.active.includes(r.id)?'#e8edab':'#c3cfac';c.beginPath();c.arc(x,y,3,0,Math.PI*2);c.fill();}
    const [x,y]=this.point(p);c.save();c.translate(x,y);c.rotate(-heading);
    c.beginPath();c.moveTo(0,-18);c.lineTo(-10,-4);c.lineTo(10,-4);c.closePath();c.fillStyle='#edf5d42b';c.fill();
    c.shadowColor='#e4f2b8';c.shadowBlur=9;c.fillStyle='#edfacb';c.beginPath();c.moveTo(0,-7);c.lineTo(-4,5);c.lineTo(4,5);c.closePath();c.fill();c.restore();
    c.beginPath();c.arc(x,y,10+(Math.sin(time*2)+1)*2,0,Math.PI*2);c.strokeStyle='#e4efb944';c.lineWidth=1;c.stroke();
  }
}
