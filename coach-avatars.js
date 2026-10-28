// Coach characters — real sprite art (Atlas, Pixel, Mira, Rex, Luna), each
// cropped from an AI-generated sprite pack Adrian supplied. Pure data, no
// DOM/Firebase — same boundary as gym.js/nutrition.js/calendar.js.
//
// `face`/`full` are the static poses (avatar picker thumbnail, and the
// first frame the Coach hero paints before animation kicks in). `idle`
// is a 2-frame full-body loop (same pose, blink/alt-idle variant) the
// Coach hero cycles through continuously; `react` is a third full-body
// celebratory frame swapped in briefly when the coach is clicked — a
// thumbs-up for Atlas/Pixel, an arms-up cheer for Mira/Rex/Luna (their
// pack's own thumbs-up pose had a source-art defect — a disconnected
// hand/arm for Luna, a paw clipped by the sprite sheet's own cell edge
// for Rex — so the cheer pose was used instead; same crop pipeline, just
// a different source frame). Actual cycling/swapping is plain JS + CSS
// (see app.js/style.css); this module only describes who each coach is
// and where their art lives.

export const COACH_AVATARS = [
  {
    id: "atlas",
    name: "Atlas",
    title: "The Trainer",
    tagline: "Discipline builds the freedom you want.",
    subtitle: "Strong habits. Bigger dreams.",
    badgeIcon: "leaf",
    accent: "#2f8f5b",
    face: "avatars/atlas-face.png",
    full: "avatars/atlas-full.png",
    idle: ["avatars/atlas-full.png", "avatars/atlas-idle2.png"],
    react: "avatars/atlas-react.png"
  },
  {
    id: "pixel",
    name: "Pixel",
    title: "The Tech Coach",
    tagline: "Small progress adds up to big results.",
    subtitle: "Track. Improve. Level up.",
    badgeIcon: "code",
    accent: "#2f6fb8",
    face: "avatars/pixel-face.png",
    full: "avatars/pixel-full.png",
    idle: ["avatars/pixel-full.png", "avatars/pixel-idle2.png"],
    react: "avatars/pixel-react.png"
  },
  {
    id: "mira",
    name: "Mira",
    title: "The Mindset Coach",
    tagline: "You're doing better than you think. Keep going.",
    subtitle: "A healthier mind builds a stronger you.",
    badgeIcon: "lotus",
    accent: "#8a6fd1",
    face: "avatars/mira-face.png",
    full: "avatars/mira-full.png",
    idle: ["avatars/mira-full.png", "avatars/mira-idle2.png"],
    react: "avatars/mira-react.png"
  },
  {
    id: "rex",
    name: "Rex",
    title: "The Progress Coach",
    tagline: "Every rep, every step, gets you closer!",
    subtitle: "Progress over perfection.",
    badgeIcon: "paw",
    accent: "#c9892f",
    face: "avatars/rex-face.png",
    full: "avatars/rex-full.png",
    idle: ["avatars/rex-full.png", "avatars/rex-idle2.png"],
    react: "avatars/rex-react.png"
  },
  {
    id: "luna",
    name: "Luna",
    title: "The Recovery Coach",
    tagline: "Rest isn't lazy — it's part of the plan.",
    subtitle: "Recover. Refuel. Come back stronger.",
    badgeIcon: "moon",
    accent: "#2e8f82",
    face: "avatars/luna-face.png",
    full: "avatars/luna-full.png",
    idle: ["avatars/luna-full.png", "avatars/luna-idle2.png"],
    react: "avatars/luna-react.png"
  }
];

export function coachAvatarById(id) {
  return COACH_AVATARS.find((a) => a.id === id) || COACH_AVATARS[0];
}
