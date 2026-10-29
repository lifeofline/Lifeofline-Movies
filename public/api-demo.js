// Demo backend: sample titles kept in this browser, any email signs in, Premium is free, videos play a public sample.
// Used automatically while config.js still has the "PASTE" placeholders, so the app can be tried before setup.
import { freeEpisode } from "./access.js";
const SAMPLE_HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
const KEY = "lm_demo_v1";

const SEED = [
  { id: "kaanch-ka-mahal", title: "Kaanch Ka Mahal", kind: "short", format: "v", genre: "Romance · Revenge", lang: "Hindi", rating: "U/A 13+", premium: true, original: true, eps: 12, epLen: 120, hue: [330, 20], desc: "A Dadar tailor's daughter marries into a glass-tower family and finds out the wedding was a deal. Two-minute episodes, one twist each." },
  { id: "nakli-dulha", title: "Nakli Dulha", kind: "short", format: "v", genre: "Comedy", lang: "Hindi", rating: "U/A 7+", premium: false, original: true, eps: 8, epLen: 90, hue: [45, 10], desc: "A wedding-band drummer is paid to stand in as the groom. The real groom keeps calling." },
  { id: "raat-ki-rani", title: "Raat Ki Rani", kind: "short", format: "v", genre: "Thriller", lang: "Hindi", rating: "U/A 16+", premium: true, original: true, eps: 10, epLen: 120, hue: [275, 320], desc: "A night-shift nurse in Thane starts getting texts that predict who will be admitted next." },
  { id: "ghar-wapsi", title: "Ghar Wapsi", kind: "short", format: "v", genre: "Family", lang: "Marathi", rating: "U", premium: false, original: true, eps: 6, epLen: 120, hue: [150, 60], desc: "Three siblings return to their Konkan home to sell it, and the house refuses to let them." },
  { id: "kalakaar", title: "Kalakaar", kind: "movie", format: "h", genre: "Drama · Music", lang: "Hindi", rating: "U/A 13+", premium: true, original: true, eps: 1, epLen: 7680, hue: [38, 350], trailer: true, desc: "A street singer from Nashik gets one shot at a Mumbai music label and has to choose between the stage and his band." },
  { id: "last-train-lonavala", title: "Last Train to Lonavala", kind: "movie", format: "h", genre: "Thriller", lang: "Hindi", rating: "U/A 16+", premium: true, original: false, eps: 1, epLen: 6720, hue: [220, 190], trailer: true, desc: "Seven passengers, one missing ticket inspector and a monsoon night on the ghats." },
  { id: "dhoop-chhaon", title: "Dhoop Chhaon", kind: "series", format: "h", genre: "Family drama", lang: "Hindi", rating: "U/A 13+", premium: true, original: true, eps: 8, epLen: 2100, hue: [28, 200], desc: "A widowed mother reopens her husband's failing printing press in Pune, against her sons' wishes." },
  { id: "andheri-east", title: "Andheri East", kind: "series", format: "h", genre: "Crime", lang: "Hindi", rating: "A", premium: true, original: true, eps: 6, epLen: 2700, hue: [0, 260], desc: "A casting agent becomes the prime witness in a murder at a film studio. Adults only." },
  { id: "gully-ke-sitare", title: "Gully Ke Sitare", kind: "movie", format: "h", genre: "Sports · Kids", lang: "Marathi", rating: "U", premium: false, original: false, eps: 1, epLen: 6000, hue: [110, 45], desc: "A Dharavi cricket team trains on rooftops for the inter-school final." },
  { id: "madras-memories", title: "Madras Memories", kind: "series", format: "h", genre: "Romance", lang: "Tamil", rating: "U/A 13+", premium: true, original: false, eps: 7, epLen: 1800, hue: [300, 25], desc: "Two classmates meet at their college reunion twenty years after a letter was never delivered." },
  { id: "chhoti-si-kahani", title: "Chhoti Si Kahani", kind: "movie", format: "h", genre: "Comedy", lang: "Gujarati", rating: "U", premium: false, original: false, eps: 1, epLen: 5700, hue: [60, 170], desc: "A wedding caterer in Surat accidentally books two weddings on the same night." },
];

function seed() {
  const titles = {}, episodes = {};
  SEED.forEach((s, i) => {
    const { eps, epLen, trailer, ...t } = s;
    titles[t.id] = { ...t, published: true, order: i, poster: "", trailerUid: trailer ? "test_trailer" : "", episodeCount: eps, createdAt: Date.now() - i * 864e5 };
    episodes[t.id] = Array.from({ length: eps }, (_, k) => ({ id: "e" + (k + 1), n: k + 1, name: t.kind === "movie" ? t.title : `Episode ${k + 1}`, duration: epLen, videoUid: "test_" + t.id + k }));
  });
  return { titles, episodes, ads: [], user: null, sub: null, progress: {}, list: [], adult: null, users: {} };
}
let D;
try { D = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { D = null; }
if (!D || !D.titles) D = seed();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch { /* private mode */ } };
const wait = (v, ms = 120) => new Promise((r) => setTimeout(() => r(v), ms));
const err = (msg, extra = {}) => Object.assign(new Error(msg), extra);
const premium = () => !!D.sub && D.sub.until > Date.now() && D.sub.status !== "halted";
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "title";

// Demo Helpdesk chat (kept in memory): a simple watcher list so screens update like Firestore does.
const sup = { threads: {}, msgs: {}, subs: new Set() };
const supEmit = () => sup.subs.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
const supWatch = (fn, cb) => { const run = () => cb(fn()); sup.subs.add(run); setTimeout(run, 0); return () => sup.subs.delete(run); };
export function createDemoApi() {
  const authCbs = new Set();
  const emit = () => authCbs.forEach((cb) => cb(D.user));

  const api = {
    mode: "demo",
    watchSupportThread(id, cb) { return supWatch(() => (sup.threads[id] ? { ...sup.threads[id] } : null), cb); },
    watchSupportMsgs(id, cb) { return supWatch(() => (sup.msgs[id] || []).map((m) => ({ ...m })), cb); },
    async supportSend(text, transcript, meta = {}) {
      const id = D.user?.uid || "demo"; const t = sup.threads[id] = sup.threads[id] || { id, uid: id, createdAt: Date.now() }; const list = sup.msgs[id] = sup.msgs[id] || [];
      if (!list.length && transcript) list.push({ id: "m" + Date.now(), from: id, kind: "transcript", text: "Before connecting, I asked the helper:\n" + transcript, at: Date.now() });
      list.push({ id: "m" + Date.now() + 1, from: id, text, at: Date.now() });
      Object.assign(t, { name: meta.name || "", role: meta.premium ? "Premium" : "Free", status: "open", teamUnread: true, userUnread: false, lastText: text, lastFrom: id, lastAt: Date.now() }); supEmit();
      setTimeout(() => { list.push({ id: "m" + Date.now() + 2, from: "team", name: "Priya (demo)", text: "Hi! This is the Lifeofline Helpdesk (demo). We've got your message and will help you right away.", at: Date.now() }); Object.assign(t, { userUnread: true, lastText: "Hi! This is the Lifeofline Helpdesk…", lastFrom: "team", lastAt: Date.now() }); supEmit(); }, 1500);
    },
    async supportSeen() { const t = sup.threads[D.user?.uid || "demo"]; if (t?.userUnread) { t.userUnread = false; supEmit(); } },
    watchSupportThreads(cb) { return supWatch(() => Object.values(sup.threads).sort((a, b) => b.lastAt - a.lastAt).map((t) => ({ ...t })), cb); },
    async supportReply(id, text, name) { (sup.msgs[id] = sup.msgs[id] || []).push({ id: "m" + Date.now(), from: "team", name, text, at: Date.now() }); Object.assign(sup.threads[id], { teamUnread: false, userUnread: true, status: "open", lastText: text, lastFrom: "team", lastAt: Date.now() }); supEmit(); },
    async supportStatus(id, status) { Object.assign(sup.threads[id], { status, teamUnread: false }); supEmit(); },
    async supportMarkRead(id) { if (sup.threads[id]) { sup.threads[id].teamUnread = false; supEmit(); } },
    onAuth(cb) { authCbs.add(cb); setTimeout(() => cb(D.user), 0); return () => authCbs.delete(cb); },
    async signUp(name, email) { D.user = { uid: "demo", email, name: name || email.split("@")[0], emailVerified: true }; save(); emit(); return D.user; },
    async signIn(email) { D.user = { uid: "demo", email, name: email.split("@")[0], emailVerified: true }; save(); emit(); return D.user; },
    async google() { return api.signIn("demo.viewer@gmail.com"); },
    async resetPassword() { return wait(true); },
    async sendVerify() { return wait(true); },
    async signOut() { D.user = null; save(); emit(); },
    me: () => D.user,

    async titles() { return wait(Object.values(D.titles).filter((t) => t.published).sort((a, b) => a.order - b.order)); },
    async allTitles() { return wait(Object.values(D.titles).sort((a, b) => a.order - b.order)); },
    async title(id) { return wait(D.titles[id] || null, 60); },
    async episodes(id) { return wait([...(D.episodes[id] || [])].sort((a, b) => a.n - b.n), 60); },
    async ads() { return wait(D.ads.filter((a) => a.active)); },
    async profile() { return wait(D.user ? { name: D.user.name, adult: D.adult } : null); },

    track() {},
    async reportProblem() { return wait(true); },
    async play(titleId, epId, trailer) {
      const t = D.titles[titleId]; if (!t) throw err("This title isn't available.");
      const base = { ads: !premium(), premium: premium(), rating: t.rating, title: t.title, format: t.format, hls: SAMPLE_HLS, poster: "", test: true };
      if (trailer) return wait({ ...base, ads: false });
      if (t.rating === "A") {
        if (!D.user) throw err("Sign in to watch titles rated A (18+).", { needSignIn: true });
        if (!D.adult) throw err("Titles rated A are for viewers aged 18 and over. Add your date of birth in Account.", { needAge: true });
      }
      const eps = D.episodes[titleId] || []; const ep = epId ? eps.find((e) => e.id === epId) : eps[0];
      if (!ep) throw err("This episode isn't uploaded yet.");
      if (!premium() && !freeEpisode(t, ep)) throw err("This is in the ₹499 yearly Premium plan.", { needPlan: true });
      return wait({ ...base, epId: ep.id, n: ep.n, name: ep.name, duration: ep.duration });
    },

    async subStatus() { return wait({ mode: "test", price: 499, premium: premium(), sub: D.sub }); },
    async subStart() { if (!D.user) throw err("Sign in first.", { needSignIn: true }); return wait({ mode: "test", price: 499 }); },
    async subVerify() { D.sub = { status: "active", mode: "test", until: Math.max(Date.now(), D.sub?.until || 0) + 365 * 864e5, startedAt: Date.now() }; save(); return wait({ until: D.sub.until }); },
    async subCancel() { if (!D.sub) throw err("You don't have an active plan."); D.sub.status = "cancelling"; save(); return wait({ until: D.sub.until }); },

    async setDob(dob) {
      if (D.adult != null) throw err("Your date of birth is already saved.");
      const d = new Date(dob), n = new Date(); let age = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) age--;
      D.adult = age >= 18; save(); return wait({ adult: D.adult });
    },
    async isAdmin() { return !!D.user; },
    async claimAdmin() { return { admin: true }; },

    async getProgress() { return D.user ? { ...D.progress } : {}; },
    async saveProgress(titleId, p) { if (!D.user) return; D.progress[titleId] = { ...p, at: Date.now() }; save(); },
    async myList() { return D.user ? [...D.list] : []; },
    async toggleList(id) { if (!D.user) throw err("Sign in to save titles.", { needSignIn: true }); D.list = D.list.includes(id) ? D.list.filter((x) => x !== id) : [id, ...D.list]; save(); return D.list.includes(id); },
    async grievance() { return wait(true, 300); },

    // admin
    async saveTitle(t) {
      const id = t.id || slug(t.title) + "-" + Math.random().toString(36).slice(2, 6);
      D.titles[id] = { ...(D.titles[id] || { createdAt: Date.now(), order: Object.keys(D.titles).length }), ...t, id };
      D.episodes[id] ||= []; save(); return wait(id);
    },
    async deleteTitle(id) { delete D.titles[id]; delete D.episodes[id]; save(); return wait(true); },
    async saveEpisode(titleId, ep) {
      const list = D.episodes[titleId] ||= []; const id = ep.id || "e" + Date.now().toString(36);
      const i = list.findIndex((e) => e.id === id); const row = { ...(i >= 0 ? list[i] : {}), ...ep, id };
      if (i >= 0) list[i] = row; else list.push(row);
      D.titles[titleId].episodeCount = list.length; save(); return wait(id);
    },
    async deleteEpisode(titleId, id) { D.episodes[titleId] = (D.episodes[titleId] || []).filter((e) => e.id !== id); D.titles[titleId].episodeCount = D.episodes[titleId].length; save(); return wait(true); },
    async uploadVideo(file, onProgress) { for (let p = 0; p <= 100; p += 20) { onProgress(p); await wait(0, 150); } return "test_" + Date.now().toString(36); },
    async videoStatus() { return wait({ ready: true, duration: 0, state: "ready", pct: 100, test: true }); },
    async uploadImage(file) { return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); }); },
    async allAds() { return wait([...D.ads]); },
    async saveAd(a) { const id = a.id || "ad" + Date.now().toString(36); const i = D.ads.findIndex((x) => x.id === id); if (i >= 0) D.ads[i] = { ...D.ads[i], ...a, id }; else D.ads.push({ ...a, id }); save(); return wait(id); },
    async deleteAd(id) { D.ads = D.ads.filter((a) => a.id !== id); save(); return wait(true); },
    // Demo AI studio: draws a placeholder picture; video needs the live server.
    async ai(action, b = {}) {
      if (action === "aiStatus") return wait({ live: true, cap: 5, usedToday: 0.2, countToday: 2, videoModel: "demo", imageModel: "demo", prices: { videoPerSecond: { "720p": 0.101, "1080p": 0.152 }, image: 0.1, clipSeconds: 10 }, recent: [{ kind: "image", at: Date.now() - 36e5, usd: 0.1, prompt: "Demo poster" }] });
      if (action === "aiVideo") { await wait(0, 600); throw new Error("Demo mode: AI video needs the live server with GEMINI_API_KEY."); }
      const [w, h] = { "2:3": [600, 900], "9:16": [540, 960], "16:9": [960, 540], "1:1": [800, 800] }[b.aspect] || [960, 540];
      const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d");
      const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#1b1530"); g.addColorStop(1, "#c8892b"); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = "#fff"; x.font = `bold ${Math.round(w / 14)}px system-ui`; x.fillText("AI DEMO", 30, h / 2); x.font = `${Math.round(w / 34)}px system-ui`; x.fillText(String(b.prompt || "").slice(0, 40), 30, h / 2 + w / 14);
      await wait(0, 500); const url = c.toDataURL("image/png"); return { mime: "image/png", data: url.split(",")[1] };
    },
    async grant(email, days) { return wait({ email, until: Date.now() + days * 864e5 }); },
    async stats() { return wait({ premium: premium() ? 1 : 0, titles: Object.keys(D.titles).length, users: D.user ? 1 : 0, billing: "test", video: "test" }); },
    resetDemo() { D = seed(); save(); },
  };
  return api;
}
