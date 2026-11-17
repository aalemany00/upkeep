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
 const img=document.createElement('img');img.alt='';img.width=128;img.height=160;img.decoding='async';img.draggable=false;
 actor.append(img);room.append(actor);
 const mobile=window.matchMedia('(max-width:760px)');
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
 let current='atlas',stepTimers=[],loopTimer=null,paused=false,talking=false,pose='idle',moving=false;
 const coach=()=>art.roster.find(x=>x.id===current)||art.roster[0];
 const later=(fn,delay)=>{const t=setTimeout(fn,delay);stepTimers.push(t);return t};
 function clearRoutine(){stepTimers.forEach(clearTimeout);stepTimers=[];clearInterval(loopTimer);loopTimer=null;actor.classList.remove('is-walking','is-exercising','is-talking')}
 function setPose(next){pose=next;img.src=art.url(current,next)}
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
  actor.setAttribute('aria-label','Talk to '+coach().name+', your fitness coach');
  if(speech&&(changed||!speech.dataset.personalized)){speech.textContent=coach().tagline;speech.dataset.personalized='true'}
  start();
  decorateCoachTab();
 }
 function talk(text){
  clearRoutine();talking=true;
  if(speech)speech.textContent=String(text||coach().tagline).slice(0,180);
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
  const existing=document.querySelector('#coach-hero-figure img');
  if(existing&&existing.dataset.sceneSvg!=='true'){
   // app.js manages the full-size Coach illustration and its idle/react frames;
   // that same sprite set is supplied there by avatarSrc() in app.js.
   existing.dataset.sceneSvg='true';
  }
 }
 // The source bedroom image has a baked-in old person. Reconstruct the
 // narrow wall/rug region once from nearby room pixels so the new sprite
 // can actually replace them, rather than appearing on top of a ghost.
 function cleanBackground(){
  const original=new Image();
  original.onload=()=>{
   const canvas=document.createElement('canvas');
   const w=original.naturalWidth,h=original.naturalHeight;canvas.width=w;canvas.height=h;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   if(!ctx)return;
   ctx.drawImage(original,0,0);
   const data=ctx.getImageData(0,0,w,h),pixels=data.data,source=new Uint8ClampedArray(pixels);
   function sample(x,y,c){return source[(Math.max(0,Math.min(h-1,y))*w+Math.max(0,Math.min(w-1,x)))*4+c]}
   // Portrait occupies x638-748, from y85 to the floor. Keep the right
   // gym equipment, lamp, bookcase, and speech bubble entirely untouched.
   for(let y=87;y<308;y++){
    const x0=y<152?641:y<255?638:642;
    const x1=y<152?745:y<255?746:743;
    for(let x=x0;x<x1;x++){
     // 3px staggered blocks retain a handmade pixel-art texture.
     const wall=y<263;
     const left=wall?Math.max(592,x0-24):Math.max(520,x0-31);
     const right=wall?Math.min(w-1,x1+14):Math.min(w-1,x1+37);
     const t=(x-x0)/(x1-x0);
     const grain=((Math.floor(x/4)*17+Math.floor(y/4)*29)%7)-3;
     const i=(y*w+x)*4;
     for(let c=0;c<3;c++){
      const v=sample(left,y,c)*(1-t)+sample(right,y,c)*t;
      pixels[i+c]=Math.max(0,Math.min(255,v+grain*.5));
     }
     pixels[i+3]=255;
    }
   }
   ctx.putImageData(data,0,0);
   // Restore the rug's cream trim as small crisp pixels under the sprite.
   ctx.fillStyle='#d29d71';ctx.fillRect(642,279,101,4);
   ctx.fillStyle='#e6af74';ctx.fillRect(642,283,101,4);
   ctx.fillStyle='#bc7d58';ctx.fillRect(642,304,101,4);
   canvas.toBlob(blob=>{
    if(!blob)return;
    const url=URL.createObjectURL(blob);
    room.style.backgroundImage='url("'+url+'")';
    // On a phone, use the exact central section of the same cleaned
    // scene instead of the old mobile crop with the fixed character.
    if(mobile.matches){
      room.style.backgroundSize='auto 100%';
      room.style.backgroundPosition='56% center';
    }
    mobile.addEventListener('change',()=>{
     room.style.backgroundSize=mobile.matches?'auto 100%':'100% 100%';
     room.style.backgroundPosition=mobile.matches?'56% center':'center';
    });
    window.addEventListener('pagehide',()=>URL.revokeObjectURL(url),{once:true});
   },'image/png');
  };
  original.src='pixel-assets/room-desktop.webp';
 }
 cleanBackground();
 window.UpkeepRoomCoach={select,talk,requestTalk,mount:()=>room,coaches:art.roster};
 select('atlas');
})();
