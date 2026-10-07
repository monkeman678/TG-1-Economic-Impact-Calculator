/* Coordinate mission model. Cost constants are read only from A1:D21 of the supplied workbook. */
(function(root){
const source=typeof module!=='undefined'?require('./cost-source.json'):root.TG1_COST_SOURCE;
const C=source.cells;
const losses=typeof module!=="undefined"?require("./loss-data.json"):root.TG1_LOSS_DATA;
const defaults={area:C.D3,damage:C.D4*100,distance:3,speed:C.D9,distribution:'Clustered',state:'Maryland',seed:17};
const rate={chemical:C.D6,manualChemical:C.B6,uasChemical:C.C6,manualWage:C.B7,manualCrew:C.B8,manualCapacity:C.B9,uasWage:C.C7,uasCrew:C.C8,uasCapacity:C.C9,tg1Crew:C.D8,tg1TeamHourly:C.D7,lossPerAcre:C.B14};
function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const pathLength=p=>p.reduce((t,v,i)=>t+(i?length(p[i-1],v):0),0);
function plan(input){
 const o={...defaults,...input};
 const rate={...api.rate,...Object.fromEntries(Object.keys(api.rate).filter(k=>input&&k in input).map(k=>[k,input[k]]))};
 rate.tg1Crew=3;rate.tg1TeamHourly=C.D7;
 if(!input||!("lossPerAcre" in input))rate.lossPerAcre=losses.states[o.state]?.lossPerAcre??null;
 for(const k of ["chemical","manualChemical","uasChemical","manualWage","uasWage"])if(!Number.isFinite(rate[k])||rate[k]<0)throw new Error("Enter nonnegative pesticide costs and hourly wages.");
 for(const k of ["manualCapacity","uasCapacity"])if(!Number.isFinite(rate[k])||rate[k]<=0)throw new Error("Work rates must be greater than zero.");
 for(const k of ["manualCrew","uasCrew"])if(!Number.isInteger(rate[k])||rate[k]<1)throw new Error("Worker counts must be whole numbers of at least one.");
 if(rate.lossPerAcre!==null&&(!Number.isFinite(rate.lossPerAcre)||rate.lossPerAcre<0))throw new Error("Loss per acre must be zero or greater.");
 for(const k of ['area','damage','distance','speed'])if(!Number.isFinite(o[k]))throw new Error('Enter a number in each mission input.');
 if(o.area<=0||o.damage<0||o.damage>100||o.distance<0||o.distance>9||o.speed<=0||o.speed>45)throw new Error('Use a positive field area, 0–100% damage, 0–9 miles from ground control, and a flight speed above 0 and up to 45 mph.');
 if(!['Clustered','Random','Scattered'].includes(o.distribution))throw new Error('Select Clustered, Random, or Scattered damage.');

 const side=Math.sqrt(o.area/640),n=Math.max(1,Math.ceil(side/.1-1e-10)),total=n*n,count=o.damage===0?0:Math.max(1,Math.round(total*o.damage/100));
 const cells=Array.from({length:total},(_,id)=>({id,row:Math.floor(id/n),col:id%n,x:(id%n+.5)/n,y:(Math.floor(id/n)+.5)/n}));
 const rng=random(o.seed),chosen=[];
 if(o.distribution==='Random'){
  const pool=cells.slice();for(let i=pool.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}chosen.push(...pool.slice(0,count));
 }else if(o.distribution==='Clustered'){
  const start=Math.floor(rng()*total),seen=new Set([start]),queue=[start];let at=0;
  while(chosen.length<count&&at<queue.length){const id=queue[at++];chosen.push(cells[id]);const c=cells[id],next=[];if(c.col)next.push(id-1);if(c.col<n-1)next.push(id+1);if(c.row)next.push(id-n);if(c.row<n-1)next.push(id+n);for(let j=next.length-1;j>0;j--){const k=Math.floor(rng()*(j+1));[next[j],next[k]]=[next[k],next[j]];}for(const v of next)if(!seen.has(v)){seen.add(v);queue.push(v);}}
 }else if(total<=2500){
  const nearest=new Float64Array(total).fill(Infinity),used=new Uint8Array(total);let next=total-1;
  while(chosen.length<count){const c=cells[next];chosen.push(c);used[next]=1;let best=-1,bestDistance=-1;for(let j=0;j<total;j++)if(!used[j]){const q=cells[j],d=(q.x-c.x)**2+(q.y-c.y)**2;nearest[j]=Math.min(nearest[j],d);if(nearest[j]>bestDistance){bestDistance=nearest[j];best=j;}}next=best;}
 }else{
  // Deterministic, distributed ordering for large grids without a quadratic placement pass.
  const used=new Set();for(let i=0;i<count;i++){const y=(i+.5)/count,x=((i+.5)*.6180339887498949)%1;let id=Math.min(total-1,Math.floor(y*n)*n+Math.floor(x*n));while(used.has(id))id=(id+1)%total;used.add(id);chosen.push(cells[id]);}
 }
 const damaged=new Set(chosen.map(c=>c.id)),order=[];
 for(let row=n-1;row>=0;row--){const pass=n-1-row;for(let c=0;c<n;c++){const col=pass%2?c:n-1-c;order.push(cells[row*n+col]);}}
 const detections=order.filter(c=>damaged.has(c.id));
 const offset=o.distance/side/Math.SQRT2,ground={x:1+offset,y:1+offset,type:'ground'},entry={x:1,y:1,type:'entry'},margin=.4/n;
 const scan=[ground],detectedAlong=[];
 if(count){scan.push(entry);let found=0;for(let row=n-1;row>=0;row--){const pass=n-1-row,right=pass%2===0,y=(row+.5)/n,start={x:right?1+margin:-margin,y,type:'turn'};scan.push(start);let done=false;for(let k=0;k<n;k++){const col=right?n-1-k:k,c=cells[row*n+col];scan.push(c);if(damaged.has(c.id)){found++;detectedAlong.push({id:c.id,pathIndex:scan.length-1});if(found===count){done=true;break;}}}if(done)break;scan.push({x:right?-margin:1+margin,y,type:'turn'});}scan.push(ground);}
 const scanMiles=pathLength(scan)*side,scanMinutes=scanMiles/o.speed*60;
 const makeSingle=()=>{const p=[ground];for(const c of detections)p.push(entry,c,entry,ground);return p;};
 const makeSweep=()=>{const p=[ground];if(!count)return p;p.push(entry);for(let row=n-1;row>=0;row--){const pass=n-1-row,right=pass%2===0,y=(row+.5)/n;p.push({x:right?1+margin:-margin,y,type:'turn'});for(let k=0;k<n;k++){const col=right?n-1-k:k;p.push(cells[row*n+col]);}p.push({x:right?-margin:1+margin,y,type:'turn'});}p.push(ground);return p;};
 const makeOptimized=()=>{if(!count)return[ground];const remaining=new Map(detections.map(c=>[c.id,c])),route=[];let current=entry;
  while(remaining.size){let next=null,d=Infinity;if(remaining.size<=3000){for(const c of remaining.values()){const v=length(current,c);if(v<d){d=v;next=c;}}}else{next=remaining.values().next().value;}route.push(next);remaining.delete(next.id);current=next;}
  if(route.length<=200){for(let pass=0;pass<2;pass++){let changed=false;for(let i=0;i<route.length-1;i++)for(let j=i+1;j<route.length;j++){const a=i?route[i-1]:entry,b=route[i],c=route[j],d=j+1<route.length?route[j+1]:ground;if(length(a,c)+length(b,d)<length(a,b)+length(c,d)-1e-10){const rev=route.slice(i,j+1).reverse();route.splice(i,j-i+1,...rev);changed=true;}}if(!changed)break;}}
  const candidate=[ground,entry,...route,ground],ordered=[ground,entry,...detections,ground];return pathLength(candidate)<=pathLength(ordered)?candidate:ordered;
 };
 const paths=[makeSingle(),makeSweep(),makeOptimized()];
 const scenarios=paths.map((path,i)=>{const sampleMiles=pathLength(path)*side,sampleFlight=sampleMiles/o.speed*60,samplingMinutes=count*40/60,logistics=count?15:0,operation=scanMinutes+sampleFlight+samplingMinutes+logistics;return {index:i,path,scanPath:scan,scan:scanMiles,sample:sampleMiles,total:scanMiles+sampleMiles,flight:scanMinutes+sampleFlight,scanMinutes,sampleFlight,sampling:samplingMinutes,logistics,operation,hours:operation/60,count,coordinates:detections};});
 const areaSpray=o.area*o.damage/100,expectedLoss=rate.lossPerAcre===null?null:o.area*rate.lossPerAcre;
 function result(name,hours,chemical,labor){return {name,hours,time:hours*60,chemical,labor,cost:chemical+labor,expectedLoss,saved:expectedLoss===null?null:expectedLoss-chemical-labor};}
 const manualHours=o.area/(rate.manualCrew*rate.manualCapacity),uasHours=o.area/rate.uasCapacity;
 const manual=result('Manual',manualHours,o.area*rate.manualChemical,Math.ceil(manualHours)*rate.manualWage*rate.manualCrew),uas=result('Conventional UAS',uasHours,o.area*rate.uasChemical,Math.ceil(uasHours)*rate.uasWage*rate.uasCrew);
 scenarios.forEach(s=>{s.economics=result('TG-1',s.hours,areaSpray*rate.chemical,Math.ceil(s.hours)*rate.tg1TeamHourly);});
 return {...o,side,n,cells,count,damageIds:[...damaged],detected:detections,detectedAlong,scanPath:scan,scanMiles,scanMinutes,scenarios,manual,uas,expectedLoss,areaSpray,rate,source:{file:source.source,sheet:source.sheet,range:source.range}};
}
const api={plan,defaults,rate,pathLength};if(typeof module!=='undefined')module.exports=api;else Object.assign(root.TG1,api);
})(typeof window!=='undefined'?window:globalThis);
