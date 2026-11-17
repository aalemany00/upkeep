(function spriteModule(){
 'use strict';
 const ROSTER=[
 {id:'atlas',name:'Atlas',title:'The Trainer',tagline:'Discipline builds the freedom you want.',subtitle:'Strong habits. Bigger dreams.',badgeIcon:'leaf',accent:'#2f8f5b',primary:'#347a53',dark:'#254e43',skin:'#d69a74',hair:'#302824',light:'#f4e4b9',kind:'trainer'},
 {id:'pixel',name:'Pixel',title:'The Tech Coach',tagline:'Small progress adds up to big results.',subtitle:'Track. Improve. Level up.',badgeIcon:'code',accent:'#2f6fb8',primary:'#5eabd5',dark:'#285a7b',skin:'#f3e8cf',hair:'#21344d',light:'#5be3ed',kind:'robot'},
 {id:'mira',name:'Mira',title:'The Mindset Coach',tagline:"You're doing better than you think. Keep going.",subtitle:'A healthier mind builds a stronger you.',badgeIcon:'lotus',accent:'#8a6fd1',primary:'#a589d6',dark:'#674a90',skin:'#c58c70',hair:'#3c293e',light:'#f3d4af',kind:'mind'},
 {id:'rex',name:'Rex',title:'The Progress Coach',tagline:'Every rep, every step, gets you closer!',subtitle:'Progress over perfection.',badgeIcon:'paw',accent:'#c9892f',primary:'#eaa24a',dark:'#a95231',skin:'#eaa24a',hair:'#66402d',light:'#ffdfaa',kind:'dog'},
 {id:'luna',name:'Luna',title:'The Recovery Coach',tagline:"Rest isn't lazy — it's part of the plan.",subtitle:'Recover. Refuel. Come back stronger.',badgeIcon:'moon',accent:'#2e8f82',primary:'#5aa9a0',dark:'#2d6b7d',skin:'#deb197',hair:'#293c4c',light:'#b3d4ca',kind:'recovery'},
 {id:'nova',name:'Nova',title:'The Cardio Coach',tagline:'Find your rhythm, one step at a time.',subtitle:'Move a little. Feel a lot.',badgeIcon:'footprints',accent:'#d85e51',primary:'#d75f53',dark:'#854049',skin:'#bb7c58',hair:'#492c34',light:'#f9d4ac',kind:'runner'},
 {id:'sage',name:'Sage',title:'The Wellness Coach',tagline:'Progress includes caring for yourself.',subtitle:'Breathe, stretch, and grow.',badgeIcon:'lotus',accent:'#6b9455',primary:'#9cae72',dark:'#526b52',skin:'#b57c5d',hair:'#624534',light:'#e9d8b0',kind:'yoga'},
 {id:'pace',name:'Pace',title:'The Movement Coach',tagline:'Consistency is built in small moves.',subtitle:'Find what keeps you moving.',badgeIcon:'bicep',accent:'#b98332',primary:'#e5ba58',dark:'#8b6b39',skin:'#a57556',hair:'#41342a',light:'#e9e0c9',kind:'cardio'}
 ];
 const outline='#3c2c2b';
 function svg(id,pose='idle'){
  const p=ROSTER.find(x=>x.id===id)||ROSTER[0];
  const {primary,dark,skin,hair,light,kind}=p;
  const lines=[];
  const r=(x,y,w,h,c,stroke=true)=>lines.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"${stroke?` stroke="${outline}" stroke-width="1.3"`:''}/>`);
  const path=(d,c)=>lines.push(`<path d="${d}" fill="${c}" stroke="${outline}" stroke-width="1.3" stroke-linejoin="round"/>`);
  const line=(d,c=outline,w=1.2)=>lines.push(`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="square"/>`);
  const blink=pose==='blink',talk=pose==='talk',exercise=pose==='exercise',w1=pose==='walk1',w2=pose==='walk2';
  const lift=exercise?4:0;
  function face(x1,x2,y,mouthX,mouthY){
   if(blink){r(x1,y,3,1,outline,false);r(x2,y,3,1,outline,false)}
   else {r(x1,y,3,3,outline,false);r(x2,y,3,3,outline,false);r(x1,y,1,1,'#faf1da',false);r(x2,y,1,1,'#faf1da',false)}
   if(talk){r(mouthX,mouthY,5,4,'#6d3030',false);r(mouthX+1,mouthY+3,3,1,'#ef9e9c',false)}
   else line(`M${mouthX} ${mouthY}h5`,'#7e4038',1.5);
  }
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 80" shape-rendering="crispEdges" role="img" aria-label="${p.name} pixel coach">`);
  lines.push('<ellipse cx="32" cy="75" rx="20" ry="3" fill="#4a4236" opacity=".20"/>');
  if(kind==='robot'){
   r(23,53,8,13,dark);r(38,53,8,13,dark);
   r(19+(w1?-4:0),65,15,7,'#f2e5ce');r(35+(w2?4:0),65,15,7,'#f2e5ce');
   r(15,31+lift,35,28,'#f5ead3');r(22,34+lift,21,19,dark);
   r(25,39+lift,15,10,primary,false);r(26,40+lift,4,7,light,false);r(31,38+lift,4,9,'#a0e8e9',false);r(36,43+lift,4,4,light,false);
   r(w1?9:12,35+lift,7,15,dark);r(48,35+lift,7,15,dark);r(w1?7:9,47+lift,9,7,'#f3e6d2');r(48,47+lift,9,7,'#f3e6d2');
   if(exercise){r(7,28,9,7,primary);r(48,28,9,7,primary)}
   r(16,11,34,24,'#f2e9d8');r(20,15,26,16,'#243d50');
   r(24,21,5,4,light,false);r(37,21,5,4,light,false);
   if(talk)r(28,27,11,3,'#9ee0e5',false);else line('M29 27h8',light,2);
   r(30,4,5,8,dark);r(30,2,5,5,'#f6c778');r(14,21,4,7,primary);r(48,21,4,7,primary);
  } else if(kind==='dog'){
   path(`M42 46Q62 ${47+(w2?3:0)} 57 58Q58 65 47 62L43 55Z`,primary);
   r(20+(w1?-2:0),55,9,14,skin);r(36+(w2?2:0),55,9,14,skin);r(17+(w1?-2:0),67,15,6,'#f2e5ce');r(33+(w2?2:0),67,15,6,'#f2e5ce');
   r(19,35+lift,28,23,'#b45d36');r(25,39+lift,16,12,'#f8ba70',false);
   r(12,39+lift,9,18,skin);r(47,39+lift,9,18,skin);r(10,52+lift,11,7,'#f2e5ce');r(47,52+lift,11,7,'#f2e5ce');
   r(13,10,38,30,skin);path('M13 13L7 5L7 24L17 25Z',primary);path('M49 13L56 5L58 25L47 25Z',primary);
   r(17,24,29,13,light);r(26,28,12,6,'#b9794a',false);r(30,27,5,3,outline,false);
   if(talk){r(29,34,6,5,'#a64538',false);r(31,37,3,5,'#ef9b9c',false)}else line('M27 34h11','#895034',1.5);
   if(blink){line('M21 22h7');line('M38 22h7')}else{r(23,20,3,3,outline,false);r(39,20,3,3,outline,false)}
   r(23,9,16,5,light,false);r(20,39+lift,9,3,light,false);
  } else {
   if(exercise){
    r(13,50,14,11,dark);r(38,50,14,11,dark);
    r(11,59,16,10,dark);r(38,59,16,10,dark);r(7,67,22,7,'#f2e5ce');r(38,67,22,7,'#f2e5ce');
   } else {
    r(20+(w1?-4:w2?2:0),48,11,20,dark);r(34+(w2?5:w1?-2:0),48,11,20,dark);
    r(17+(w1?-7:0),65,16,9,'#f2e5ce');r(32+(w2?5:0),65,16,9,'#f2e5ce');
   }
   r(18,44,29,9,dark);
   const cx=kind==='trainer'?14:kind==='yoga'?17:kind==='runner'?15:18;
   const cw=kind==='trainer'?36:kind==='yoga'?30:kind==='runner'?34:29;
   r(cx,29+lift,cw,21,primary);r(cx+3,34+lift,cw-6,10,primary,false);r(cx+2,45+lift,cw-4,3,dark,false);
   if(kind==='trainer'){r(26,32+lift,11,5,light,false);r(29,31+lift,5,12,dark,false);r(31,32+lift,1,8,light,false);r(24,49,17,4,'#5e453b')}
   if(kind==='mind'){r(28,29+lift,6,13,light,false);r(18,42+lift,29,4,dark,false)}
   if(kind==='recovery'){r(19,32+lift,25,15,dark,false);r(29,30+lift,8,17,light,false);r(26,40+lift,13,4,primary,false)}
   if(kind==='runner'){r(20,30+lift,4,17,light,false);r(40,30+lift,4,17,light,false);r(31,35+lift,4,8,dark,false)}
   if(kind==='yoga'){r(20,32+lift,24,8,light,false);r(20,42+lift,24,5,dark,false)}
   if(kind==='cardio'){r(20,29+lift,27,5,light,false);r(31,36+lift,4,10,light,false)}
   if(exercise){r(cx-8,24+lift,9,20,skin);r(cx+cw-1,24+lift,9,20,skin);r(cx-9,20+lift,10,9,primary);r(cx+cw-1,20+lift,10,9,primary)}
   else {r(cx-7+(w1?-1:0),33+lift,8,19,skin);r(cx+cw-1+(w2?1:0),33+lift,8,19,skin);r(cx-7,32+lift,9,10,primary);r(cx+cw-1,32+lift,9,10,primary)}
   if(kind==='mind')path('M17 11Q12 4 25 4L40 4Q53 9 49 28L53 44L46 45L43 24L20 24L17 42L12 40Z',hair);
   else if(kind==='recovery')path('M17 8Q25 3 40 5L50 10L49 38L44 41L40 28L17 29L14 41L10 36L12 19Z',hair);
   else if(kind==='runner'){r(42,9,10,22,hair);r(46,22,8,11,hair)}
   else if(kind==='yoga'){r(15,6,12,8,hair);r(39,6,10,9,hair)}
   else r(17,9,31,21,hair);
   r(19,13,28,20,skin);
   if(kind==='trainer'){path('M18 14L17 7L23 9L26 5L34 9L39 6L49 13L46 17L19 17Z',hair);r(18,16,30,4,light);r(20,20,8,3,hair,false)}
   if(kind==='mind'){r(13,9,13,16,hair);r(41,10,9,19,hair);r(27,8,14,7,hair);r(43,6,8,7,'#6a5278')}
   if(kind==='recovery'){r(16,10,33,9,hair);r(17,20,7,13,hair);r(43,21,8,16,hair);r(16,11,7,7,'#e3c98e');r(50,20,3,8,primary)}
   if(kind==='runner'){r(18,10,30,7,dark);r(15,10,24,6,'#b95450');r(34,15,19,4,'#b95450')}
   if(kind==='yoga'){r(17,10,29,7,hair);r(26,8,12,5,hair);r(43,19,6,11,hair)}
   if(kind==='cardio'){r(16,11,35,6,hair);r(20,7,23,6,hair);r(13,23,6,12,primary);r(48,23,6,12,primary)}
   face(25,37,21+(exercise?2:0),30,29+(exercise?2:0));
   r(20,29+lift,4,4,'#b87564',false);r(42,29+lift,4,4,'#b87564',false);
  }
  lines.push('</svg>');
  return lines.join('');
 }
 function url(id,pose='idle'){return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg(id,pose))}
 window.UpkeepCoachSprites={roster:ROSTER,svg,url};
})();
