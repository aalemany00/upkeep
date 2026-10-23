// Free, no-credit-card API key from https://fdc.nal.usda.gov/api-key-signup/
// — used only for the Food tab's "auto-estimate from name" lookup (USDA
// FoodData Central). Meant to be used client-side (same reasoning as
// firebase-config.js: not a secret like a password, just a rate-limited
// per-registrant key) — if it's ever abused, regenerate it at the same
// signup page, no billing involved either way.
//
// Get your key, then replace the placeholder below with it.
export const USDA_API_KEY = "YOUR_API_KEY_HERE";
