/* Upkeep room coach — original lossless sprite art, autonomous daily activities,
   and one conversation bubble only when the user interacts. */
(function roomCoachScene() {
  'use strict';
  const art = window.UpkeepCoachSprites;
  const room = document.querySelector('#view-dashboard .pixel-room-hero');
  if (!art || !room || room.dataset.coachSceneReady) return;
  room.dataset.coachSceneReady = 'true';

  const speech = room.querySelector('.pixel-room-message');
  const oldHotspot = room.querySelector('.pixel-coach-hotspot');
  if (oldHotspot) oldHotspot.hidden = true;
  if (speech) {
    speech.textContent = '';
    speech.hidden = true;
    speech.setAttribute('role', 'status');
    speech.setAttribute('aria-live', 'polite');
  }

  const actor = document.createElement('button');
  actor.type = 'button';
  actor.className = 'pixel-room-character';
  actor.setAttribute('aria-label', 'Talk to your fitness coach');
  actor.style.left = '40%';
  room.append(actor);

  const mobile = window.matchMedia('(max-width:760px)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const randomBetween = (a, b) => a + Math.random() * (b - a);
  const coreIds = new Set(art.coreIds || []);
  let selected = null;
  let currentSpot = 40;
  let isTalking = false;
  let isWalking = false;
  let motionEpoch = 0;
  let poseTimer = null;
  let activeTimers = new Set();
  let previousActivity = '';

  const choice = () => art.roster.find(item => item.id === selected) || art.roster[0];
  const waypoints = () => mobile.matches ? [21, 30, 43, 54, 65] : [30, 37, 46, 53, 61, 67];
  const isVisible = () => !document.hidden && room.isConnected && room.getClientRects().length > 0;
  // Every pose is an ORIGINAL frame from the user's 4x4 PNG atlas.
  // No CSS scaling/rotation is used to fake squats, walking or stretching.
  const sprite = () => actor.querySelector('.pixel-room-art');
  const poseFrame = (action, index = 0) => {
    actor.dataset.pose = action;
    const frames = art.frameSequence(selected || 'atlas', action);
    art.setFrame(sprite(), frames[index % frames.length]);
  };
  const setPose = name => poseFrame(name === 'walk1' || name === 'walk2' ? 'walk' : name);
  const schedule = (callback, delay) => {
    const token = motionEpoch;
    const t = setTimeout(() => {
      activeTimers.delete(t);
      if (token === motionEpoch) callback();
    }, delay);
    activeTimers.add(t);
  };
  function clearMotion() {
    motionEpoch++;
    for (const t of activeTimers) clearTimeout(t);
    activeTimers.clear();
    clearInterval(poseTimer);
    poseTimer = null;
    actor.classList.remove('is-walking', 'is-exercising', 'is-stretching', 'is-talking');
    isWalking = false;
  }
  function hideSpeech() {
    if (!speech) return;
    speech.hidden = true;
    speech.textContent = '';
    speech.classList.remove('show');
  }
  // Freeze the current interpolated position, not the final destination.
  // This prevents the coach from sliding away after being clicked mid-walk.
  function freeze() {
    const stage = room.getBoundingClientRect();
    const sprite = actor.getBoundingClientRect();
    actor.classList.add('is-frozen');
    if (stage.width && sprite.width) {
      const x = Math.max(0, sprite.left - stage.left);
      actor.style.left = x.toFixed(2) + 'px';
      currentSpot = Math.max(0, Math.min(100, x / stage.width * 100));
    }
    actor.style.transitionDuration = '0ms';
  }
  function placeAt(percentage) {
    actor.classList.add('is-frozen');
    actor.style.left = percentage + '%';
    actor.style.transitionDuration = '0ms';
    currentSpot = percentage;
  }
  function beginMovement() {
    // No self-rescheduling here when not visible: roomVisibility (below)
    // restarts the routine the moment the Dashboard actually comes back
    // into view, instead of this polling every ~1.2s forever in the
    // background on every other tab for as long as the page stays open.
    if (reduce.matches || isTalking || !isVisible()) return;
    const choices = waypoints().filter(value => Math.abs(value - currentSpot) > 8);
    const destination = choices[Math.floor(Math.random() * choices.length)] ?? waypoints()[0];
    const distance = Math.abs(destination - currentSpot);
    const duration = Math.max(1500, Math.min(5100, distance * 115 + 550));
    actor.dataset.facing = destination < currentSpot ? 'left' : 'right';
    actor.classList.add('is-walking');
    isWalking = true;
    let phase = 0;
    poseFrame('walk', phase);
    poseTimer = setInterval(() => poseFrame('walk', ++phase), art.frameInterval(selected, 'walk'));
    // Force one layout read so removing the frozen class starts a real
    // CSS transition even immediately after previous animations.
    void actor.offsetWidth;
    actor.classList.remove('is-frozen');
    actor.style.transitionDuration = duration + 'ms';
    actor.style.left = destination + '%';
    schedule(() => {
      clearInterval(poseTimer);
      poseTimer = null;
      actor.classList.remove('is-walking');
      isWalking = false;
      currentSpot = destination;
      setPose('idle');
      // Natural sequence: sometimes exercise after reaching the gym.
      if (Math.random() < .45) doActivity(Math.random() < .7 ? 'exercise' : 'stretch');
      else schedule(nextActivity, randomBetween(250, 1050));
    }, duration + 60);
  }
  function doActivity(kind) {
    if (isTalking || reduce.matches || !isVisible()) return;
    const stretching = kind === 'stretch';
    actor.classList.add(stretching ? 'is-stretching' : 'is-exercising');
    previousActivity = kind;
    let n = 0;
    const action = stretching ? 'stretch' : 'exercise';
    const frames = art.frameSequence(selected, action);
    // Coaches whose "exercise" is pulling out a tablet/map (not a rep)
    // pause on the "looking at it" frame for a random, reasonable beat
    // instead of cycling through on the same clock as an actual exercise
    // -- see DEVICE_HOLDS. Driven by a self-rescheduling step rather than
    // setInterval specifically so each step can have its own delay.
    const hold = !stretching && art.deviceHold ? art.deviceHold(selected) : null;
    const base = art.frameInterval(selected, action);
    poseFrame(action, n);
    (function stepFrame() {
      const dwell = hold && (n % frames.length) === hold.at ? randomBetween(hold.min, hold.max) : base;
      schedule(() => { n++; poseFrame(action, n); stepFrame(); }, dwell);
    })();
    schedule(() => {
      actor.classList.remove('is-stretching', 'is-exercising');
      setPose('idle');
      schedule(nextActivity, randomBetween(350, 1200));
    }, stretching ? randomBetween(2500, 4100) : randomBetween(2900, 5300));
  }
  function nextActivity() {
    if (isTalking || reduce.matches || !isVisible()) return;
    const roll = Math.random();
    if (roll < .56 || previousActivity === 'idle') {
      previousActivity = 'walk';
      beginMovement();
    } else if (roll < .82) {
      doActivity('exercise');
    } else if (roll < .96) {
      doActivity('stretch');
    } else {
      previousActivity = 'idle';
      let phase = 0;
      poseFrame('idle', 0);
      clearInterval(poseTimer);
      poseTimer = setInterval(() => poseFrame('idle', ++phase), art.frameInterval(selected, 'idle'));
      schedule(() => { clearInterval(poseTimer); poseTimer = null; nextActivity(); }, randomBetween(850, 1900));
    }
  }
  function startAutonomous(delay = 350) {
    if (isTalking) return;
    clearMotion();
    setPose('idle');
    if (!reduce.matches) schedule(nextActivity, delay);
  }
  function select(id) {
    if (!art.roster.some(item => item.id === id)) id = 'atlas';
    // Critical: goals snapshots rerender coach badges frequently.
    // Selecting the SAME coach must NOT restart the walking routine.
    if (selected === id && actor.dataset.coachId === id) return;
    clearMotion();
    hideSpeech();
    isTalking = false;
    selected = id;
    const hasFrames = coreIds.has(id);
    actor.classList.toggle('pixel-room-poses', hasFrames);
    actor.classList.toggle('pixel-room-still', !hasFrames);
    actor.dataset.coachId = id;
    const dimensions = art.dimensions?.[id];
    if (dimensions) actor.style.aspectRatio = dimensions[0] + ' / ' + dimensions[1];
    // Keep the left/right facing transform on a separate wrapper so it
    // cannot be overridden by the sprite's walk, talk or stretch animation.
    actor.innerHTML = '<span class="pixel-room-facing">' +
      art.markup(id, 'pixel-room-art') + '</span>';
    actor.setAttribute('aria-label', 'Talk to ' + choice().name + ', your fitness coach');
    placeAt(mobile.matches ? 30 : 40);
    setPose('idle');
    startAutonomous(randomBetween(650, 1400));
  }
  function positionSpeech() {
    if (!speech || speech.hidden) return;
    if (mobile.matches) {
      speech.style.left = '50%';
      speech.style.top = '9px';
      speech.style.bottom = 'auto';
      return;
    }
    const stage = room.getBoundingClientRect();
    const sprite = actor.getBoundingClientRect();
    const width = Math.min(320, Math.max(230, stage.width * .25));
    const center = sprite.left - stage.left + sprite.width / 2;
    speech.style.left = Math.max(width / 2 + 16, Math.min(stage.width - width / 2 - 16, center)) + 'px';
    speech.style.top = 'auto';
    speech.style.bottom = Math.max(85, stage.bottom - sprite.top + 5) + 'px';
  }
  function talk(line) {
    const message = String(line || choice().tagline).trim();
    // Exactly ONE message: the room speech bubble. No sidebar click.
    clearMotion();
    freeze();
    isTalking = true;
    actor.classList.add('is-talking');
    if (speech) {
      speech.textContent = message;
      speech.title = message;
      speech.hidden = false;
      speech.classList.add('show');
      positionSpeech();
    }
    poseFrame('talk', 0);
    if (!reduce.matches) {
      let frame = 0;
      poseTimer = setInterval(() => poseFrame('talk', ++frame), art.frameInterval(selected, 'talk'));
    }
    schedule(() => {
      clearInterval(poseTimer);
      poseTimer = null;
      actor.classList.remove('is-talking');
      setPose('idle');
      hideSpeech();
      isTalking = false;
      startAutonomous(randomBetween(450, 1100));
    }, 5500);
  }
  function dismiss() {
    if (!isTalking && (!speech || speech.hidden)) return;
    clearMotion();
    hideSpeech();
    isTalking = false;
    setPose('idle');
    startAutonomous(650);
  }
  function requestTalk() {
    if (isTalking) return; // avoid overlapping dialogue when tapped repeatedly
    const detail = { coachId: selected, handled: false };
    document.dispatchEvent(new CustomEvent('upkeep:request-room-coach-dialogue', { detail }));
    if (!detail.handled) talk(choice().tagline);
  }
  actor.addEventListener('click', requestTalk);
  speech?.addEventListener('click', dismiss);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearMotion();
      hideSpeech();
      isTalking = false;
      setPose('idle');
    } else {
      startAutonomous(700);
    }
  });
  const onScreenSizeChange = () => {
    if (isTalking) positionSpeech();
    else if (!isWalking) placeAt(Math.max(15, Math.min(68, currentSpot)));
  };
  mobile.addEventListener('change', onScreenSizeChange);
  window.addEventListener('resize', onScreenSizeChange);
  reduce.addEventListener('change', () => {
    if (!isTalking) startAutonomous(500);
  });
  // The Dashboard view is just display:none (not removed) when another
  // tab is open, so this is what actually restarts the routine when it
  // comes back -- beginMovement/doActivity/nextActivity no longer poll
  // for that themselves.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      const entry = entries[entries.length - 1];
      if (entry.isIntersecting) {
        if (!document.hidden) startAutonomous(400);
      } else if (!isTalking) {
        clearMotion();
        setPose('idle');
      }
    }, { threshold: 0 }).observe(room);
  }
  window.UpkeepRoomCoach = Object.freeze({
    select, talk, requestTalk, dismiss,
    mount: () => room,
    coaches: art.roster,
    getState: () => ({ coach: selected, activity: isTalking ? 'talk' : actor.className, pose: actor.dataset.pose })
  });
  select('atlas');
})();