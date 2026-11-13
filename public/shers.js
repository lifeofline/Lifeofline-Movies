// Sher timings: where each sher starts (and ends) in an episode, so the player can repeat the last sher,
// show the sher being recited and loop a sher for people learning it.
// Stored on the episode as `shers: [{ t, e, text }]` (seconds). Admin → Titles → an episode → "Sher timings"
// reads them from the caption file made with the video (.srt or .vtt, captions on the shers only), or a simple list
// ("0:42 first line / second line", one sher per line), or JSON ([{ "t": 42.1, "e": 51.3, "text": "…" }]).

// Poetry titles get the "repeat sher" controls even before their timings are added (they then go back 20 seconds).
export const isPoetry = (t) => !!t && (t.sherRepeat === true || t.id === "ghalib-zinda-hai" || /ghazal|poetry|shayari|mushaira|nazm/i.test(`${t.genre || ""} ${t.kind || ""}`));
export const FALLBACK_BACK = 20;

const toSec = (s) => {
  const m = String(s).trim().replace(",", ".").match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$|^(\d+(?:\.\d+)?)$/);
  if (!m) return NaN;
  if (m[4] != null) return Number(m[4]);
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
};
const clean = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/\{\\[^}]*\}/g, "").replace(/[ \t]+/g, " ").trim();

// Caption cues → shers. A cue with two lines is one sher; single-line cues are paired (misra + misra)
// when the second follows within a few seconds.
// The captions may carry the sher in Devanagari or Urdu with an English line under it; English lines ride along as
// the translation and don't count as a misra.
const nonLatin = (l) => /[\u0900-\u097F\u0600-\u06FF]/.test(l);
function cuesToShers(cues) {
  const out = []; let cur = null;
  const push = () => { if (cur) { out.push(cur); cur = null; } };
  for (const c of cues) {
    const all = c.text.split(/\n/).map(clean).filter(Boolean);
    if (!all.length) continue;
    const hasScript = all.some(nonLatin);
    const misras = hasScript ? all.filter(nonLatin) : all, en = hasScript ? all.filter((l) => !nonLatin(l)) : [];
    if (misras.length >= 2) { push(); out.push({ t: c.t, e: c.e, text: misras.join("\n"), en: en.join("\n") }); continue; }
    if (cur && c.t - cur.e <= 3.5 && cur.text.split("\n").length < 2) {
      cur.e = c.e; cur.text += "\n" + misras[0]; if (en.length) cur.en = (cur.en ? cur.en + "\n" : "") + en.join("\n"); push(); continue;
    }
    push();
    cur = { t: c.t, e: c.e, text: misras[0], en: en.join("\n") };
  }
  push();
  return out;
}

function parseCaptions(text) {
  const cues = [];
  const blocks = text.replace(/\r/g, "").replace(/^﻿/, "").split(/\n\s*\n/);
  for (const b of blocks) {
    const lines = b.split("\n");
    const i = lines.findIndex((l) => /-->/.test(l));
    if (i < 0) continue;
    const [a, z] = lines[i].split("-->").map((x) => x.trim().split(/\s+/)[0]);
    const t = toSec(a), e = toSec(z);
    if (!isFinite(t) || !isFinite(e)) continue;
    cues.push({ t, e, text: lines.slice(i + 1).join("\n") });
  }
  return cuesToShers(cues.sort((x, y) => x.t - y.t));
}

function parseList(text) {
  const out = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const m = raw.trim().match(/^((?:\d+:)?\d{1,2}:\d{1,2}(?:[.,]\d+)?|\d+(?:\.\d+)?)(?:\s*[-–]\s*((?:\d+:)?\d{1,2}:\d{1,2}(?:[.,]\d+)?|\d+(?:\.\d+)?))?\s*[|·:\-–]?\s*(.*)$/);
    if (!m) continue;
    const t = toSec(m[1]); if (!isFinite(t)) continue;
    const e = m[2] ? toSec(m[2]) : NaN;
    out.push({ t, e: isFinite(e) ? e : 0, text: clean(m[3]).split(/\s+\/\s+/).join("\n") });
  }
  return out;
}

function parseJson(text) {
  const j = JSON.parse(text);
  const arr = Array.isArray(j) ? j : Array.isArray(j?.shers) ? j.shers : null;
  if (!arr) throw new Error("The JSON needs a list of shers like [{\"t\": 42.1, \"text\": \"…\"}].");
  return arr.map((x) => ({ t: Number(x.t ?? x.start ?? x.start_time ?? x.from), e: Number(x.e ?? x.end ?? x.end_time ?? x.to) || 0, text: clean(Array.isArray(x.lines) ? x.lines.join("\n") : x.text || "").replace(/ ?\/ ?/g, "\n"), en: clean(x.en || x.english || "") }))
    .filter((x) => isFinite(x.t));
}

// Returns a clean, sorted list; throws a plain-English error when nothing usable is found.
export function parseTimings(text, name = "") {
  const s = String(text || "").trim();
  if (!s) throw new Error("The file is empty.");
  let list;
  if (/^[[{]/.test(s)) list = parseJson(s);
  else if (/-->/.test(s) || /\.(srt|vtt)$/i.test(name)) list = parseCaptions(s);
  else list = parseList(s);
  list = list.filter((x) => x.t >= 0).sort((a, b) => a.t - b.t)
    .filter((x, i, a) => i === 0 || x.t - a[i - 1].t >= 1) // drop duplicates
    .map((x) => ({ t: Math.round(x.t * 10) / 10, e: Math.round((x.e > x.t ? x.e : 0) * 10) / 10, text: String(x.text || "").slice(0, 400), ...(x.en ? { en: String(x.en).slice(0, 400) } : {}) }));
  if (!list.length) throw new Error("No sher times found. Use the caption file (.srt or .vtt) made with the video, or lines like “0:42 first line / second line”.");
  if (list.length > 60) throw new Error(`That's ${list.length} entries, more than a ghazal has. Is this the captions for the whole episode, including the explanations? Use the captions of the shers only.`);
  return list;
}

// Index of the sher being recited or just recited at time `now` (−1 before the first one).
export function sherIndex(shers, now) {
  let i = -1;
  for (let k = 0; k < shers.length; k++) { if (shers[k].t <= now + 0.25) i = k; else break; }
  return i;
}

// Where "repeat sher" should jump: the start of the last sher heard; pressed again within its first
// few seconds, one sher further back.
export function repeatTarget(shers, now) {
  const i = sherIndex(shers, now);
  if (i < 0) return 0;
  if (now - shers[i].t < 3 && i > 0) return shers[i - 1].t;
  return shers[i].t;
}

export const fmt = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
