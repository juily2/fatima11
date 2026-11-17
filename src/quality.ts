/** One automatic downgrade per user-selected quality period. */
export class QualityMonitor {
  private slowFrames=0;
  private adapted=false;
  shouldLower(dt:number):boolean{
    if(this.adapted)return false;
    this.slowFrames=dt>.085?this.slowFrames+1:Math.max(0,this.slowFrames-1);
    if(this.slowFrames<8)return false;
    this.adapted=true;return true;
  }
  reset():void{this.slowFrames=0;this.adapted=false;}
}
