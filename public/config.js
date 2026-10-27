// ── 1. Firebase (login + database) ─────────────────────────────────────────────
// Firebase console → Project settings → Your apps → Web app. Paste your values below.
// While apiKey still starts with "PASTE", the app runs in DEMO MODE with sample titles and no real payments.
export const firebaseConfig = {
  apiKey: "AIzaSyC8QOEWeLIijqUXZ3MMveX-HefQyVLQPHc",
  authDomain: "lifeofline-movies.firebaseapp.com",
  projectId: "lifeofline-movies",
  storageBucket: "lifeofline-movies.firebasestorage.app",
  messagingSenderId: "52147879379",
  appId: "1:52147879379:web:4a4da82b863dc758744326",
};

// ── 2. The API on Render, posters (Cloudinary) ─────────────────────────────────
export const appConfig = {
  apiUrl: "https://lifeofline-movies-api.onrender.com",  // address of the lifeofline-movies-api service on Render
  // Posters and ad images go to the same Cloudinary account as ArtistCart, in their own folder.
  cloudinaryCloudName: "zdrwn10k",
  cloudinaryUploadPreset: "kalakaar_unsigned",
  cloudinaryFolder: "lifeofline-movies",
  supportEmail: "ibmhclms@gmail.com",                    // shown on the Grievance page and legal pages
};
