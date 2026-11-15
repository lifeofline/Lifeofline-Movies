// Find a ghazal from any part of a sher: typed in Hindi (Devanagari), Roman letters ("dil e nadan") or Urdu, or spoken.
// Both the shers and the query become a simple sound key (z≈j, q≈k, aa≈a, w≈v …), then each query word is matched to
// the sher's words with spelling slack, in order. The index (sher-index.json, all 233 ghazals) loads only when needed.

let INDEX = null, LOADING = null;

// ---- turn any script into a sound key --------------------------------------------------------------------
const CONS = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n", "च": "ch", "छ": "ch", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
  "ष": "sh", "स": "s", "ह": "h", "ळ": "l",
  "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "फ़": "f", "ड़": "r", "ढ़": "rh", "य़": "y",
};
const VOW = { "अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u", "ए": "e", "ऐ": "e", "ओ": "o", "औ": "o", "ऋ": "ri", "ऑ": "o" };
const MATRA = { "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "े": "e", "ै": "e", "ो": "o", "ौ": "o", "ृ": "ri", "ॅ": "e", "ॉ": "o" };
const NUKTA = { "क": "क़", "ख": "ख़", "ग": "ग़", "ज": "ज़", "फ": "फ़", "ड": "ड़", "ढ": "ढ़", "य": "य़" };

function devToLatin(s) {
  s = s.normalize("NFC").replace(/([कखगजफडढय])़/g, (m, c) => NUKTA[c] || c);
  let out = "";
  const ch = [...s];
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i], n = ch[i + 1];
    if (CONS[c]) {
      out += CONS[c];
      if (n && MATRA[n]) { out += MATRA[n]; i++; }
      else if (n === "्") { i++; }                          // halant: no vowel
      else if (n && (CONS[n] || n === "ं" || n === "ँ")) out += "a"; // inherent a inside a word (dropped at the end)
    } else if (VOW[c]) out += VOW[c];
    else if (c === "ं" || c === "ँ") out += "n";
    else if (c === "ः") out += "h";
    else if (/[ऀ-ॿ]/.test(c)) { /* other signs */ }
    else out += c;
  }
  return out;
}

const URDU = {
  "ا": "a", "آ": "a", "ب": "b", "پ": "p", "ت": "t", "ٹ": "t", "ث": "s", "ج": "j", "چ": "ch", "ح": "h", "خ": "kh", "د": "d",
  "ڈ": "d", "ذ": "z", "ر": "r", "ڑ": "r", "ز": "z", "ژ": "zh", "س": "s", "ش": "sh", "ص": "s", "ض": "z", "ط": "t", "ظ": "z",
  "ع": "", "غ": "gh", "ف": "f", "ق": "q", "ک": "k", "ك": "k", "گ": "g", "ل": "l", "م": "m", "ن": "n", "ں": "n", "و": "o",
  "ہ": "h", "ة": "h", "ھ": "h", "ء": "", "ی": "i", "ي": "i", "ے": "e", "ۓ": "e", "ئ": "i", "ؤ": "o", "ۂ": "h",
};
const urduToLatin = (s) => [...s].map((c) => (c in URDU ? URDU[c] : /[ً-ٰٟ]/.test(c) ? "" : c)).join("");

// Roman spelling slack: everyone writes Urdu in English letters differently.
function canon(latin) {
  return latin.toLowerCase()
    .replace(/['’`ʼ]/g, "")                 // ka'ba = kaba
    .replace(/[-.,!?;:"“”()।؟]+/g, " ")
    .replace(/\be\b/g, " ")                 // izafat "dil-e-nadan" = "dil nadan"
    .replace(/aa+/g, "a").replace(/ee+|ii+/g, "i").replace(/oo+|uu+/g, "u")
    .replace(/ai|ei/g, "e").replace(/au|ou|aw/g, "o")
    .replace(/ph/g, "f").replace(/zh/g, "j").replace(/z/g, "j").replace(/q/g, "k").replace(/w/g, "v").replace(/x/g, "ks")
    .replace(/c(?!h)/g, "k").replace(/ck/g, "k")
    .replace(/([a-z])\1+/g, "$1")           // doubled letters
    .replace(/\s+/g, " ").trim();
}
const SK = new Map();
const skeleton = (w) => { let k = SK.get(w); if (k === undefined) { k = w.replace(/[aeiouy]/g, "").replace(/h/g, "") || w; if (SK.size < 50000) SK.set(w, k); } return k; };
export function soundKey(text) {
  const s = String(text || "");
  const latin = /[ऀ-ॿ]/.test(s) ? devToLatin(s) : /[؀-ۿ]/.test(s) ? urduToLatin(s) : s;
  return canon(latin);
}

// ---- matching -------------------------------------------------------------------------------------------
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j), cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
function wordSim(q, w) {
  if (q === w) return 1;
  if (q.length >= 3 && w.startsWith(q)) return 0.85;           // still typing the word
  const sq = skeleton(q), sw = skeleton(w);
  const v = 1 - lev(q, w) / Math.max(q.length, w.length);
  const s = sq && sq === sw ? 0.88 : 1 - lev(sq, sw) / Math.max(sq.length, sw.length, 1) - 0.08;
  return Math.max(v, s);
}
const STOP = new Set(["ki", "ke", "ka", "ko", "se", "me", "men", "hun", "he", "hen", "to", "bhi", "na", "ne", "jo", "o", "va", "ve", "ye", "vo", "ik", "ek"]);

// Score one sher against the query words: average best match per word, plus a bonus for the right order.
function scoreIds(sims, wts, ids) {
  let total = 0, inOrder = 0, last = -1, weight = 0;
  for (let k = 0; k < sims.length; k++) {
    const sim = sims[k], wt = wts[k]; weight += wt;
    let best = 0, at = -1;
    for (let j = 0; j < ids.length; j++) { const v = sim[ids[j]]; if (v > best || (v === best && j > last && at <= last)) { best = v; at = j; } }
    if (best < 0.6) best = 0;
    total += best * wt;
    if (best && at > last) { inOrder++; last = at; }
  }
  return total / weight * 0.85 + (sims.length > 1 ? inOrder / sims.length * 0.15 : 0.15);
}
const SIMCACHE = new Map();
function simTable(q, words) {
  let t = SIMCACHE.get(q);
  if (!t) { t = new Float32Array(words.length); for (let i = 0; i < words.length; i++) t[i] = wordSim(q, words[i]); if (SIMCACHE.size > 300) SIMCACHE.clear(); SIMCACHE.set(q, t); }
  return t;
}

export async function loadIndex(url = "./sher-index.json") {
  if (INDEX) return INDEX;
  LOADING ||= fetch(url).then((r) => { if (!r.ok) throw new Error("Couldn't load the sher list."); return r.json(); }).then((j) => {
    const rows = [];
    const vocab = new Map(), words = [];
    const id = (w) => { let k = vocab.get(w); if (k === undefined) { k = words.length; vocab.set(w, k); words.push(w); } return k; };
    for (const g of j.ghazals) g.s.forEach((text, i) => {
      const lines = text.split("\n").map((l) => soundKey(l).split(" ").filter(Boolean).map(id));
      rows.push({ g: g.g, title: g.title, year: g.year, n: i + 1, of: g.s.length, text, ids: lines.flat(), lines });
    });
    INDEX = { rows, words, poet: j.poet, count: j.ghazals.length };
    return INDEX;
  }).catch((e) => { LOADING = null; throw e; });
  return LOADING;
}

// Returns up to `limit` shers, best first: { g, title, year, n, of, text, score, line }
export async function searchShers(query, limit = 8) {
  const idx = await loadIndex();
  const qw = soundKey(query).split(" ").filter(Boolean);
  if (!qw.length || (qw.length === 1 && qw[0].length < 3)) return [];
  const minScore = qw.length >= 3 ? 0.62 : 0.72;
  const sims = qw.map((q) => simTable(q, idx.words)), wts = qw.map((q) => (STOP.has(q) ? 0.35 : 1));
  const out = [];
  for (const r of idx.rows) {
    const sc = scoreIds(sims, wts, r.ids);
    if (sc >= minScore) {
      // which misra matched better, for highlighting
      const l0 = scoreIds(sims, wts, r.lines[0]), l1 = r.lines[1] ? scoreIds(sims, wts, r.lines[1]) : 0;
      out.push({ ...r, score: sc, line: l1 > l0 ? 1 : 0 });
    }
  }
  out.sort((a, b) => b.score - a.score || a.n - b.n);
  // a near-exact hit: keep only the close runners-up
  if (out[0]?.score >= 0.9) { const cut = out[0].score - 0.12; while (out.length && out[out.length - 1].score < cut) out.pop(); }
  // one result per ghazal unless the query is clearly about several shers of the same ghazal
  const seen = new Map(), res = [];
  for (const r of out) { const k = r.g; if ((seen.get(k) || 0) >= 2) continue; seen.set(k, (seen.get(k) || 0) + 1); res.push(r); if (res.length >= limit) break; }
  return res;
}

// Spoken search: one tap, speak a line (Hindi/Urdu), get the text back. Returns { stop } or null if unsupported.
// Spoken search: one tap, speak a line (Hindi/Urdu). Live text comes through onText as it's heard; it finishes by
// itself 1.3 s after the speaker pauses (or after 12 s), or at once with done(). Returns { stop, done } or null.
export function listenOnce({ onStart, onText, onEnd, onError }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = "hi-IN"; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
  let text = "", ended = false, quietT = 0;
  const hardT = setTimeout(() => finish(), 12000);
  function finish() { if (ended) return; ended = true; clearTimeout(quietT); clearTimeout(hardT); try { rec.stop(); } catch { /* ignore */ } onEnd?.(text.trim()); }
  rec.onstart = () => onStart?.();
  rec.onresult = (e) => {
    let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + " ";
    text = t.replace(/\s+/g, " ").trim(); onText?.(text);
    clearTimeout(quietT); quietT = setTimeout(finish, 1300);
  };
  rec.onerror = (e) => { if (ended) return; if (e.error === "no-speech" && text) return finish(); ended = true; clearTimeout(quietT); clearTimeout(hardT); onError?.(e.error); };
  rec.onend = () => finish();
  try { rec.start(); } catch { clearTimeout(hardT); return null; }
  return { stop() { if (ended) return; ended = true; clearTimeout(quietT); clearTimeout(hardT); try { rec.abort(); } catch { /* ignore */ } onEnd?.(""); }, done: finish };
}
export const canListen = () => !!(typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition));
