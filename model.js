/* Source: Time Calculations.xlsx, USDA-Total Operation Prediction, B2:E40.
   The optimized route retains both source bounds (D and E), not a new optimizer. */
(function(root){
function calculate(area,distance,speed){
 if(!Number.isFinite(area)||area<=0||!Number.isFinite(distance)||distance<0||distance>9||!Number.isFinite(speed)||speed<=0||speed>45)throw new Error('Enter a field area greater than 0, a distance from 0 to 9 miles, and a speed greater than 0 and no more than 45 mph.');
 const side=Math.sqrt(area/640), diagonal=Math.sqrt(2)*side;
 const full=side+side/5+side+side/5+side+side/5+side+side/5+side;
 const short=side*2+side/5, scattered=side*3+side*2/5*2;
 const parts=[
  {column:1,scan:[distance,full,distance+diagonal],sample:[distance,diagonal,distance],trips:10},
  {column:2,scan:[distance,full,distance+diagonal],sample:[distance,full,distance+diagonal],trips:1},
  {column:3,scan:[distance,short,distance+side/5],sample:[distance,short,distance+side/5],trips:1},
  {column:4,scan:[distance,full,distance+diagonal],sample:[distance,scattered,distance+diagonal],trips:1}
 ];
 const sum=a=>a.reduce((v,n)=>v+n,0);
 const scenarios=parts.map(p=>{const scan=sum(p.scan),sample=sum(p.sample)*p.trips,total=scan+sample,flight=total/speed*60,sampling=10*40/60,logistics=15,operation=flight+sampling+logistics,hours=Math.ceil(operation/60),analyst=50*hours,pilot=35*hours,payload=35*hours,labor=analyst+pilot+payload;return {...p,scanParts:p.scan,sampleParts:p.sample,scan,sample,total,flight,sampling,logistics,operation,hours,analyst,pilot,payload,labor};});
 scenarios.forEach(s=>{s.laborSaving=1-s.labor/scenarios[0].labor;s.timeSaving=1-s.operation/scenarios[0].operation;});
 return {area,distance,speed,side,diagonal,scenarios};
}
root.TG1={calculate};if(typeof module!=='undefined')module.exports=root.TG1;
})(typeof window!=='undefined'?window:globalThis);
