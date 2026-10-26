// Coach characters — real sprite art (Atlas, Pixel, Mira, Rex, Luna), each
// cropped from the reference sheet Adrian supplied into a face image
// (small badges) and a full-body image (the Coach tab hero). Pure data,
// no DOM/Firebase — same boundary as gym.js/nutrition.js/calendar.js.
// Rendering/animation is plain <img> + CSS (see app.js/style.css); this
// module only describes who each coach is and where their art lives.

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
    full: "avatars/atlas-full.png"
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
    full: "avatars/pixel-full.png"
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
    full: "avatars/mira-full.png"
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
    full: "avatars/rex-full.png"
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
    full: "avatars/luna-full.png"
  }
];

export function coachAvatarById(id) {
  return COACH_AVATARS.find((a) => a.id === id) || COACH_AVATARS[0];
}
