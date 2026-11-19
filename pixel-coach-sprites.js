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
  // Sequence ordering is based on what each uploaded frame ACTUALLY shows,
  // checked frame-by-frame against the source atlas -- not a generic squat
  // imposed on every coach, and never two different real motions spliced
  // into one loop (e.g. a standing pose inside a walk cycle, or a seated
  // meditation frame bookending a standing stretch). Where a coach's sheet
  // has no literal workout-rep frame, "exercise" uses whichever frames are
  // ITS OWN single consistent clip (Pixel checks a stats readout, Mira
  // journals, Scout reads a trail map) rather than borrowing mismatched
  // frames from somewhere else on the sheet. The indexes are 00-15.
  const ANIMATIONS={
    atlas:{idle:[0,1,0],walk:[4,5,4,5],exercise:[9,6,7,8,7,6,9],stretch:[9,13,9],talk:[9,10,11,10],celebrate:[9,12,14,15,9]},
    pixel:{idle:[0,1,15,0],walk:[2,3,4],exercise:[9,7,8,7,9],stretch:[9,6,9],talk:[9,10,11,10],celebrate:[9,13,14,9]},
    // walk frame 4 is a noticeably smaller/shorter crop than 2 and 3 on
    // this particular sheet (checked against both, side by side) -- it
    // made her visibly shrink-pop every third step. Two good frames beat
    // three where one doesn't match.
    mira:{idle:[0,1,5,0],walk:[2,3],exercise:[9,6,7,8,7,6,9],stretch:[9,12,15,12,9],talk:[9,10,11,10],celebrate:[9,13,14,9]},
    rex:{idle:[0,1,8,0],walk:[2,3,4],exercise:[6,7,6,7],stretch:[9,14,15,14,9],talk:[9,10,11,10],celebrate:[9,12,13,9]},
    // Luna's sheet is really two clips: standing stretches (6/7/8/15) and a
    // seated breathing/meditation clip (9/10/11). The old mapping bookended
    // the stretch with a meditation frame AND spliced a standing frame into
    // the middle of the seated clip. Keep them apart: stretch stays fully
    // standing, and the seated breathing clip becomes her "exercise" on its
    // own terms (a Recovery Coach's exercise IS a guided breath), never
    // interrupted by a standing frame mid-loop.
    luna:{idle:[0,1,4,0],walk:[2,3],exercise:[9,10,11,10,9],stretch:[6,7,8,15,8,7,6],talk:[12,13,14,13],celebrate:[13,14,13]},
    // Scout/Blaze: one real standing stretch frame each, so stretch is
    // framed as a deliberate single arc (stand-stretch into a seated
    // cool-down) instead of randomly alternating between two postures.
    'outdoor-coach':{idle:[0,1,5,8,0],walk:[2,3,4],exercise:[6,7,6,7],stretch:[12,13,14,13,12],talk:[10,11,10],celebrate:[11,15,11]},
    'red-hoodie-coach':{idle:[0,1,5,0],walk:[2,3,4],exercise:[9,6,7,8,7,6,9],stretch:[12,13,14,13,12],talk:[9,10,11,10],celebrate:[9,11,9]}
  };
  // Per-action pacing: a squat rep and a held stretch shouldn't move at the
  // same speed, and neither should look identical across every coach. Base
  // table first, then per-coach overrides only for sequences that are
  // deliberately slower/calmer than the default for that action (Luna's
  // breathing, Scout/Blaze's seated cool-down).
  const FRAME_SPEEDS={idle:480,walk:220,exercise:260,stretch:480,talk:220,celebrate:200};
  const SPEED_OVERRIDES={
    luna:{exercise:560,stretch:430},
    'outdoor-coach':{stretch:460},
    'red-hoodie-coach':{stretch:460}
  };
  function frameInterval(id,action){
    const cid=coach(id).id;
    return (SPEED_OVERRIDES[cid]&&SPEED_OVERRIDES[cid][action])||FRAME_SPEEDS[action]||FRAME_SPEEDS.idle;
  }
  // Coaches whose "exercise" is really them pulling out a device/map and
  // looking at it (not a rep) should pause on that look, for a random but
  // reasonable beat, before putting it away -- not cycle through on the
  // same metronome as an actual exercise rep. `at` is the index INTO that
  // coach's own exercise array (not a raw sprite frame number) of the
  // "looking at it" pose.
  const DEVICE_HOLDS={
    pixel:{at:2,min:900,max:2000},
    mira:{at:3,min:900,max:2200},
    'red-hoodie-coach':{at:3,min:900,max:2200},
    'outdoor-coach':{at:1,min:800,max:1800}
  };
  function deviceHold(id){return DEVICE_HOLDS[coach(id).id]||null;}
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
    frameSequence,setFrame,dimensions:DIMENSIONS,animations:ANIMATIONS,frameInterval,deviceHold});
})();
