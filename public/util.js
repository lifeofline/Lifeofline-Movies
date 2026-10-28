// Small helpers shared by the app, the player and the admin page.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
export const day = (ms) => new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// "2h 8m", "35 min", "2 min"
export function dur(sec) {
  sec = Math.round(sec || 0); if (!sec) return "";
  if (sec < 60) return `${sec} sec`;
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${Math.max(1, m)} min`;
}
export const clock = (s) => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`; };

// Poster fallback: a gradient made from the title's two hues (used until a poster image is uploaded).
export function art(t) {
  const [a, b] = Array.isArray(t?.hue) && t.hue.length === 2 ? t.hue : hues(t?.title || t?.id || "x");
  return `background:radial-gradient(120% 80% at 80% 10%,hsl(${b} 70% 52% / .85),transparent 60%),radial-gradient(90% 70% at 10% 90%,hsl(${a} 75% 45%),transparent 70%),linear-gradient(160deg,hsl(${a} 45% 22%),hsl(${b} 40% 12%));`;
}
export function hues(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return [h % 360, (h >> 9) % 360]; }
// Any poster shape (square, 2:3, 16:9) fits whole in any tile: the poster itself on top, a dimmed copy filling the rest.
export const posterStyle = (t, pos = "center") => {
  if (!t?.poster) return art(t);
  const u = `url('${String(t.poster).replace(/'/g, "%27")}')`;
  return `background:${u} ${pos}/contain no-repeat,linear-gradient(rgba(20,15,28,.74),rgba(20,15,28,.74)),${u} center/cover no-repeat #1d1727;`;
};
// A title with no video yet: shown as "Coming soon", can't be played.
export const isSoon = (t) => t?.comingSoon === true || !(Number(t?.episodeCount) > 0);

const loaded = {};
export function loadScript(src) {
  return (loaded[src] ||= new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = src; s.onload = res;
    s.onerror = () => { loaded[src] = null; rej(new Error("A needed file didn't load. Check your connection.")); };
    document.head.append(s);
  }));
}

let tt;
export function toast(msg, ms = 2400) {
  const t = document.getElementById("toast"); if (!t) return;
  t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, ms);
}

// TVs and streaming sticks: Android TV, Google TV, Fire TV, Samsung Tizen, LG webOS, Sony Bravia, Chromecast.
export const isTV = () => /Android TV|GoogleTV|AFT[A-Z]|SMART-TV|SmartTV|Tizen|Web0S|webOS|BRAVIA|CrKey|HbbTV|Large Screen/i.test(navigator.userAgent);
