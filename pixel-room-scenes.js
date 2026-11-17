(function roomModule(){
 'use strict';
 const art=window.UpkeepCoachSprites;
 const room=document.querySelector('#view-dashboard .pixel-room-hero');
 if(!art||!room||room.dataset.coachSceneReady)return;
 room.dataset.coachSceneReady='true';
 const speech=room.querySelector('.pixel-room-message');
 const oldHotspot=room.querySelector('.pixel-coach-hotspot');
 if(oldHotspot)oldHotspot.hidden=true;
 const actor=document.createElement('button');
 actor.type='button';actor.className='pixel-room-character';actor.setAttribute('aria-label','Talk to your fitness coach');
 // The coach is a CSS window onto the ORIGINAL transparent PNG sprite
 // sheet. We never replace its pixels with SVG rectangles.
 actor.innerHTML=art.markup('atlas','pixel-room-art');room.append(actor);
 const mobile=window.matchMedia('(max-width:760px)');
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
 let current='atlas',stepTimers=[],loopTimer=null,paused=false,talking=false,pose='idle',moving=false;
 const coach=()=>art.roster.find(x=>x.id===current)||art.roster[0];
 const later=(fn,delay)=>{const t=setTimeout(fn,delay);stepTimers.push(t);return t};
 function clearRoutine(){stepTimers.forEach(clearTimeout);stepTimers=[];clearInterval(loopTimer);loopTimer=null;actor.classList.remove('is-walking','is-exercising','is-talking')}
 function setPose(next){pose=next;actor.dataset.pose=next}
 function position(atGym=false){
  actor.style.left=(mobile.matches?(atGym?39:25):(atGym?54:45))+'%';
 }
 function walk(toGym){
  if(paused||talking||reduce.matches)return;
  moving=true;actor.classList.add('is-walking');
  position(toGym);
  let n=0;
  loopTimer=setInterval(()=>setPose(++n%2?'walk1':'walk2'),240);
  later(()=>{
   clearInterval(loopTimer);loopTimer=null;
   actor.classList.remove('is-walking');moving=false;
   if(toGym)exercise();
   else {setPose('idle');later(()=>walk(true),7500)}
  },3400);
 }
 function exercise(){
  if(paused||talking||reduce.matches)return;
  actor.classList.add('is-exercising');
  let n=0;
  setPose('exercise');
  loopTimer=setInterval(()=>setPose(++n%2?'exercise':'idle'),570);
  later(()=>{
   clearInterval(loopTimer);loopTimer=null;
   actor.classList.remove('is-exercising');
   setPose('idle');
   later(()=>walk(false),1500);
  },5300);
 }
 function start(){
  clearRoutine();paused=false;moving=false;talking=false;position(false);setPose('idle');
  if(!reduce.matches)later(()=>walk(true),6500);
 }
 function select(id){
  if(!art.roster.some(x=>x.id===id))id='atlas';
  const changed=id!==current;
  current=id;
  const hasPoseArt=art.coreIds.includes(id);
  actor.classList.toggle('pixel-room-poses',hasPoseArt);
  actor.classList.toggle('pixel-room-still',!hasPoseArt);
  actor.dataset.coachId=id;
  actor.innerHTML=art.markup(current,'pixel-room-art');
  actor.setAttribute('aria-label','Talk to '+coach().name+', your fitness coach');
  if(speech&&(changed||!speech.dataset.personalized)){speech.textContent=coach().tagline;speech.dataset.personalized='true'}
  start();
  decorateCoachTab();
 }
 function talk(text){
  clearRoutine();talking=true;
  // Keep room dialogue readable on small phones. The complete text is
  // still available in the normal Coach tab and its larger speech bubble.
  const raw=String(text||coach().tagline).trim();
  if(speech)speech.textContent=raw.length>75
    ?raw.slice(0,72).replace(/\\s+\\S*$/,'')+'…'
    :raw;
  actor.classList.add('is-talking');
  let n=0;setPose('talk');
  loopTimer=setInterval(()=>setPose(++n%2?'talk':'idle'),170);
  later(()=>{clearInterval(loopTimer);loopTimer=null;actor.classList.remove('is-talking');talking=false;setPose('idle');later(()=>walk(true),4500)},2400);
 }
 function requestTalk(){
  const btn=document.getElementById(mobile.matches?'sidebar-avatar-btn-mobile':'sidebar-avatar-btn');
  if(btn)btn.click();else talk(coach().tagline);
 }
 actor.addEventListener('click',requestTalk);
 mobile.addEventListener('change',()=>position(moving));
 reduce.addEventListener('change',start);
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden){clearRoutine();paused=true;setPose('idle')}
  else start();
 });
 function decorateCoachTab(){
  // app.js uses the same art.markup() as this scene for the Coach tab.
 }
 // The clean room is a separate, committed image asset now.
 // No on-device canvas inpainting, so the original old character
 // cannot ghost through as new coaches move around the room.
 window.UpkeepRoomCoach={select,talk,requestTalk,mount:()=>room,coaches:art.roster};
 select('atlas');
})();
