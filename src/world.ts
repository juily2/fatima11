import * as THREE from 'three';
import { CRYSTALS, RUINS, SPAWN, type GameState, type Quality } from './state';
import { GRID, WORLD_SIZE, rawHeight, terrainHeight, isSafe, moveOnIsland, recoverPosition, type Obstacle, type Position } from './terrain';

export interface Motion { forward:number; right:number; sprint:boolean; jump:boolean }
const Y = new THREE.Vector3(0,1,0);
const matCache = new Map<number,THREE.MeshStandardMaterial>();
function material(color:number):THREE.MeshStandardMaterial {
  let m=matCache.get(color); if(!m){m=new THREE.MeshStandardMaterial({color,roughness:0.95,flatShading:true});matCache.set(color,m);}return m;
}
const boxGeo = new THREE.BoxGeometry(1,1,1);
const crystalGeo = new THREE.OctahedronGeometry(1,0);
function mesh(geo:THREE.BufferGeometry,color:number,parent:THREE.Object3D,x=0,y=0,z=0,sx=1,sy=sx,sz=sx):THREE.Mesh {
  const o=new THREE.Mesh(geo,material(color));o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
}
function random(seed=71):()=>number {return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const dummy=new THREE.Object3D();
interface Instance {x:number;y:number;z:number;sx:number;sy:number;sz:number;ry?:number;rz?:number}
function instances(scene:THREE.Scene,geo:THREE.BufferGeometry,color:number,items:Instance[]):void {
  const o=new THREE.InstancedMesh(geo,material(color),items.length);
  items.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.ry??0,p.rz??0);dummy.scale.set(p.sx,p.sy,p.sz);dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix);});
  o.castShadow=true;o.receiveShadow=true;o.computeBoundingSphere();scene.add(o);
}

export class IslandWorld {
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,0.2,1800);
  readonly renderer:THREE.WebGLRenderer;
  readonly player=new THREE.Group();
  readonly obstacles:Obstacle[]=[];
  readonly crystals=new Map<string,THREE.Group>();
  readonly beacons=new Map<string,{group:THREE.Group;gem:THREE.Mesh;beam:THREE.Mesh;ring:THREE.Mesh}>();
  private readonly sun:THREE.DirectionalLight;
  private readonly limbs:THREE.Group[]=[];
  private readonly scarf:THREE.Mesh;
  private readonly clouds=new THREE.Group();
  private readonly gulls=new THREE.Group();
  private readonly ocean:THREE.Mesh;
  private readonly motes:THREE.Points;
  private readonly glowTex:THREE.CanvasTexture;
  private jumpVelocity=0;
  private ground=true;
  private yaw=0;
  private pitch=0.35;
  private distance=12;
  private walking=0;
  private readonly cameraTarget=new THREE.Vector3();
  private readonly desiredCamera=new THREE.Vector3();
  private lastSafe:Position=[...SPAWN];
  private moving=false;
  private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  private activeCount=0;
  private mobile=matchMedia('(pointer:coarse)').matches;

  constructor(canvas:HTMLCanvasElement,state:GameState){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.12;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.scene.background=new THREE.Color(0x9fcac8);
    this.scene.fog=new THREE.Fog(0x9fcac8,180,580);
    this.scene.add(new THREE.HemisphereLight(0xdbf5ed,0x486848,2.4));
    this.sun=new THREE.DirectionalLight(0xffebc7,3.5);this.sun.position.set(-100,160,85);
    this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.camera.left=-46;this.sun.shadow.camera.right=46;
    this.sun.shadow.camera.top=46;this.sun.shadow.camera.bottom=-46;this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=360;
    this.sun.shadow.bias=-0.001;this.sun.shadow.normalBias=0.18;this.scene.add(this.sun,this.sun.target);
    this.scene.add(new THREE.AmbientLight(0xc8dfb8,0.2));
    this.glowTex=this.createGlow();
    this.buildTerrain();
    this.ocean=this.buildOcean();
    this.buildNature();
    this.buildLandmarks();
    this.buildCrystals();
    this.buildClouds();
    this.buildBirds();
    this.buildExplorer();
    this.scarf=this.player.getObjectByName('scarf') as THREE.Mesh;
    this.scene.add(this.player);
    this.motes=this.buildMotes();
    this.resetPosition(state.position);
    this.camera.position.set(242,186,266);this.camera.lookAt(0,10,0);
    this.setQuality(state.quality);this.sync(state);
  }
  private createGlow():THREE.CanvasTexture {
    const c=document.createElement('canvas');c.width=c.height=64;
    const ctx=c.getContext('2d')!;const g=ctx.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.18,'rgba(255,255,255,.65)');g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);
  }
  private glow(parent:THREE.Object3D,color:number,size:number,y:number,opacity=.5):void {
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:this.glowTex,color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending}));sprite.position.y=y;sprite.scale.set(size,size,1);parent.add(sprite);
  }
  private buildTerrain():void {
    const geo=new THREE.PlaneGeometry(WORLD_SIZE,WORLD_SIZE,GRID,GRID);geo.rotateX(-Math.PI/2);
    const positions=geo.attributes.position;const colors=new Float32Array(positions.count*3);const c=new THREE.Color();const rng=random(121);
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),z=positions.getZ(i),h=rawHeight(x,z);positions.setY(i,h);
      if(h<0.9)c.set(0xedd5a0);else if(h<3.8)c.set(0xdcc88c);else if(h<6.4)c.set(0xa3b77b);else if(h<16)c.set(0x809e65);else if(h<33)c.set(0x97a875);else c.set(0xb0b28a);
      c.multiplyScalar(.93+rng()*.14);colors.set([c.r,c.g,c.b],i*3);
    }
    geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.computeVertexNormals();
    const land=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1}));land.receiveShadow=true;this.scene.add(land);
    // Small stepping stones draw the eye from the shore toward the first crystal.
    for(let i=0;i<10;i++){const x=18-i*1.0,z=134-i*1.8;mesh(new THREE.CylinderGeometry(1,1.1,.15,6),0xc4c5a0,this.scene,x,terrainHeight(x,z)+.04,z,.6,.7,.45);}
  }
  private buildOcean():THREE.Mesh {
    const ocean=new THREE.Mesh(new THREE.PlaneGeometry(6000,6000),new THREE.ShaderMaterial({
      uniforms:{time:{value:0},fogColor:{value:new THREE.Color(0x9fcac8)}},
      vertexShader:`varying vec3 vWorld; void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
      fragmentShader:`uniform float time; uniform vec3 fogColor; varying vec3 vWorld;void main(){float d=length(vWorld.xz);float a=atan(vWorld.z,vWorld.x);float coast=177.+15.*sin(a*3.+.5)+10.*cos(a*5.-.8);float edge=d-coast;vec3 deep=vec3(.10,.40,.43);vec3 shallow=vec3(.26,.66,.64);vec3 col=mix(shallow,deep,smoothstep(0.,170.,edge));float w=sin(vWorld.x*.37+vWorld.z*.23+time*.65)*sin(vWorld.z*.52-vWorld.x*.12-time*.38);col+=vec3(.12,.17,.12)*pow(max(0.,w),10.)*.45;float foam=smoothstep(.84,.97,sin(edge*1.15-time*.8))*exp(-max(edge,0.)*.10)*step(0.,edge);col=mix(col,vec3(.81,.89,.75),foam*.65);float dist=length(cameraPosition-vWorld);col=mix(col,fogColor,smoothstep(160.,850.,dist));gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace('1.);#include','1.);\n#include'),
    }));
    ocean.rotation.x=-Math.PI/2;ocean.position.y=.12;this.scene.add(ocean);return ocean;
  }
  private clearOfGoals(x:number,z:number,margin=9):boolean {
    return [...RUINS.map(r=>r.position),...CRYSTALS.map(c=>c.position),SPAWN].every(p=>Math.hypot(x-p[0],z-p[1])>margin);
  }
  private buildNature():void {
    const rng=random();
    const trunks:Instance[]=[],leaves1:Instance[]=[],leaves2:Instance[]=[],leaves3:Instance[]=[],rocks:Instance[]=[],bushes:Instance[]=[],palmTrunks:Instance[]=[],palms:Instance[]=[],flowers:Instance[]=[];
    for(let i=0;i<320;i++){
      const x=(rng()-.5)*330,z=(rng()-.5)*330,h=terrainHeight(x,z);
      if(!isSafe(x,z)||h<4.6||!this.clearOfGoals(x,z)||Math.hypot(x-55,z+40)<35)continue;
      const s=.7+rng()*.75;const forest=(x<10&&z<55);if(!forest&&rng()>.35)continue;
      trunks.push({x,y:h+3.7*s,z,sx:.44*s,sy:7.4*s,sz:.44*s});
      leaves1.push({x,y:h+6.3*s,z,sx:4*s,sy:6.5*s,sz:4*s});
      leaves2.push({x,y:h+9.6*s,z,sx:3*s,sy:5.5*s,sz:3*s});
      leaves3.push({x,y:h+12*s,z,sx:1.9*s,sy:4.7*s,sz:1.9*s});
      this.obstacles.push({x,z,radius:.5*s});
    }
    const cylinder=new THREE.CylinderGeometry(.7,1,1,6);const cone=new THREE.ConeGeometry(1,1,7);
    instances(this.scene,cylinder,0x6b6048,trunks);instances(this.scene,cone,0x426f58,leaves1);instances(this.scene,cone,0x58866a,leaves2);instances(this.scene,cone,0x6f9875,leaves3);
    for(let i=0;i<70;i++){
      const a=rng()*Math.PI*2,r=130+rng()*33,x=Math.cos(a)*r,z=Math.sin(a)*r,h=terrainHeight(x,z);
      if(h<1.5||h>7||!this.clearOfGoals(x,z,11))continue;
      const s=.75+rng()*.55;palmTrunks.push({x,y:h+4*s,z,sx:.35*s,sy:8*s,sz:.35*s,rz:.13});
      for(let j=0;j<6;j++){const a=j*Math.PI/3;palms.push({x:x-0.7+Math.cos(a)*2.5*s,y:h+8*s,z:z+Math.sin(a)*2.5*s,sx:4*s,sy:.4*s,sz:1.15*s,ry:-a,rz:-.23});}
      this.obstacles.push({x,z,radius:.5});
    }
    instances(this.scene,cylinder,0x8d7955,palmTrunks);instances(this.scene,new THREE.SphereGeometry(1,5,3),0x65956a,palms);
    for(let i=0;i<200;i++){
      const x=(rng()-.5)*365,z=(rng()-.5)*365,h=terrainHeight(x,z);if(h<1.1||!this.clearOfGoals(x,z,8))continue;
      const s=.7+rng()*2.4;rocks.push({x,y:h+s*.35,z,sx:s,sy:s*.7,sz:s*.8,ry:rng()*6});
      this.obstacles.push({x,z,radius:s*.8});
    }
    instances(this.scene,new THREE.IcosahedronGeometry(1,0),0x929b86,rocks);
    for(let i=0;i<300;i++){
      const x=(rng()-.5)*320,z=(rng()-.5)*320,h=terrainHeight(x,z);if(h<4.5||!this.clearOfGoals(x,z,3))continue;
      bushes.push({x,y:h+.5,z,sx:.5+rng()*.9,sy:.6+rng()*.7,sz:.7+rng()*.7,ry:rng()*6});
      if(i%3===0)flowers.push({x:x+.4,y:h+.8,z,sx:.17,sy:.28,sz:.17});
    }
    instances(this.scene,new THREE.IcosahedronGeometry(1,0),0x859f60,bushes);instances(this.scene,crystalGeo,0xf2d7a4,flowers);
    this.buildCamp();
  }
  private buildCamp():void {
    const x=24,z=134,h=terrainHeight(x,z);
    const pole=new THREE.Group();pole.position.set(x,h,z);this.scene.add(pole);
    mesh(new THREE.CylinderGeometry(.07,.10,5,6),0x79694a,pole,0,2.5,0);
    const flag=mesh(new THREE.BoxGeometry(1,1,1),0xf4d7a0,pole,.85,4.3,0,1.7,.8,.07);flag.rotation.z=-.12;
    mesh(boxGeo,0x866d4e,pole,0,2,0,3,.7,.2);
    const boat=new THREE.Group();boat.position.set(31,.55,159);boat.rotation.y=-.4;
    mesh(new THREE.CylinderGeometry(.3,.7,4.8,4),0x856346,boat,0,0,0,.8,1,.8).rotation.x=Math.PI/2;
    mesh(boxGeo,0xd6ba7f,boat,0,.25,0,1.7,.15,4);this.scene.add(boat);
  }
  private buildLandmarks():void {
    for(const r of RUINS){
      const group=new THREE.Group();group.position.set(r.position[0],terrainHeight(...r.position),r.position[1]);this.scene.add(group);
      mesh(new THREE.CylinderGeometry(6.7,7.3,.5,12),0x99a18a,group,0,.05,0);
      mesh(new THREE.CylinderGeometry(4.9,5.5,.2,12),0xb9b99a,group,0,.35,0);
      for(const side of [-1,1]){
        mesh(boxGeo,0xb3b69e,group,side*4,2.6,0,1.65,5.2,1.85);
        mesh(boxGeo,0xd1cbb0,group,side*4,5.25,0,2,.4,2.15);
        mesh(boxGeo,0x738971,group,side*4,1.3,0,1.72,.35,1.92);
        this.obstacles.push({x:r.position[0]+side*4,z:r.position[1],radius:.95});
      }
      mesh(new THREE.TorusGeometry(4,.75,5,12,Math.PI),0xc3c2a5,group,0,5.2,0);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(2.1,.045,4,48),new THREE.MeshBasicMaterial({color:r.color,transparent:true,opacity:.55}));ring.position.set(0,3.9,0);group.add(ring);
      const gem=new THREE.Mesh(crystalGeo,new THREE.MeshStandardMaterial({color:r.color,emissive:r.color,emissiveIntensity:.45,roughness:.3,metalness:.2}));gem.scale.set(.7,1.25,.7);gem.position.y=3.9;group.add(gem);
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(.55,1.5,85,12,1,true),new THREE.MeshBasicMaterial({color:r.color,transparent:true,opacity:.045,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));beam.position.y=44;group.add(beam);
      this.glow(group,r.color,9,4,.2);
      for(let i=0;i<7;i++){const a=i/7*Math.PI*2;mesh(new THREE.CylinderGeometry(.3,.42,1,5),0x95a58c,group,Math.cos(a)*8,.8,Math.sin(a)*8,.7,.7+i%3*.4,.7);}
      this.beacons.set(r.id,{group,gem,beam,ring});
    }
  }
  private buildCrystals():void {
    for(const c of CRYSTALS){
      const group=new THREE.Group();group.position.set(c.position[0],terrainHeight(...c.position),c.position[1]);
      const color=RUINS.find(r=>r.id===c.ruin)!.color;
      const gem=new THREE.Mesh(crystalGeo,new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.9,metalness:.1,roughness:.2,flatShading:true}));gem.position.y=2;gem.scale.set(.65,1.1,.65);group.add(gem);
      const halo=new THREE.Mesh(new THREE.RingGeometry(1.1,1.18,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,side:THREE.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.position.y=.13;group.add(halo);
      this.glow(group,color,4,2,.6);
      const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.025,.2,12,5,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.13,depthWrite:false}));shaft.position.y=6;group.add(shaft);
      this.scene.add(group);this.crystals.set(c.id,group);
    }
  }
  private buildClouds():void {
    const rng=random(449);const geo=new THREE.IcosahedronGeometry(1,1);
    const m=new THREE.MeshStandardMaterial({color:0xfff5dc,roughness:1,flatShading:true,transparent:true,opacity:.65});
    for(let i=0;i<18;i++){
      const cloud=new THREE.Group();cloud.position.set((rng()-.5)*1000,125+rng()*70,(rng()-.5)*900-160);
      for(let j=0;j<3;j++){const puff=new THREE.Mesh(geo,m);puff.position.x=j*11;puff.position.y=rng()*3;puff.scale.set(15+rng()*15,4+rng()*5,8+rng()*7);cloud.add(puff);}this.clouds.add(cloud);
    }this.scene.add(this.clouds);
  }
  private buildBirds():void {
    const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.2,.2,0),new THREE.Vector3(-.55,.5,0),new THREE.Vector3(0,0,0),new THREE.Vector3(.55,.5,0),new THREE.Vector3(1.2,.2,0)]);
    for(let i=0;i<9;i++){const bird=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xeff4d5}));bird.position.set(i*5,Math.sin(i)*2,i*3);this.gulls.add(bird);}this.scene.add(this.gulls);
  }
  private buildExplorer():void {
    // Explorer faces local -Z. Separate limb pivots make the walk readable.
    const bootGeo=new THREE.BoxGeometry(.23,.42,.3),armGeo=new THREE.BoxGeometry(.22,.54,.23);
    for(const side of [-1,1]){
      const leg=new THREE.Group();leg.position.set(side*.16,.7,0);mesh(bootGeo,0x3b4e43,leg,0,-.32,0);mesh(boxGeo,0x6f7a59,leg,0,-.12,0,.22,.35,.24);this.player.add(leg);this.limbs.push(leg);
      const arm=new THREE.Group();arm.position.set(side*.43,1.26,0);mesh(armGeo,0xdfd6af,arm,0,-.26,0);mesh(new THREE.SphereGeometry(.12,6,4),0xc5a67e,arm,0,-.55,0);this.player.add(arm);this.limbs.push(arm);
    }
    mesh(new THREE.CylinderGeometry(.34,.29,.66,6),0xe2dbbb,this.player,0,1.05,0);
    mesh(boxGeo,0xb56d40,this.player,0,1.17,.34,.48,.57,.28);
    mesh(boxGeo,0xd5b486,this.player,0,1.46,.39,.51,.12,.35);
    mesh(new THREE.SphereGeometry(.27,8,5),0xe1bc8e,this.player,0,1.61,-.02);
    mesh(new THREE.CylinderGeometry(.51,.52,.075,10),0xe6d19b,this.player,0,1.82,-.02);
    mesh(new THREE.CylinderGeometry(.31,.38,.26,8),0xddc58d,this.player,0,1.93,-.02);
    mesh(new THREE.CylinderGeometry(.36,.36,.06,8),0x5e735c,this.player,0,1.83,-.02);
    const scarf=mesh(boxGeo,0xc16d46,this.player,-.25,1.4,.17,.19,.07,.6);scarf.name='scarf';scarf.rotation.y=-.3;
  }
  private buildMotes():THREE.Points {
    const rng=random(13),p=new Float32Array(180*3);for(let i=0;i<180;i++){p[i*3]=(rng()-.5)*290;p[i*3+2]=(rng()-.5)*280;p[i*3+1]=terrainHeight(p[i*3],p[i*3+2])+1+rng()*12;}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(p,3));
    const pts=new THREE.Points(geo,new THREE.PointsMaterial({color:0xfff5bb,size:.22,map:this.glowTex,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending}));this.scene.add(pts);return pts;
  }
  setQuality(quality:Quality):void {
    const low=quality==='low'||(quality==='auto'&&this.mobile);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:1.75));
    this.renderer.shadowMap.enabled=!low;this.sun.castShadow=!low;
    this.motes.visible=!low;this.distance=this.mobile?13:12;
  }
  resize():void {this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);}
  look(dx:number,dy:number):void {this.yaw-=dx*.005;this.pitch=THREE.MathUtils.clamp(this.pitch+dy*.004,.05,.92);}
  zoom(delta:number):void {this.distance=THREE.MathUtils.clamp(this.distance+delta*.01,7,24);}
  resetPosition(p:Position):void {
    const pos=recoverPosition(p,SPAWN,this.obstacles);this.player.position.set(pos[0],terrainHeight(...pos),pos[1]);this.lastSafe=[...pos];this.jumpVelocity=0;this.ground=true;
  }
  snapCamera():void {
    const p=this.player.position;
    this.camera.position.set(p.x+Math.sin(this.yaw)*Math.cos(this.pitch)*this.distance,p.y+2.1+Math.sin(this.pitch)*this.distance,p.z+Math.cos(this.yaw)*Math.cos(this.pitch)*this.distance);
    this.camera.position.y=Math.max(this.camera.position.y,terrainHeight(this.camera.position.x,this.camera.position.z)+2);
    this.camera.lookAt(p.x,p.y+1.7,p.z);
  }
  get heading():number{return this.yaw;}
  get position():Position{return [this.player.position.x,this.player.position.z];}
  get safePosition():Position{return [...this.lastSafe];}
  sync(state:GameState):void {
    for(const [id,g] of this.crystals)g.visible=!state.collected.includes(id);
    this.activeCount=state.active.length;
    for(const [id,b]of this.beacons){const active=state.active.includes(id as typeof state.active[number]);(b.beam.material as THREE.MeshBasicMaterial).opacity=active?.2:.045;(b.gem.material as THREE.MeshStandardMaterial).emissiveIntensity=active?2:.35;(b.ring.material as THREE.MeshBasicMaterial).opacity=active?1:.35;}
  }
  step(dt:number,time:number,playing:boolean,input:Motion,menu:boolean):void {
    const p=this.player.position;
    if(playing){
      const length=Math.hypot(input.forward,input.right);this.moving=length>.05;
      if(this.moving){
        const f=input.forward/Math.max(1,length),r=input.right/Math.max(1,length);
        const dx=-Math.sin(this.yaw)*f+Math.cos(this.yaw)*r,dz=-Math.cos(this.yaw)*f-Math.sin(this.yaw)*r;
        const speed=input.sprint?15:8;const pos=moveOnIsland([p.x,p.z],[p.x+dx*dt*speed,p.z+dz*dt*speed],this.obstacles);
        p.x=pos[0];p.z=pos[1];const angle=Math.atan2(-dx,-dz);let diff=angle-this.player.rotation.y;diff=Math.atan2(Math.sin(diff),Math.cos(diff));this.player.rotation.y+=diff*Math.min(1,dt*12);
        this.walking+=dt*(input.sprint?15:10);
      }
      if(input.jump&&this.ground){this.jumpVelocity=8.5;this.ground=false;}
      const floor=terrainHeight(p.x,p.z);
      this.jumpVelocity-=22*dt;p.y+=this.jumpVelocity*dt;
      if(p.y<=floor){p.y=floor;this.jumpVelocity=0;this.ground=true;this.lastSafe=[p.x,p.z];}
      if(!isSafe(p.x,p.z)||p.y<-10||!Number.isFinite(p.y))this.resetPosition(this.lastSafe);
    }else this.moving=false;
    this.limbs.forEach((limb,i)=>{const phase=i<2?1:-1;const side=i%2===0?1:-1;limb.rotation.x=this.moving?Math.sin(this.walking)*.6*phase*side:THREE.MathUtils.lerp(limb.rotation.x,0,dt*8);});
    this.scarf.rotation.x=this.reduced?0:Math.sin(time*5)*.13;
    this.sun.position.set(p.x-85,p.y+125,p.z+65);this.sun.target.position.copy(p);
    if(menu){
      const angle=this.reduced?.77:.77+Math.sin(time*.035)*.08;
      const radius=this.mobile?370:360;this.desiredCamera.set(Math.sin(angle)*radius,this.mobile?205:195,Math.cos(angle)*radius);
      this.camera.position.lerp(this.desiredCamera,Math.min(1,dt*.8));this.camera.lookAt(this.mobile?0:-15,this.mobile?4:12,0);
    }else{
      this.cameraTarget.set(p.x,p.y+1.7,p.z);
      this.desiredCamera.set(p.x+Math.sin(this.yaw)*Math.cos(this.pitch)*this.distance,p.y+2.1+Math.sin(this.pitch)*this.distance,p.z+Math.cos(this.yaw)*Math.cos(this.pitch)*this.distance);
      // Raise the orbit over terrain and nearby solid decorations instead of clipping through them.
      this.desiredCamera.y=Math.max(this.desiredCamera.y,terrainHeight(this.desiredCamera.x,this.desiredCamera.z)+2);
      for(const o of this.obstacles){if(Math.hypot(this.desiredCamera.x-o.x,this.desiredCamera.z-o.z)<o.radius+1.5)this.desiredCamera.y=Math.max(this.desiredCamera.y,terrainHeight(o.x,o.z)+5);}
      this.camera.position.lerp(this.desiredCamera,1-Math.exp(-dt*6));this.camera.lookAt(this.cameraTarget);
    }
    for(const [id,g] of this.crystals){if(!g.visible)continue;const gem=g.children[0];gem.rotation.y=time*.7;gem.position.y=2+(this.reduced?0:Math.sin(time*2+id.length)*.3);}
    for(const b of this.beacons.values()){b.gem.rotation.y=time*.45;b.gem.position.y=3.9+(this.reduced?0:Math.sin(time*1.5)*.22);b.ring.rotation.z=time*.12;}
    if(!this.reduced){this.clouds.position.x=Math.sin(time*.005)*25;this.gulls.position.set(Math.cos(time*.04)*100,60+Math.sin(time*.11)*6,Math.sin(time*.04)*95);this.gulls.rotation.y=-time*.04;this.motes.position.y=Math.sin(time*.25)*.5;}
    (this.ocean.material as THREE.ShaderMaterial).uniforms.time.value=time;
    this.renderer.render(this.scene,this.camera);
  }
}
