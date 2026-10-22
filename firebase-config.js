// Firebase web config is a public client identifier, not a secret — safe to
// commit. Real access control comes from firestore.rules, not from hiding
// this. Replace with your own project's config (Firebase console → Project
// settings → General → Your apps → SDK setup and configuration).
export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.firebasestorage.app",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};
