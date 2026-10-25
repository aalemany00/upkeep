// Original pixel-art coach avatars — style-inspired by the redesign mockups
// (flat color-block pixel characters), not copied from them or from any
// existing character. Pure data + a pure SVG-string builder, no DOM/Firebase
// — same boundary as gym.js/nutrition.js/calendar.js/warmups.js.
//
// Each grid is a fixed-size array of equal-length strings. Every character
// is a palette key; "." is always transparent. pixelAvatarSvg() turns a
// (grid, palette) pair into a crisp, scale-free inline SVG (one <rect> per
// pixel, so it stays sharp at any display size without image-rendering
// hacks).

// Shared 10x10 bust shape: cap/hair (H), skin (S), eyes (E), smile
// highlight (W), shirt (B). "A" is a per-character accessory that each
// avatar's own grid repurposes differently (headband, visor, collar trim).
const BASE_GRID = [
  "..HHHHHH..",
  ".HHHHHHHH.",
  "HHHHHHHHHH",
  "HSSSSSSSSH",
  "SSSSSSSSSS",
  "SSEESSEESS",
  "SSSSSSSSSS",
  "SSSWWWWSSS",
  ".BBBBBBBB.",
  "BBBBBBBBBB"
];

export const COACH_AVATARS = [
  {
    id: "sage",
    name: "Coach Sage",
    tagline: "Calm and steady — built for consistency over intensity.",
    grid: BASE_GRID,
    palette: { H: "#2fa37a", S: "#e8b98a", E: "#1c2b27", W: "#ffffff", B: "#2d3436" }
  },
  {
    id: "blaze",
    name: "Coach Blaze",
    tagline: "High energy — loves a PR and will tell you about it.",
    grid: [
      "..AAAAAA..",
      ".HHHHHHHH.",
      "HHHHHHHHHH",
      "HSSSSSSSSH",
      "SSSSSSSSSS",
      "SSEESSEESS",
      "SSSSSSSSSS",
      "SSSWWWWSSS",
      ".BBBBBBBB.",
      "BBBBBBBBBB"
    ],
    palette: { H: "#e4572e", S: "#c98a5a", E: "#241208", W: "#ffffff", B: "#1f2a44", A: "#ffffff" }
  },
  {
    id: "nova",
    name: "Coach Nova",
    tagline: "Easygoing and encouraging — no bad workouts, just data.",
    grid: [
      "..HHHHHH..",
      ".HHHHHHHH.",
      "HHHHHHHHHH",
      "HSSSSSSSSH",
      "SSSSSSSSSS",
      "SSAAAAAASS",
      "SSSSSSSSSS",
      "SSSWWWWSSS",
      ".BBBBBBBB.",
      "BBBBBBBBBB"
    ],
    palette: { H: "#7c5cff", S: "#f0c9a0", E: "#2a1f12", W: "#ffffff", B: "#1f6f63", A: "#20232a" }
  }
];

export function pixelAvatarSvg(grid, palette, size = 96) {
  const rows = grid.length;
  const cols = grid[0].length;
  const px = size / cols;
  let rects = "";
  for (let y = 0; y < rows; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const key = row[x];
      if (key === ".") continue;
      const color = palette[key];
      if (!color) continue;
      rects += `<rect x="${(x * px).toFixed(2)}" y="${(y * px).toFixed(2)}" width="${px.toFixed(2)}" height="${px.toFixed(2)}" fill="${color}"/>`;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="pixel-art coach avatar">${rects}</svg>`;
}

export function coachAvatarById(id) {
  return COACH_AVATARS.find((a) => a.id === id) || COACH_AVATARS[0];
}

export function coachAvatarSvgById(id, size = 96) {
  const avatar = coachAvatarById(id);
  return pixelAvatarSvg(avatar.grid, avatar.palette, size);
}
