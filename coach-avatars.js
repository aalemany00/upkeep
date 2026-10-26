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

// Shared 16x16 bust shape, built from 8-character half-rows mirrored left-
// right (mirrorRow) so symmetry is guaranteed rather than hand-typed twice.
// Legend: H hair, P headband accessory, S skin, C cheek blush, K dark
// outline (glasses frame), G glasses lens, E pupil, N nose shadow, W smile
// highlight, B shirt, T collar trim.
function mirrorRow(half) {
  return half + [...half].reverse().join("");
}

const HEAD_HALF_ROWS = [
  ".....HHH", // 0  hair crown
  "...HHHHH", // 1  hair crown
  "..HHHHHH", // 2  hair crown
  ".HHHHHHH", // 3  hair crown
  "HHHHHHHH", // 4  hair band / temples
  "HSSSSSSS", // 5  hairline
  "SKKKKKKK", // 6  glasses frame (top)
  "SGEGGGGK", // 7  glasses lenses + pupils
  "SKKKKKKK", // 8  glasses frame (bottom)
  "CSSSSSSS", // 9  cheeks
  "SSSSSSSN", // 10 nose shadow
  "SSSSSSSW", // 11 smile
  ".SSSSSSS", // 12 chin
  "..SSSSSS", // 13 neck
  ".BBBBBBB", // 14 shoulders
  "BBBBBBBT"  // 15 shirt + collar trim
];

function headGrid(overrides = {}) {
  return HEAD_HALF_ROWS.map((row, i) => mirrorRow(overrides[i] ?? row));
}

export const COACH_AVATARS = [
  {
    id: "sage",
    name: "Coach Sage",
    tagline: "Calm and steady — built for consistency over intensity.",
    grid: headGrid(),
    palette: {
      H: "#2fa37a", S: "#e8b98a", C: "#e2896b", K: "#1c2b27", G: "#bfe3d6",
      E: "#16231f", W: "#ffffff", N: "#d9a06f", B: "#2d3436", T: "#3fae6a"
    }
  },
  {
    id: "blaze",
    name: "Coach Blaze",
    tagline: "High energy — loves a PR and will tell you about it.",
    // A sweatband replaces the top hair row.
    grid: headGrid({ 1: "...PPPPP" }),
    palette: {
      H: "#e4572e", P: "#ffffff", S: "#c98a5a", C: "#b85b3a", K: "#241208",
      G: "#ffd9c2", E: "#2a150a", W: "#ffffff", N: "#a86f45", B: "#1f2a44", T: "#ffffff"
    }
  },
  {
    id: "nova",
    name: "Coach Nova",
    tagline: "Easygoing and encouraging — no bad workouts, just data.",
    // Solid dark lenses (no visible pupil) read as sunglasses.
    grid: headGrid({ 7: "SKKKKKKK" }),
    palette: {
      H: "#7c5cff", S: "#f0c9a0", C: "#e8a98f", K: "#2a1f12",
      W: "#ffffff", N: "#d1a876", B: "#1f6f63", T: "#39a98f"
    }
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
