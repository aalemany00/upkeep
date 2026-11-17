(function spriteModule(){
 'use strict';
 const ROSTER=[
 {id:'atlas',name:'Atlas',title:'The Trainer',tagline:'Discipline builds the freedom you want.',subtitle:'Strong habits. Bigger dreams.',badgeIcon:'leaf',accent:'#2f8f5b',primary:'#347a53',dark:'#254e43',skin:'#d69a74',hair:'#302824',light:'#f4e4b9',kind:'trainer'},
 {id:'pixel',name:'Pixel',title:'The Tech Coach',tagline:'Small progress adds up to big results.',subtitle:'Track. Improve. Level up.',badgeIcon:'code',accent:'#2f6fb8',primary:'#5eabd5',dark:'#285a7b',skin:'#f3e8cf',hair:'#21344d',light:'#5be3ed',kind:'robot'},
 {id:'mira',name:'Mira',title:'The Mindset Coach',tagline:"You're doing better than you think. Keep going.",subtitle:'A healthier mind builds a stronger you.',badgeIcon:'lotus',accent:'#8a6fd1',primary:'#a589d6',dark:'#674a90',skin:'#c58c70',hair:'#3c293e',light:'#f3d4af',kind:'mind'},
 {id:'rex',name:'Rex',title:'The Progress Coach',tagline:'Every rep, every step, gets you closer!',subtitle:'Progress over perfection.',badgeIcon:'paw',accent:'#c9892f',primary:'#eaa24a',dark:'#a95231',skin:'#eaa24a',hair:'#66402d',light:'#ffdfaa',kind:'dog'},
 {id:'luna',name:'Luna',title:'The Recovery Coach',tagline:"Rest isn't lazy — it's part of the plan.",subtitle:'Recover. Refuel. Come back stronger.',badgeIcon:'moon',accent:'#2e8f82',primary:'#5aa9a0',dark:'#2d6b7d',skin:'#deb197',hair:'#293c4c',light:'#b3d4ca',kind:'recovery'}
 ];


 // The only selectable coaches are the five with complete lossless
 // hand-rendered idle, walk, exercise and talk sprite frames.
 const CORE_IDS=Object.freeze(ROSTER.map(coach=>coach.id));
 function coach(id){return ROSTER.find(x=>x.id===id)||ROSTER[0];}
 function portrait(id){
   return 'pixel-assets/'+coach(id).id+'-portrait.png';
 }
 function markup(id,extraClass=''){
   const item=coach(id);
   const path='pixel-assets/'+item.id+'-poses.webp';
   return '<span class="pixel-coach-art '+extraClass+
     '" data-coach-format="poses" data-coach-art="'+item.id+
     '" role="img" aria-label="'+item.name+
     ' pixel-art coach" style="--coach-source:url(\''+path+'\');--coach-sprite-x:0%"></span>';
 }
 window.UpkeepCoachSprites=Object.freeze({roster:ROSTER,markup,portrait,coach,coreIds:CORE_IDS});
})();
