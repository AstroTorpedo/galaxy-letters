/** Display-only limits; inputs and scientific measurements are never modified. */
export function spectrumBounds(profile:number[],rms:number,commonMaximum?:number,zoom=1){
  const finite=profile.filter(Number.isFinite),sigma=Math.max(Number.isFinite(rms)?rms:0,1e-8);
  let minimum:number,maximum:number;
  if(commonMaximum!==undefined&&Number.isFinite(commonMaximum)&&commonMaximum>0){maximum=commonMaximum;minimum=-maximum*.25;}
  else{
    const low=Math.min(-3*sigma,...finite),high=Math.max(3*sigma,...finite),padding=Math.max((high-low)*.08,sigma*.5);
    minimum=low-padding;maximum=high+padding;
  }
  const factor=Math.max(.25,Math.min(16,Number.isFinite(zoom)?zoom:1));minimum/=factor;maximum/=factor;
  return {minimum,maximum,clipped:finite.some(v=>v<minimum||v>maximum),hasData:finite.length>0};
}
