// Upkeep coach selection metadata. IDs are persisted in Firebase, so
// existing choices remain stable. The displayed portraits, full-body
// coaches and dashboard actor all use the SAME original raster artwork
// from pixel-assets/coaches-original.png via pixel-coach-sprites.js.
// Legacy avatars/*.png paths are fallback only, not the active design.
// Animated movement is CSS applied to those original image pixels.

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
  {
    "id": "nova",
    "name": "Nova",
    "title": "The Cardio Coach",
    "tagline": "Find your rhythm, one step at a time.",
    "subtitle": "Move a little. Feel a lot.",
    "badgeIcon": "footprints",
    "accent": "#d85e51",
    "face": "avatars/mira-face.png",
    "full": "avatars/mira-full.png",
    "idle": [
      "avatars/mira-full.png",
      "avatars/mira-idle2.png"
    ],
    "react": "avatars/mira-react.png"
  },
  {
    "id": "sage",
    "name": "Sage",
    "title": "The Wellness Coach",
    "tagline": "Progress includes caring for yourself.",
    "subtitle": "Breathe, stretch, and grow.",
    "badgeIcon": "lotus",
    "accent": "#6b9455",
    "face": "avatars/mira-face.png",
    "full": "avatars/mira-full.png",
    "idle": [
      "avatars/mira-full.png",
      "avatars/mira-idle2.png"
    ],
    "react": "avatars/mira-react.png"
  },
  {
    "id": "pace",
    "name": "Pace",
    "title": "The Movement Coach",
    "tagline": "Consistency is built in small moves.",
    "subtitle": "Find what keeps you moving.",
    "badgeIcon": "bicep",
    "accent": "#b98332",
    "face": "avatars/atlas-face.png",
    "full": "avatars/atlas-full.png",
    "idle": [
      "avatars/atlas-full.png",
      "avatars/atlas-idle2.png"
    ],
    "react": "avatars/atlas-react.png"
  }
];

export function coachAvatarById(id) {
  return COACH_AVATARS.find((a) => a.id === id) || COACH_AVATARS[0];
}
