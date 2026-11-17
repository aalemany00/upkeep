(function installPixelCoachArt(){
  'use strict';
  const ids = Object.freeze(['atlas','pixel','mira','rex','luna']);
  const C={ink:'#322529',skin:'#e7ac83',skin2:'#f8c29a',shadow:'#bf795e',shoe:'#f7e9d2',cream:'#f2e3c5'};
  const r=(x,y,w,h,fill,cls='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${cls?` class="${cls}"`:''}/>`;
  const p=(d,fill,cls='')=>`<path d="${d}" fill="${fill}"${cls?` class="${cls}"`:''}/>`;
  function face(skin=C.skin2,dog=false){
    return (dog?'':r(18,22,4,9,skin)+r(43,22,4,9,skin))+
      r(21,15,24,22,C.ink)+r(23,16,20,20,skin)+r(25,30,16,6,C.shadow)+r(25,17,17,13,skin)+
      r(27,23,3,4,C.ink)+r(36,23,3,4,C.ink)+r(30,29,6,2,'#a25852','pixel-mouth')+r(33,31,2,1,C.ink);
  }
  function shoes(wide=false){
    return r(wide?15:21,78,12,5,C.ink)+r(wide?36:37,78,12,5,C.ink)+r(wide?16:22,78,10,3,C.shoe)+r(wide?37:38,78,10,3,C.shoe);
  }
  function legs(left='#393746',right=left){
    return `<g class="pixel-leg-left">${r(24,59,9,20,C.ink)}${r(26,61,7,17,left)}</g>`+
      `<g class="pixel-leg-right">${r(34,59,9,20,C.ink)}${r(35,61,7,17,right)}</g>`+shoes();
  }
  function atlas(){
    return r(21,13,25,22,'#392930')+r(18,10,7,10,'#392930')+r(27,8,12,8,'#392930')+r(40,12,5,8,'#392930')+
      face('#e8b18a')+r(18,16,29,3,C.cream)+legs('#333844')+
      `<g class="pixel-arm-left">${r(11,39,11,20,C.ink)}${r(13,40,9,17,'#e7a17b')}${r(12,53,10,5,'#493d37')}</g>`+
      `<g class="pixel-arm-right">${r(45,39,10,20,C.ink)}${r(46,40,8,17,'#e7a17b')}${r(46,53,9,5,'#493d37')}</g>`+
      r(20,36,28,27,C.ink)+r(23,38,22,23,'#355f48')+r(26,41,16,8,'#517e5a')+
      r(31,45,8,3,C.cream)+r(33,43,3,8,C.cream)+r(22,58,23,5,'#293b33')+r(25,61,18,3,'#c5a67d');
  }
  function pixel(){
    return legs('#637b8b','#637b8b')+
      `<g class="pixel-arm-left">${r(11,41,11,17,C.ink)}${r(13,43,8,13,'#ece1d0')}${r(10,54,12,7,C.ink)}${r(12,55,10,5,'#66869b')}</g>`+
      `<g class="pixel-arm-right">${r(43,42,12,17,C.ink)}${r(45,43,9,13,'#e7dacf')}${r(47,54,12,6,'#678ca4')}</g>`+
      r(21,37,25,28,C.ink)+r(23,39,21,23,'#e6e1d4')+r(29,44,10,8,'#314758')+r(31,47,2,3,'#75d4d1')+r(35,45,2,5,'#75d4d1')+
      r(14,13,39,27,C.ink)+r(17,16,33,21,'#ded8cb')+r(21,20,25,15,'#293e4d')+
      r(25,27,5,3,'#79d6d1')+r(37,27,5,3,'#79d6d1')+r(29,32,10,2,'#79d6d1','pixel-mouth')+
      r(31,8,5,7,C.ink)+r(32,6,3,5,'#f6b860')+r(18,38,8,4,'#60778b')+r(40,38,8,4,'#60778b');
  }
  function mira(){
    return r(14,10,15,45,'#3f2d43')+r(40,7,17,44,'#3f2d43')+r(16,6,30,14,'#4f3552')+r(41,6,12,16,'#4f3552')+
      face('#ebae8c')+r(19,9,26,8,'#56384b')+r(19,13,9,6,'#56384b')+r(41,11,7,10,'#56384b')+
      legs('#66506d','#66506d')+
      `<g class="pixel-arm-left">${r(16,39,9,25,C.ink)}${r(18,40,7,17,'#aa82b7')}${r(19,56,6,7,'#e9af88')}</g>`+
      `<g class="pixel-arm-right">${r(42,41,9,24,C.ink)}${r(43,42,7,16,'#aa82b7')}${r(44,57,6,7,'#e9af88')}</g>`+
      r(23,37,23,27,C.ink)+r(25,38,19,24,'#a57eae')+r(26,41,16,5,'#d6b4da')+
      r(29,45,11,4,'#efdbd8')+r(25,59,20,5,'#6b5174');
  }
  function rex(){
    return p('M14 54 H3 V47 H10 V40 H20 Z','#b87943')+p('M52 52 H60 V43 H54 V37 H47 Z','#bd8248')+
      legs('#5a423e','#5a423e')+
      `<g class="pixel-arm-left">${r(12,42,12,21,C.ink)}${r(14,43,10,18,'#d99a54')}${r(11,55,12,8,'#ba7c42')}</g>`+
      `<g class="pixel-arm-right">${r(43,41,13,23,C.ink)}${r(44,42,12,20,'#d89b55')}${r(47,54,9,9,'#be7d42')}</g>`+
      r(21,39,27,25,C.ink)+r(23,40,23,23,'#bd6945')+r(29,47,5,8,'#f2ce9a')+r(36,47,4,8,'#efc595')+
      r(16,17,34,22,C.ink)+r(20,11,26,24,'#d69a5c')+
      r(9,16,12,20,C.ink)+r(11,18,8,17,'#ba7946')+r(45,15,12,19,C.ink)+r(47,17,8,16,'#b77745')+
      r(23,22,21,14,'#f1d2a1')+r(25,22,5,4,C.ink)+r(38,22,5,4,C.ink)+r(30,27,6,4,C.ink)+
      r(27,33,13,2,'#9d5550','pixel-mouth')+r(31,35,5,4,'#f18f83')+r(17,18,3,7,'#efb876')+r(48,20,4,6,'#efb876');
  }
  function luna(){
    return r(18,12,30,46,'#273a40')+r(15,17,7,41,'#273a40')+r(44,12,8,45,'#273a40')+
      face('#e3af8e')+r(18,11,31,9,'#334850')+r(22,9,22,6,'#334850')+r(17,18,8,13,'#334850')+
      r(23,12,6,5,'#769e9a')+r(27,13,3,4,'#e7d2ac')+
      legs('#e6d6be','#e6d6be')+
      `<g class="pixel-arm-left">${r(10,40,16,25,C.ink)}${r(12,42,14,21,'#395f5c')}${r(14,59,8,4,'#2a4947')}</g>`+
      `<g class="pixel-arm-right">${r(40,40,15,25,C.ink)}${r(41,42,13,21,'#395f5c')}${r(44,59,7,4,'#2a4947')}</g>`+
      r(21,37,28,27,C.ink)+r(23,39,24,24,'#426e69')+r(29,39,11,19,'#f1e1c9')+r(27,58,15,6,'#385c59')+
      r(34,46,4,3,'#d9b773')+r(36,43,4,2,'#d9b773');
  }
  const sprites={atlas,pixel,mira,rex,luna};
  function svg(rawId,extraClass=''){
    const id=ids.includes(rawId)?rawId:'atlas';
    return `<svg xmlns="http://www.w3.org/2000/svg" class="pixel-coach-sprite pixel-sprite-${id}${extraClass?' '+extraClass:''}" viewBox="0 0 68 88" role="img" aria-label="${id} pixel coach" shape-rendering="crispEdges" preserveAspectRatio="xMidYMax meet">${sprites[id]()}</svg>`;
  }
  function select(id){
    const choice=ids.includes(id)?id:'atlas';
    document.querySelectorAll('[data-pixel-coach-display]').forEach(el=>{
      if(el.dataset.pixelCoachId===choice)return;
      el.dataset.pixelCoachId=choice;
      el.innerHTML=svg(choice);
      el.setAttribute('aria-label',choice+' coach');
    });
    return choice;
  }
  window.UpkeepPixelCoachArt=Object.freeze({ids,svg,select});
})();
