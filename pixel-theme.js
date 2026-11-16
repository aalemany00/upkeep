/* Responsive pixel-art dashboard adapter — retains existing Upkeep Firebase controls. */
(() => {
  'use strict';
  const root = document.getElementById('view-dashboard');
  if (!root || root.dataset.pixelLayout) return;
  const stats = document.getElementById('dashboard-stats');
  const header = root.querySelector('.dash-header');
  const vitamins = document.getElementById('dashboard-vitamins-panel');
  const grids = [...root.querySelectorAll(':scope > .dash-grid-2col')];
  if (!stats || !header || !vitamins || grids.length !== 2) return;
  const first = grids[0], second = grids[1];
  const activity = first.querySelector(':scope > .panel');
  const stack = first.querySelector(':scope > .dash-col-stack');
  const stackPanels = stack ? [...stack.querySelectorAll(':scope > .panel')] : [];
  const secondPanels = [...second.querySelectorAll(':scope > .panel')];
  if (!activity || stackPanels.length < 2 || secondPanels.length < 2) return;
  const workout = stackPanels[0], habits = stackPanels[1];
  const meals = secondPanels[0], coachNotes = secondPanels[1];

  const element = (tag, className, title) => {
    const node = document.createElement(tag);
    node.className = className;
    if (title) node.setAttribute('aria-label', title);
    return node;
  };
  function section(title, className, glyph) {
    const s = element('section', 'pixel-frame ' + className);
    const h = element('h2', 'pixel-section-heading');
    const mark = element('span', 'pixel-heading-glyph');
    mark.textContent = glyph;
    h.append(mark, document.createTextNode(title));
    s.append(h);
    return s;
  }
  const room = element('div', 'pixel-room-hero', 'Cozy pixel-art bedroom, exercise equipment, and Upkeep coach');
  const speech = element('div', 'pixel-room-message');
  speech.textContent = 'Today’s a good day to keep your momentum going!';
  const coachLink = element('button', 'pixel-coach-hotspot', 'Visit your coach');
  coachLink.type = 'button';
  coachLink.dataset.switchView = 'coach';
  room.append(speech, coachLink);

  header.classList.add('pixel-dashboard-header');
  const layout = element('div', 'pixel-dashboard-layout');
  const overview = section('Daily Overview', 'pixel-overview', '▣');
  overview.append(header, stats);
  const nutrition = section('Nutrition', 'pixel-nutrition', '◕');
  const nutritionBody = element('div', 'pixel-nutrition-body');
  const nutritionStats = element('div', 'pixel-nutrition-stats');
  const calorieRow = document.createElement('div');
  const caloriesLabel = document.createElement('span');
  caloriesLabel.textContent = 'Calories';
  const caloriesValue = element('strong', '');
  caloriesValue.id = 'pixel-calories-value';
  caloriesValue.textContent = '—';
  calorieRow.append(caloriesLabel, caloriesValue);
  const proteinRow = document.createElement('div');
  const proteinLabel = document.createElement('span');
  proteinLabel.textContent = 'Protein';
  const proteinValue = element('strong', '');
  proteinValue.id = 'pixel-protein-value';
  proteinValue.textContent = '—';
  proteinRow.append(proteinLabel, proteinValue);
  const caption = document.createElement('small');
  caption.textContent = 'Based on your real daily food log';
  nutritionStats.append(calorieRow, proteinRow, caption);
  const donut = element('div', 'pixel-nutrition-donut', 'Calories logged as a percentage of goal');
  donut.id = 'pixel-nutrition-donut';
  const donutNumber = element('strong', 'pixel-nutrition-percent');
  donutNumber.id = 'pixel-nutrition-percent';
  donutNumber.textContent = '—';
  const donutLabel = document.createElement('small');
  donutLabel.textContent = 'of goal';
  donut.append(donutNumber, donutLabel);
  nutritionBody.append(nutritionStats, donut);
  nutrition.append(nutritionBody);
  const water = section('Water', 'pixel-water', '◈');
  const sleep = section('Sleep', 'pixel-sleep', '☾');
  const weight = section('Weight', 'pixel-weight', '◇');
  const waterSlot = element('div', 'pixel-live-slot');
  const sleepSlot = element('div', 'pixel-live-slot');
  const weightSlot = element('div', 'pixel-live-slot');
  water.append(waterSlot);
  sleep.append(sleepSlot);
  weight.append(weightSlot);
  const waterLink = element('button', 'pixel-mini-link');
  waterLink.type = 'button';
  waterLink.dataset.switchView = 'food';
  waterLink.textContent = '+ Log water';
  water.append(waterLink);
  const shortcuts = element('div', 'pixel-shortcuts');
  [['+ Log food', 'food'], ['View workout', 'gym'], ['Calendar', 'calendar']].forEach(([label, view]) => {
    const button = element('button', 'pixel-shortcut');
    button.type = 'button';
    button.dataset.switchView = view;
    button.textContent = label;
    shortcuts.append(button);
  });

  // Reparent the ORIGINAL panels rather than replacing markup and wiring.
  function addPanel(panel, className) {
    panel.classList.add('pixel-frame', className);
    layout.append(panel);
  }
  root.prepend(room);
  root.insertBefore(layout, grids[0]);
  layout.append(overview, nutrition, water, sleep);
  addPanel(workout, 'pixel-workout');
  addPanel(habits, 'pixel-habits');
  addPanel(activity, 'pixel-week');
  addPanel(meals, 'pixel-meals');
  addPanel(coachNotes, 'pixel-coach-notes');
  addPanel(vitamins, 'pixel-vitamins');
  layout.append(weight);
  root.insertBefore(shortcuts, layout.nextSibling);
  first.remove();
  second.remove();
  root.dataset.pixelLayout = 'ready';

  function findCard(cards, label) {
    return cards.find(node => node.querySelector('.stat-card-label')?.textContent.trim() === label);
  }
  function getMetric(label) {
    const cards = [...root.querySelectorAll('.stat-card')];
    const card = findCard(cards, label);
    const value = card?.querySelector('.stat-card-value')?.textContent || '';
    const numbers = value.match(/\d[\d,.]*/g) || [];
    return card ? {
      value: Number((numbers[0] || '0').replace(/,/g, '')),
      goal: Number((numbers[1] || '0').replace(/,/g, ''))
    } : null;
  }
  function updateNutrition() {
    const calories = getMetric('Calories'), protein = getMetric('Protein');
    if (!calories || !protein) return;
    caloriesValue.textContent = calories.value.toLocaleString() + ' / ' + (calories.goal ? calories.goal.toLocaleString() : '—');
    proteinValue.textContent = protein.value.toLocaleString() + ' / ' + (protein.goal ? protein.goal.toLocaleString() : '—') + ' g';
    const raw = calories.goal ? Math.round((calories.value / calories.goal) * 100) : 0;
    donut.style.setProperty('--pixel-progress-pct', Math.min(100, Math.max(0, raw)) + '%');
    donut.setAttribute('aria-label', calories.goal ? raw + '% of calorie goal reached' : 'No calorie goal set');
    donutNumber.textContent = calories.goal ? raw + '%' : '—';
  }
  function moveLiveCards() {
    // app.js replaces dashboard-stats children whenever date/data changes;
    // move the live card buttons after its synchronous event wiring finishes.
    const children = [...stats.children];
    if (children.length !== 6) return;
    const w = findCard(children, 'Water');
    const s = findCard(children, 'Sleep');
    const wt = findCard(children, 'Weight');
    if (!w || !s || !wt) return;
    waterSlot.replaceChildren(w);
    sleepSlot.replaceChildren(s);
    weightSlot.replaceChildren(wt);
    updateNutrition();
  }
  new MutationObserver(moveLiveCards).observe(stats, { childList: true });
  moveLiveCards();
})();