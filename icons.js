// Line-icon set + a circular progress ring, matching the mockup's icon
// style (simple 2px-stroke outline icons, rounded caps). Pure functions,
// no DOM/Firebase — same boundary as gym.js/calendar.js/coach-avatars.js.
// Icon path data is hand-written (not pulled from any icon library at
// runtime), kept minimal, in the spirit of lucide-style outline icons.

function svg(paths, { size = 20, stroke = "currentColor", fill = "none" } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

const ICON_PATHS = {
  leaf: `<path d="M11 20A7 7 0 0 1 4 13c0-4 4-9 7-11 3 2 7 7 7 11a7 7 0 0 1-7 7Z"/><path d="M11 20v-9"/>`,
  home: `<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>`,
  utensils: `<path d="M7 2v7a2 2 0 0 0 2 2v11"/><path d="M7 2v7"/><path d="M11 2v7"/><path d="M17 2c-1.5 0-3 1.5-3 4v6h3"/><path d="M17 12v10"/>`,
  dumbbell: `<path d="M4 9v6"/><path d="M2 10v4"/><path d="M20 9v6"/><path d="M22 10v4"/><path d="M7 7v10"/><path d="M17 7v10"/><path d="M7 12h10"/>`,
  calendar: `<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>`,
  "message-circle": `<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1Z"/>`,
  flame: `<path d="M8.5 14.5A3.5 3.5 0 0 0 12 18a3.5 3.5 0 0 0 3.5-3.5c0-1.5-1-2.5-1-4 0 1-1 2-1 2s0-4-3-6c.5 2 0 4-1.5 5.5-1 1-1 2.5-1 2.5Z"/>`,
  bicep: `<path d="M6 4c3 0 4 2 4 4v2l4-1c2-.5 4 1 4 3 0 3-2 5-5 5.5L9 18l-2 2-3-3 1-2-1-2c-1-2-1-5 0-7 .5-1 1-2 2-2Z"/>`,
  droplet: `<path d="M12 2.5s6 6.7 6 11.2a6 6 0 1 1-12 0C6 9.2 12 2.5 12 2.5Z"/>`,
  footprints: `<path d="M9.5 8.5c.8 0 1.5-1 1.5-2.2S10.3 4 9.5 4 8 5.1 8 6.3s.7 2.2 1.5 2.2Z"/><path d="M6.5 14.5c1 0 2-1.3 2-3s-1-3-2-3-2 1.3-2 3 1 3 2 3Z"/><path d="M8 16.5c0 1.5 1 2.5 2.5 2.5"/><path d="M15.5 13.5c.8 0 1.5-1 1.5-2.2S16.3 9 15.5 9 14 10.1 14 11.3s.7 2.2 1.5 2.2Z"/><path d="M17.5 19.5c1 0 2-1.3 2-3s-1-3-2-3-2 1.3-2 3 1 3 2 3Z"/><path d="M14 10c0-1.5 1-2.5 2.5-2.5"/>`,
  "bar-chart": `<path d="M7 20V10"/><path d="M12 20V4"/><path d="M17 20v-7"/><path d="M3 20h18"/>`,
  "check-circle": `<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>`,
  pill: `<rect x="4" y="9" width="16" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="M8.5 8.5 15.5 15.5"/>`,
  "chevron-right": `<path d="m9 6 6 6-6 6"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/>`,
  moon: `<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>`,
  plus: `<path d="M12 5v14"/><path d="M5 12h14"/>`,
  send: `<path d="m3 11 18-8-8 18-2-8-8-2Z"/>`,
  "log-out": `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>`,
  mountain: `<path d="m8 17 4-7 4 7"/><path d="m3 17 6-11 4 7"/><path d="M21 17H3"/>`,
  list: `<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>`,
  "chevron-left": `<path d="m15 18-6-6 6-6"/>`

};

export function icon(name, opts) {
  const paths = ICON_PATHS[name];
  if (!paths) return "";
  return svg(paths, opts);
}

// A single progress ring: track circle + an arc for `percent` (0-100),
// centered label. Pure SVG string, colors via CSS vars so it follows the
// active theme automatically.
export function progressRingSvg(percent, { size = 56, stroke = 5, label } = {}) {
  const pct = Math.max(0, Math.min(100, percent || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  const center = size / 2;
  const text = label !== undefined ? label : `${Math.round(pct)}%`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="progress-ring">
    <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="var(--ring-track)" stroke-width="${stroke}"/>
    <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="var(--accent)" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
      transform="rotate(-90 ${center} ${center})"/>
    <text x="${center}" y="${center}" text-anchor="middle" dominant-baseline="central" font-size="${size * 0.22}" font-weight="700" fill="var(--text)">${text}</text>
  </svg>`;
}

// Small decorative illustration for the sidebar footer ("Small steps build
// big results."). Plain geometric shapes, not copied from any source.
export function mountainIllustrationSvg(width = 140, height = 60) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 140 60" fill="none">
    <path d="M0 55 L28 18 L46 38 L62 10 L88 42 L104 24 L140 55 Z" fill="var(--accent)" opacity="0.18"/>
    <path d="M10 55 L38 24 L56 42 L74 16 L96 46 L116 28 L140 55 Z" fill="var(--accent)" opacity="0.35"/>
    <circle cx="112" cy="14" r="8" fill="var(--accent)" opacity="0.5"/>
  </svg>`;
}
