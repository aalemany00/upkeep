// Upkeep coach metadata and stable saved IDs. Displayed artwork is the
// original 16-frame PNG cutout atlas from pixel-coach-sprites.js, not the
// legacy five-pose placeholders. All seven coaches have approved names.
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
  },

  // Scout and Blaze retain their original IDs to preserve saved selections
  // and existing cutout asset paths.
  {
    id: "outdoor-coach",
    name: "Scout",
    title: "Outdoor Movement",
    tagline: "Take your fitness journey one step at a time.",
    subtitle: "Explore, breathe, and keep moving.",
    badgeIcon: "footprints",
    accent: "#5a8864",
    face: "pixel-assets/cutouts/outdoor-coach-portrait.png",
    full: "pixel-assets/cutouts/outdoor-coach-atlas.png",
    idle: [], react: ""
  },
  {
    id: "red-hoodie-coach",
    name: "Blaze",
    title: "Movement & Progress",
    tagline: "A little progress every day adds up.",
    subtitle: "Find your pace and enjoy the work.",
    badgeIcon: "dumbbell",
    accent: "#b96658",
    face: "pixel-assets/cutouts/red-hoodie-coach-portrait.png",
    full: "pixel-assets/cutouts/red-hoodie-coach-atlas.png",
    idle: [], react: ""
  }

];

export function coachAvatarById(id) {
  return COACH_AVATARS.find((a) => a.id === id) || COACH_AVATARS[0];
}
