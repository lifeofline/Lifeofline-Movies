// ── 1. Firebase (login + database) ─────────────────────────────────────────────
// Firebase console → Project settings → Your apps → Web app. Paste your values below.
// While apiKey still starts with "PASTE", the app runs in DEMO MODE with sample titles and no real payments.
export const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE.firebaseapp.com",
  projectId: "PASTE",
  storageBucket: "PASTE.firebasestorage.app",
  messagingSenderId: "PASTE",
  appId: "PASTE",
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
