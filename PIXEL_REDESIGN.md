# Pixel-art responsive redesign (review branch)

This branch applies the approved cozy pixel-art mockup to the **existing Upkeep app**.

## Implementation
- `pixel-theme.css` overrides presentation tokens and gives the existing views a warm parchment / forest-green pixel-art appearance. Mobile retains Upkeep’s native bottom tab bar and More sheet.
- `pixel-theme.js` reorganizes the **real Dashboard DOM nodes** into a responsive layout while retaining their IDs, event handlers, edit forms, and Firestore-backed values. It runs as a defer script before the original `app.js` module.
- The room, mobile crop, and sidebar landscape are standalone assets in `pixel-assets/`.
- `index.html` loads the visual layer, and `sw.js` caches its files for offline use.

## Data and behavior
No changes to `app.js`, Firestore collections, authorization, the gym algorithm, nutrition calculations, or calendar integrations. Calories/protein/steps are real Dashboard cards; Water, Sleep, and Weight retain their original controls. The nutrition donut intentionally represents **calorie goal progress**, not invented carbs/fat data.

The bedroom includes a **fixed character drawn into the artwork**; it is not yet a layer connected to the customizable coach-avatar picker. The sidebar avatars and Coach view retain their existing selection behavior.

## Validation
- Browser smoke test of the new adapter using DOM fixtures matching the current Dashboard structure.
- Checked desktop widths 1440 and 1024px and phone widths 393 and 320px; the Dashboard mounted successfully, three core stat cards stayed in the overview and the live Water/Sleep/Weight cards moved into their designated slots, with no horizontal document overflow or JavaScript page errors.
- Verified scripts parse and image URLs resolve to files included in the branch.

**Before merging:** Run live account testing on a temporary local checkout of this branch for sign-in/onboarding, food entries, edit/re-edit Steps/Sleep/Weight, Fitness logging and day selection, date navigation, dark theme, calendar, and phone/desktop interaction. The browser smoke test uses fixture data; it does not sign into your personal Firebase account.

## Preview locally
```bash
git fetch origin feature/pixel-art-responsive-redesign
git switch feature/pixel-art-responsive-redesign
node dev-server.js . 8000
```
Open `http://localhost:8000`; sign in with your existing Upkeep account. The GitHub Pages production site stays on `master` until merged.
