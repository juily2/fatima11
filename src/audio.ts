export class IslandAudio {
  private context:AudioContext|null=null;
  private master:GainNode|null=null;
  enabled=true;
  private playing=false;
  async unlock():Promise<void>{
    try {
      if(!this.context){
        this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=0;this.master.connect(this.context.destination);
        const buffer=this.context.createBuffer(1,this.context.sampleRate*4,this.context.sampleRate);const values=buffer.getChannelData(0);let brown=0;
        for(let i=0;i<values.length;i++){brown=(brown+(Math.random()*2-1)*.025)/1.02;values[i]=brown*3;}
        const sea=this.context.createBufferSource();sea.buffer=buffer;sea.loop=true;
        const filter=this.context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=650;
        sea.connect(filter);filter.connect(this.master);sea.start();
      }
      if(this.context.state==='suspended')await this.context.resume();this.update();
    } catch { /* Silent play remains available when browser audio is denied. */ }
  }
  setPlaying(playing:boolean):void{this.playing=playing;this.update();}
  private update():void{if(this.master&&this.context)this.master.gain.setTargetAtTime(this.enabled&&this.playing?.16:0,this.context.currentTime,.3);}
  setEnabled(enabled:boolean):void{this.enabled=enabled;this.update();}
  chime(ruin=false):void {
    if(!this.context||!this.master||!this.enabled)return;
    const ctx=this.context;
    const notes=ruin?[261.63,329.63,392,523.25,659.25]:[659.25,880,1318.5];
    notes.forEach((freq,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=freq;const t=ctx.currentTime+i*.11;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.45,t+.02);gain.gain.exponentialRampToValueAtTime(.001,t+1.7);osc.connect(gain);gain.connect(this.master!);osc.start(t);osc.stop(t+1.8);});
  }
}
