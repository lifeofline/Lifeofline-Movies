// Shared rules for what is free, what needs Premium and what each age rating allows.
// The server has its own copy of freeEpisode (server/server.js); keep the two in step.

// Age ratings under the IT Rules 2021 (self-classification for online curated content).
export const RATINGS = ["U", "U/A 7+", "U/A 13+", "U/A 16+", "A"];
export const KIDS_OK = new Set(["U", "U/A 7+"]); // what a Kids profile shows; anything above needs the parental PIN

export const LANGS = ["Hindi", "Marathi", "Tamil", "Telugu", "Bengali", "Gujarati", "Kannada", "Malayalam", "Punjabi", "English"];
export const KINDS = { movie: "Movie", series: "Web series", short: "Short drama" };

// Free with ads unless the title is Premium. Premium short dramas: first 3 episodes free.
// Premium series: episode 1 free. Premium movies: trailer only. An episode can override with free: true/false.
export function freeEpisode(title, ep) {
  if (!title.premium) return true;
  if (ep.free === true) return true;
  if (ep.free === false) return false;
  if (title.kind === "short") return ep.n <= (title.freeEps ?? 3);
  if (title.kind === "series") return ep.n <= (title.freeEps ?? 1);
  return false;
}

export const canPlay = (title, ep, premium) => premium || freeEpisode(title, ep);
