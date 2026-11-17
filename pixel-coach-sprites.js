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

 // Five primary coaches use original, lossless 5-pose raster strips:
 // idle / walk1 / walk2 / exercise / talk, 251x1254 pixels each.
 // Three additional fitness/wellness choices retain original still art.
 // NOTHING is redrawn as large vector rectangles.
 const SOURCE='pixel-assets/coaches-original.png';
 const CORE_IDS=new Set(['atlas','pixel','mira','rex','luna']);
 function coach(id){return ROSTER.find(x=>x.id===id)||ROSTER[0]}
 function markup(id,extraClass=''){
   const who=coach(id);
   const idx=ROSTER.findIndex(x=>x.id===who.id);
   const animated=CORE_IDS.has(who.id);
   const format=animated?'poses':'hires-still';
   const dimensions={nova:[215,357],sage:[200,360],pace:[229,385]};
   const source=animated?'pixel-assets/'+who.id+'-poses.webp':
     'pixel-assets/'+who.id+'-full.webp';
   // Primary coaches have five native-resolution poses. The three
   // additional coaches each have their own lossless full-body original.
   const ratio=animated?'1 / 1':dimensions[who.id].join(' / ');
   const style='--coach-source:url('+source+');--coach-ratio:'+ratio+
      ';--coach-sprite-x:0%';
   return '<span class="pixel-coach-art '+extraClass+
      '" data-coach-format="'+format+
      '" data-coach-art="'+who.id+'" role="img" aria-label="'+
      who.name+' pixel-art coach" style="'+style+'"></span>';
 }
 window.UpkeepCoachSprites=Object.freeze({roster:ROSTER,markup,coach,source:SOURCE,coreIds:[...CORE_IDS]});
})();
