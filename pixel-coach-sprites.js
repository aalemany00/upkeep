/* Upkeep cutout sprite renderer: original PNG artwork from user-supplied ZIPs.
   Each 4x4 PNG atlas is assembled with no resampling: 16 exact cutout frames. */
(function spriteModule(){
  'use strict';
  const ROSTER=[
    {id:'atlas',name:'Atlas',title:'The Trainer',tagline:'Discipline builds the freedom you want.',subtitle:'Strong habits. Bigger dreams.',badgeIcon:'leaf',accent:'#2f8f5b',kind:'trainer'},
    {id:'pixel',name:'Pixel',title:'The Tech Coach',tagline:'Small progress adds up to big results.',subtitle:'Track. Improve. Level up.',badgeIcon:'code',accent:'#2f6fb8',kind:'robot'},
    {id:'mira',name:'Mira',title:'The Mindset Coach',tagline:"You're doing better than you think. Keep going.",subtitle:'A healthier mind builds a stronger you.',badgeIcon:'lotus',accent:'#8a6fd1',kind:'mind'},
    {id:'rex',name:'Rex',title:'The Progress Coach',tagline:'Every rep, every step, gets you closer!',subtitle:'Progress over perfection.',badgeIcon:'paw',accent:'#c9892f',kind:'dog'},
    {id:'luna',name:'Luna',title:'The Recovery Coach',tagline:"Rest isn't lazy — it's part of the plan.",subtitle:'Recover. Refuel. Come back stronger.',badgeIcon:'moon',accent:'#2e8f82',kind:'recovery'},
    // Display names are Scout and Blaze; keep the original stable IDs so
    // saved coach selections and sprite filenames continue to work.
    {id:'outdoor-coach',name:'Scout',title:'Outdoor Movement',tagline:'Take your fitness journey one step at a time.',subtitle:'Explore, breathe, and keep moving.',badgeIcon:'footprints',accent:'#5a8864',kind:'outdoors'},
    {id:'red-hoodie-coach',name:'Blaze',title:'Movement & Progress',tagline:'A little progress every day adds up.',subtitle:'Find your pace and enjoy the work.',badgeIcon:'dumbbell',accent:'#b96658',kind:'wellness'}
  ];
  const DIMENSIONS={atlas:[314,314],pixel:[305,323],mira:[305,323],rex:[314,314],luna:[314,314],'outdoor-coach':[305,323],'red-hoodie-coach':[305,323]};
  // Sequence ordering is based on the uploaded individual frames—not a
  // generic squat imposed on every coach. The indexes are 00–15.
  const ANIMATIONS={
    atlas:{idle:[0,1,0],walk:[2,3,4,5],exercise:[9,6,7,8,6,9],stretch:[9,13,15,13,9],talk:[9,10,11,10],celebrate:[9,12,14,9]},
    pixel:{idle:[0,1,0],walk:[2,3,4,5],exercise:[6,7,8,9],stretch:[9,15,9],talk:[9,10,11,10],celebrate:[9,12,13,14,9]},
    mira:{idle:[0,1,0],walk:[2,3,4,5],exercise:[6,7,8,6],stretch:[9,12,15,9],talk:[9,10,11,10],celebrate:[9,14,15,9]},
    rex:{idle:[0,1,8,9,0],walk:[2,3,4,5],exercise:[9,6,7,6,9],stretch:[9,14,15,9],talk:[9,10,11,10],celebrate:[9,12,13,9]},
    luna:{idle:[0,1,5,0],walk:[2,3,4],exercise:[9,10,11,12,11,10,9],stretch:[5,6,7,8,6,5],talk:[12,13,14,13],celebrate:[12,14,15,12]},
    'outdoor-coach':{idle:[0,1,0],walk:[2,3,4],exercise:[5,6,7,8,9],stretch:[12,13,14,12],talk:[10,11,10],celebrate:[11,15,11]},
    'red-hoodie-coach':{idle:[0,1,0],walk:[2,3,4],exercise:[5,6,7,8],stretch:[12,15,12],talk:[9,10,11,10],celebrate:[11,14,15,11]}
  };
  const CORE_IDS=Object.freeze(ROSTER.map(coach=>coach.id));
  const coach=id=>ROSTER.find(c=>c.id===id)||ROSTER[0];
  function frameSequence(id,action){return ANIMATIONS[coach(id).id][action]||ANIMATIONS[coach(id).id].idle;}
  function portrait(id){return 'pixel-assets/cutouts/'+coach(id).id+'-portrait.png';}
  function markup(id,extraClass=''){
    const c=coach(id),size=DIMENSIONS[c.id],asset='pixel-assets/cutouts/'+c.id+'-atlas.png';
    return '<span class="pixel-coach-art '+extraClass+
      '" data-coach-format="cutout" data-coach-art="'+c.id+
      '" role="img" aria-label="'+c.name+' pixel-art coach" style="--coach-source:url(\''+asset+
      '\');--coach-frame-ratio:'+size[0]+' / '+size[1]+';background-position:0% 0%"></span>';
  }
  function setFrame(sprite,n){
    if(!sprite)return;
    n=Number.isInteger(n)?Math.max(0,Math.min(15,n)):0;
    sprite.dataset.frame=String(n);
    sprite.style.backgroundPosition=(n%4*100/3).toFixed(6)+'% '+(Math.floor(n/4)*100/3).toFixed(6)+'%';
  }
  window.UpkeepCoachSprites=Object.freeze({roster:ROSTER,markup,portrait,coach,coreIds:CORE_IDS,
    frameSequence,setFrame,dimensions:DIMENSIONS,animations:ANIMATIONS});
})();
