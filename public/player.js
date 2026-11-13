// The player: age-rating card → ad break (free plan) → the video, with a mid-roll on long titles for free viewers.
// Plays HLS from Cloudflare Stream with hls.js wherever the browser supports it, and the browser's own HLS only where
// hls.js can't run (iPhone Safari). Newer Chrome also claims native HLS but fails on some streams, so hls.js comes first.
// Saves where you stopped, reports starts / completions / errors (Admin → Numbers) and never leaves a spinner forever.
import { $, esc, clock, loadScript, toast } from "./util.js";
import { freeEpisode } from "./access.js";
import { voiceSupported, startVoice } from "./voice.js";
import { isPoetry, FALLBACK_BACK, repeatTarget, sherIndex, fmt } from "./shers.js";

const HLS_JS = "https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.15/hls.min.js";
const RATING_MS = 2800;
const MIDROLL_MIN_SEC = 600; // titles longer than 10 minutes get one mid-roll for free viewers
const START_TIMEOUT_MS = 20000; // no picture after this long = show a clear error with Retry
const ICON_X = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const ICON_BACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><text x="12" y="15.5" font-size="7" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle" font-family="system-ui,sans-serif">10</text></svg>`;
const ICON_FWD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4h-4"/><text x="12" y="15.5" font-size="7" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle" font-family="system-ui,sans-serif">10</text></svg>`;
const ICON_NEXT = `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M6 5v14l9-7zM16 5h2.5v14H16z"/></svg>`;
const ICON_FS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>`;
const ICON_FS_EXIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>`;
const ICON_HEAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/></svg>`;
const ICON_TV = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/></svg>`;
// Autoplay the next episode (on unless the viewer turns it off) and the listening-mode sleep timer.
const pref = {
  get voice() { try { return localStorage.getItem("lm-voice") === "1"; } catch { return false; } }, set voice(on) { try { localStorage.setItem("lm-voice", on ? "1" : "0"); } catch { /* ignore */ } },
  get shake() { try { return localStorage.getItem("lm-shake") === "1"; } catch { return false; } }, set shake(on) { try { localStorage.setItem("lm-shake", on ? "1" : "0"); } catch { /* ignore */ } },
  get autoplay() { try { return localStorage.getItem("lm-autoplay") !== "0"; } catch { return true; } }, set autoplay(on) { try { localStorage.setItem("lm-autoplay", on ? "1" : "0"); } catch { /* ignore */ } } };
const SLEEP = [["0", "Off"], ["ep", "End of episode"], ["15", "15 min"], ["30", "30 min"], ["60", "1 hour"]];
const track = (P, type, extra = {}) => { try { P.api.track?.(type, { titleId: P.title.id, epId: P.ep?.id || "", ...extra }); } catch { /* best effort */ } };

// A clear message with Retry and Report a problem, in place of a spinner or a black screen.
function errCard(P, title, msg, code = "") {
  if (P.destroyed) return;
  P.phase = "error"; clearTimeout(P.startT);
  P.lastError = { title, msg, code };
  track(P, "error", { code: String(code || title).slice(0, 80) });
  layer(P, `<div class="pcard"><span class="eyebrow">Playback problem</span><h3>${esc(title)}</h3><p>${esc(msg)}</p>
    <div class="row"><button class="btn gold" data-pretry>Retry</button><button class="btn ghost" data-preport>Report a problem</button><button class="btn ghost" data-pclose>Close</button></div></div>`);
}

let current = null;

export function closePlayer() { if (current) history.back(); }

// opts: { api, title, episodes, epId?, trailer?, startAt?, ads (house ads), onNeedPlan, onNeedSignIn, onNeedAge, onClosed }
export async function openPlayer(opts) {
  const had = !!current;
  if (had) teardown(false); // reuse the same Back-button entry
  const { title } = opts;
  const listen = !!opts.listen && !opts.trailer;
  const vertical = title.format === "v" && !opts.trailer && !listen;
  const art = title.poster ? `background-image:url('${String(title.poster).replace(/'/g, "%27")}')` : "";
  const ov = document.createElement("div");
  ov.className = "pov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Player: " + title.title);
  ov.className = "pov" + (listen ? " listen" : "");
  // Listening mode plays the sound through an <audio> element: phones keep it going with the screen off or another app open,
  // and the lock screen / headphones control it. The picture is replaced by the poster and what's playing.
  ov.innerHTML = `<div class="pstage ${vertical ? "v" : ""}" id="pstage">
      ${listen ? `<audio id="pv" preload="auto" controlslist="nodownload"></audio>
      <div class="plisten"><div class="lart" style="${art}">${title.poster ? "" : `<span>${esc(title.title)}</span>`}</div>
        <div class="lnow"><span class="eyebrow">Listening</span><b id="lname">${esc(title.title)}</b><span id="lep" class="lep"></span>
        <div class="lsher" id="lsher" hidden></div>
        <span class="lhint">You can lock your phone or open another app. It keeps playing${opts.episodes?.length > 1 ? " and moves on to the next episode by itself" : ""}.</span></div></div>`
      : `<video id="pv" playsinline webkit-playsinline preload="auto" x-webkit-airplay="deny" controlslist="nodownload noremoteplayback noplaybackrate" disablepictureinpicture disableremoteplayback></video>`}
      <div class="ppv" id="ppv" hidden></div>
      <div class="pseekfx l" id="pfxl" aria-hidden="true">${ICON_BACK}<span>10 sec</span></div><div class="pseekfx r" id="pfxr" aria-hidden="true">${ICON_FWD}<span>10 sec</span></div>
      <div class="plyr" id="plyr"></div>
      <div class="pvst" id="pvst" hidden aria-live="polite"><i></i><span id="pvtx">Say “phir se”, “agla” or “ruko”</span></div>
      <div class="ptop"><button class="pic" data-pclose aria-label="Close">${ICON_X}</button><div class="pttl"><b id="pname">${esc(title.title)}</b><span class="rating" id="prate">${esc(title.rating || "U")}</span></div>
        ${opts.trailer ? "" : `<button class="pbtn pmode" data-pmode aria-label="${listen ? "Watch the video" : "Listen with the screen off"}">${listen ? ICON_TV + "<span>Watch</span>" : ICON_HEAD + "<span>Listen</span>"}</button>`}
        <button class="pbtn pnext" data-pnext id="pnext" hidden aria-label="Next episode">Next<span class="nx-long"> episode</span> ${ICON_NEXT}</button></div>
      <div class="pmid" id="pmid">
        <button class="pic big" data-seek="-10" aria-label="Back 10 seconds">${ICON_BACK}</button>
        <button class="pic huge" data-pp aria-label="Play or pause" id="ppb"></button>
        <button class="pic big" data-seek="10" aria-label="Forward 10 seconds">${ICON_FWD}</button>
      </div>
      <div class="pbot" id="pbot">
        <div class="pctl">
          <span class="ptime" id="ptime">0:00</span>
          <div class="pbar" id="pbar" role="slider" aria-label="Seek" tabindex="0"><div class="ptrack"><i id="pbuf"></i><i id="pfill"></i><span class="cue" id="pcue" hidden></span></div><span class="pknob" id="pknob"></span></div>
          <span class="ptime" id="pleft">-0:00</span>
        </div>
        <div class="pctl pbtns">
          <button class="pbtn psher" data-psher id="psherb" hidden aria-label="Repeat the last sher">↺ Sher</button>
          <button class="pbtn ploop" data-ploop id="ploop" hidden aria-label="Repeat each sher">🔁 ×1</button>
          <button class="pbtn plist" data-plist id="plist" hidden aria-label="List of shers">☰ Shers</button>
          ${opts.trailer || !voiceSupported() ? "" : `<button class="pbtn pvoice" data-pvoice id="pvoice" aria-pressed="false" aria-label="Voice commands">🎙️ Voice</button>`}
          ${!opts.trailer && shakeSupported() && isPoetry(title) ? `<button class="pbtn pshake" data-pshake id="pshake" aria-pressed="false" aria-label="Shake the phone to repeat the sher">📳 Shake</button>` : ""}
          <button class="pbtn ptog" data-pauto id="pauto" aria-pressed="${pref.autoplay}" hidden><span class="sw" aria-hidden="true"></span>Autoplay</button>
          ${listen ? `<label class="pqual"><span class="sr">Sleep timer</span><select id="psleep" aria-label="Sleep timer">${SLEEP.map(([v, l]) => `<option value="${v}">${v === "0" ? "Sleep timer" : "Sleep: " + l}</option>`).join("")}</select></label>` : ""}
          <span class="pspace"></span>
          <label class="pqual" ${listen ? "hidden" : ""}><span class="sr">Quality</span><select id="pq" aria-label="Quality"><option value="-1">Auto</option></select></label>
          ${listen ? "" : `<button class="pic" data-pfs aria-label="Full screen" id="pfsb">${ICON_FS}</button>`}
        </div>
      </div>
    </div>`;
  document.body.append(ov);
  document.body.classList.add("playing");
  const P = current = { ...opts, ov, listen, vertical, poetry: isPoetry(title) && !opts.trailer, shers: [], sherI: -1, loopN: opts.loopN || 1, loopLeft: 0, video: $("#pv", ov), sleepAt: 0, sleepEp: false, hls: null, ep: null, res: null, midDone: false, phase: "load", saveT: 0, idleT: 0, destroyed: false };
  if (!had) history.pushState({ player: 1 }, "");
  wire(P);
  // Shake was on last time: Android starts it straight away; iPhone needs one tap first (its motion permission rule).
  if (P.poetry && pref.shake && shakeSupported()) { if (needsMotionAsk()) ov.addEventListener("pointerup", () => shakeOn(P, true), { once: true }); else shakeOn(P, true); }
  if (pref.voice && !voiceSupported()) pref.voice = false; // e.g. switched on before it was turned off for iPhone
  if (!opts.trailer && pref.voice && voiceSupported()) voiceOn(P, true);
  await start(P, opts.epId, opts.trailer, opts.startAt, opts.skipIntro);
}

function layer(P, html) { const l = $("#plyr", P.ov); l.innerHTML = html; l.hidden = !html; P.ov.classList.toggle("has-layer", !!html); }

async function start(P, epId, trailer, startAt, skipIntro = false) {
  P.phase = "load"; P.midDone = skipIntro ? !!P.midDone : false; P.completed = false; clearTimeout(P.startT);
  layer(P, `<div class="pcard"><span class="spin" aria-label="Loading"></span></div>`);
  let r;
  // A teaser stored with the site (a plain MP4) plays straight away; everything else asks the server for a signed link.
  // Demo series episodes are plain MP4s shipped with the site: no ads, no server call.
  const local = !trailer && P.title.demo ? (P.episodes || []).find((x) => x.id === epId) || (P.episodes || [])[0] : null;
  try {
    r = trailer && P.direct ? { hls: P.direct, ads: false, premium: false, rating: P.title.rating || "U", test: false }
      : local?.src ? { hls: local.src, epId: local.id, n: local.n, name: local.name, ads: false, premium: false, rating: P.title.rating || "U", test: false }
      : await P.api.play(P.title.id, epId, trailer);
  }
  catch (e) {
    if (P.destroyed) return;
    if (e.needPlan) return layer(P, `<div class="pcard"><span class="eyebrow">Premium</span><h3>${esc(e.message)}</h3><p>Unlock every movie, series and short drama with no ads.</p><div class="row"><button class="btn gold" data-pplan>See the ₹999 yearly plan</button>${P.title.trailerUid || P.direct ? `<button class="btn ghost" data-ptrailer>Watch ${P.direct ? "poster teaser" : "trailer"}</button>` : ""}</div></div>`);
    if (e.needSignIn) return layer(P, `<div class="pcard"><h3>${esc(e.message)}</h3><button class="btn gold" data-psignin>Sign in</button></div>`);
    if (e.needAge) return layer(P, `<div class="pcard"><span class="eyebrow">Rated A · 18+</span><h3>${esc(e.message)}</h3><button class="btn gold" data-page>Add date of birth</button></div>`);
    return errCard(P, "This video couldn't start.", e.message, e.status ? "api-" + e.status : "api");
  }
  if (P.destroyed) return;
  P.res = r; P.trailer = !!trailer;
  P.ep = trailer ? null : (P.episodes || []).find((x) => x.id === r.epId) || { id: r.epId, n: r.n, name: r.name };
  $("#pname", P.ov).textContent = trailer ? `${P.title.title} · ${P.direct ? "Animated poster teaser" : "Trailer"}` : P.title.kind === "movie" ? P.title.title : `${P.title.title} · Ep ${r.n}${P.title.demo ? " · Demo story card" : ""}`;
  P.shers = !trailer && Array.isArray(P.ep?.shers) ? P.ep.shers.filter((x) => isFinite(x?.t)) : []; P.sherI = -1; P.loopLeft = 0;
  // Exact "↺ Sher" only when this episode has its sher timings; until then the button says what it really does.
  { const sb = $("#psherb", P.ov); sb.hidden = !P.poetry || trailer; sb.textContent = P.shers.length ? "↺ Sher" : `↺ ${FALLBACK_BACK}s`; sb.setAttribute("aria-label", P.shers.length ? "Repeat the last sher" : `Back ${FALLBACK_BACK} seconds`); } $("#ploop", P.ov).hidden = !P.shers.length; $("#plist", P.ov).hidden = !P.shers.length;
  $("#ploop", P.ov).textContent = `🔁 ×${P.loopN}`; $("#ploop", P.ov).setAttribute("aria-pressed", P.loopN > 1);
  showSher(P, -1);
  const nx = nextEp(P); $("#pnext", P.ov).hidden = !nx; $("#pauto", P.ov).hidden = !(P.episodes?.length > 1) || trailer;
  if (P.listen) { const le = $("#lep", P.ov); if (le) le.textContent = P.title.kind === "movie" ? "" : `Episode ${r.n}${r.name && !/^Episode \d+$/.test(r.name) ? " · " + r.name : ""}`; }
  if ("mediaSession" in navigator && window.MediaMetadata) {
    const epLine = !trailer && P.title.kind !== "movie" ? `Ep ${r.n}${r.name && !/^Episode \d+$/.test(r.name) ? ": " + r.name : ""}` : "";
    try { navigator.mediaSession.metadata = new MediaMetadata({ title: epLine || P.title.title, artist: epLine ? P.title.title : "Lifeofline Movies", album: "Lifeofline Movies", artwork: P.title.poster ? [{ src: P.title.poster, sizes: "512x512" }] : [{ src: "icon-512.png", sizes: "512x512", type: "image/png" }] }); } catch { /* ignore */ }
  }
  if (r.poster && !P.listen) P.video.poster = r.poster;
  // Free-preview badge.
  const pv = $("#ppv", P.ov); pv.hidden = !r.preview; pv.textContent = r.preview ? `Free preview · ${r.preview} seconds` : "";

  P.started = false; P.netRetries = 0;
  await attach(P, r.hls).catch((e) => errCard(P, "This video didn't load.", e.message, "attach"));
  if (P.destroyed || P.phase === "error") return;

  // 1. Age rating and content descriptor, shown before every title (IT Rules 2021). Not repeated when switching
  // between watching and listening in the middle of an episode.
  if (!trailer && !skipIntro) {
    P.phase = "rating";
    layer(P, `<div class="prating"><span class="eyebrow">Rated</span><span class="big">${esc(r.rating)}</span><span>${esc(P.title.descriptor || P.title.genre || "")}</span><small>${esc(P.title.lang || "")} · Viewer discretion advised as per the age rating</small></div>`);
    await sleep(RATING_MS); if (P.destroyed) return;
  }
  // 2. Ad break for the free plan.
  if (r.ads && !trailer && !skipIntro) { await adBreak(P, "Ad break"); if (P.destroyed) return; }
  // 3. The video.
  layer(P, "");
  P.phase = "play";
  // Resume where they stopped (switching between watching and listening resumes at the exact second).
  const resume = startAt && (skipIntro ? startAt > 0 : startAt > 10) ? startAt : 0, room = skipIntro ? 1 : 30;
  if (resume) P.video.addEventListener("loadedmetadata", () => { if (resume < (P.video.duration || 0) - room) P.video.currentTime = resume; }, { once: true });
  if (resume && P.video.readyState >= 1 && resume < P.video.duration - room) P.video.currentTime = resume;
  playSafe(P);
  // Watchdog: if no picture arrives, say so instead of a black screen.
  clearTimeout(P.startT);
  P.startT = setTimeout(() => { if (!P.started && P.phase === "play") errCard(P, "This video is taking too long to start.", "Check your internet connection and try again. If it keeps happening, report it and we'll look into it.", "start-timeout"); }, START_TIMEOUT_MS);
  if (r.test) toast("Demo stream: real videos play once Cloudflare is set up.", 3000);
}

async function attach(P, src) {
  const v = P.video;
  if (P.hls) { P.hls.destroy(); P.hls = null; }
  const q = $("#pq", P.ov); q.innerHTML = `<option value="-1">Auto</option>`; q.hidden = true;
  if (/\.mp4(\?|$)/i.test(src)) { v.src = src; return; }
  const native = !!v.canPlayType("application/vnd.apple.mpegurl");
  try { await loadScript(HLS_JS); } catch { if (native) { v.src = src; return; } throw new Error("The video player didn't load. Check your connection and try again."); }
  if (!window.Hls?.isSupported()) {
    if (native) { v.src = src; return; }
    throw new Error("This browser can't play this video. Try the latest Chrome, Safari or Edge.");
  }
  const hls = P.hls = new window.Hls({ capLevelToPlayerSize: true, maxBufferLength: 30 });
  hls.on(window.Hls.Events.MANIFEST_PARSED, (_, d) => {
    const lv = d.levels.map((l, i) => ({ i, h: l.height })).filter((l) => l.h).sort((a, b) => b.h - a.h);
    q.innerHTML = `<option value="-1">Auto</option>` + lv.map((l) => `<option value="${l.i}">${l.h}p</option>`).join("");
    q.hidden = lv.length < 2;
  });
  hls.on(window.Hls.Events.ERROR, (_, d) => {
    if (!d.fatal) return;
    const code = `${d.type}:${d.details}${d.response?.code ? ":" + d.response.code : ""}`;
    if (d.type === window.Hls.ErrorTypes.NETWORK_ERROR && P.netRetries++ < 2) return hls.startLoad();
    if (d.type === window.Hls.ErrorTypes.MEDIA_ERROR && P.netRetries++ < 2) return hls.recoverMediaError();
    const forbidden = d.response?.code === 401 || d.response?.code === 403;
    errCard(P, forbidden ? "This video link has expired." : "This video stopped loading.",
      forbidden ? "Press Retry to get a fresh link." : "Check your internet connection and press Retry. If it keeps happening, report it.", code);
  });
  hls.loadSource(src); hls.attachMedia(v);
}

// House ads from the admin page; with none set up, a short "go ad-free" message fills the slot.
async function adBreak(P, label) {
  const prev = P.phase; P.phase = "ad";
  const wasPlaying = !P.video.paused; P.video.pause();
  const list = P.ads || [];
  const ad = list.length ? list[Math.floor(Math.random() * list.length)] : null;
  const secs = Math.min(30, Math.max(5, Math.round(ad?.seconds || 6)));
  layer(P, `<div class="pad" ${ad?.imageUrl ? `style="background:#000 url('${String(ad.imageUrl).replace(/'/g, "%27")}') center/contain no-repeat"` : ""}>
      <span class="adlbl">${esc(label)} · Ad</span>
      ${ad ? (ad.link ? `<a class="btn sm ghost adlink" href="${esc(ad.link)}" target="_blank" rel="noopener sponsored">${esc(ad.cta || "Learn more")}</a>` : "") + (ad.imageUrl ? "" : `<h3>${esc(ad.title || "Sponsored")}</h3>`)
        : `<span class="eyebrow">Lifeofline Premium</span><h3>Watch everything with no ads</h3><button class="btn gold" data-pplan>Go ad-free for ₹999 a year</button>`}
      <span class="adcd" id="adcd">Video in ${secs}s</span></div>`);
  for (let s = secs; s > 0; s--) { const c = $("#adcd", P.ov); if (c) c.textContent = `Video in ${s}s`; await sleep(1000); if (P.destroyed || P.phase !== "ad") return; }
  layer(P, ""); P.phase = prev === "rating" || prev === "load" ? "play" : prev;
  if (wasPlaying) playSafe(P);
}

function playSafe(P) { const p = P.video.play(); if (p?.catch) p.catch(() => { $("#ppb", P.ov).innerHTML = ICON_PLAY; }); }

function nextEp(P) {
  if (P.trailer || !P.ep || !P.episodes?.length) return null;
  const i = P.episodes.findIndex((e) => e.id === P.ep.id);
  return i >= 0 ? P.episodes[i + 1] || null : null;
}
function prevEp(P) {
  if (P.trailer || !P.ep || !P.episodes?.length) return null;
  const i = P.episodes.findIndex((e) => e.id === P.ep.id);
  return i > 0 ? P.episodes[i - 1] : null;
}
function save(P) {
  if (!P.ep || P.trailer || P.res?.preview) return;
  const v = P.video; if (!v.duration || !isFinite(v.duration)) return;
  P.api.saveProgress(P.title.id, { epId: P.ep.id, n: P.ep.n || 1, pos: Math.floor(v.currentTime), dur: Math.floor(v.duration) });
}
function goNext(P, ep) {
  if (!ep) return;
  save(P);
  // Locked episodes show the plan card inside the player instead of a failed request.
  if (!freeEpisode(P.title, ep) && !P.res?.premium && !P.title.previewSec) { P.video.pause(); P.ep = ep; return layer(P, `<div class="pcard"><span class="eyebrow">Episode ${ep.n} is locked</span><h3>Keep watching ${esc(P.title.title)}</h3><p>All episodes, no ads, for ₹999 a year.</p><button class="btn gold" data-pplan>See the ₹999 yearly plan</button></div>`); }
  P.video.pause();
  start(P, ep.id, false, 0);
}

const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>`;

function wire(P) {
  const { ov, video: v } = P;
  const fill = $("#pfill", ov), buf = $("#pbuf", ov), time = $("#ptime", ov), left = $("#pleft", ov), knob = $("#pknob", ov), ppb = $("#ppb", ov), bar = $("#pbar", ov), cue = $("#pcue", ov);
  ppb.innerHTML = ICON_PLAY;
  // Controls appear on a tap and fade after a few seconds of playing (like Netflix / ZEE5); they stay while paused.
  const hide = () => { if (!v.paused && !P.seeking && !P.listen) ov.classList.add("idle"); };
  const wake = () => { ov.classList.remove("idle"); clearTimeout(P.idleT); P.idleT = setTimeout(hide, 3500); };
  P.wake = wake;
  v.addEventListener("play", () => {
    // Paused for a while on a ghazal: pick up from the start of the sher, not mid-line.
    if (P.poetry && P.pausedAt && Date.now() - P.pausedAt > 4000 && P.phase === "play" && v.currentTime > 3 && !P.seeking) {
      const inSher = P.shers.length ? sherIndex(P.shers, v.currentTime) >= 0 : true;
      const to = !inSher ? v.currentTime : P.shers.length ? repeatTarget(P.shers, v.currentTime + 3) : Math.max(0, v.currentTime - 4);
      if (to < v.currentTime - 0.5) v.currentTime = to;
    }
    P.pausedAt = 0; wakeLock(P, !P.listen); if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing"; ppb.innerHTML = ICON_PAUSE; ppb.setAttribute("aria-label", "Pause"); wake(); });
  v.addEventListener("playing", () => {
    ov.classList.remove("buffering");
    if (!P.started && P.phase === "play") { P.started = true; clearTimeout(P.startT); track(P, P.trailer ? "teaser" : "start"); }
  });
  v.addEventListener("waiting", () => { if (P.phase === "play") ov.classList.add("buffering"); });
  v.addEventListener("error", () => {
    if (P.phase === "load" || P.phase === "error" || !v.getAttribute("src") && !P.hls) return;
    const c = v.error?.code; // 1 aborted, 2 network, 3 decode, 4 not supported
    errCard(P, c === 4 ? "This video format isn't supported here." : c === 3 ? "This video couldn't be decoded." : "This video stopped loading.",
      c === 4 ? "Try the latest Chrome, Safari or Edge, or another device. Please report it so we can check the file." : "Press Retry. If it keeps happening, report it and we'll check the video.", "media-" + (c || "?"));
  });
  v.addEventListener("pause", () => { P.pausedAt = Date.now(); wakeLock(P, false); if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused"; ppb.innerHTML = ICON_PLAY; ppb.setAttribute("aria-label", "Play"); ov.classList.remove("idle"); clearTimeout(P.idleT); save(P); });
  v.addEventListener("timeupdate", () => {
    const d = v.duration || 0;
    if (!P.seeking) { const pct = d ? (v.currentTime / d) * 100 : 0; fill.style.width = pct + "%"; knob.style.left = pct + "%"; }
    time.textContent = clock(v.currentTime); left.textContent = d ? "-" + clock(Math.max(0, d - v.currentTime)) : "";
    if (P.res?.ads && !P.trailer && d > MIDROLL_MIN_SEC) { cue.hidden = P.midDone; cue.style.left = "50%"; }
    if (P.res?.ads && !P.trailer && !P.midDone && d > MIDROLL_MIN_SEC && v.currentTime > d / 2 && P.phase === "play") { P.midDone = true; adBreak(P, "Mid-roll"); }
    if (Date.now() - P.saveT > 10e3) { P.saveT = Date.now(); save(P); posState(P); }
    if (P.shers.length && P.phase === "play") sherTick(P);
    if (P.sleepAt && Date.now() >= P.sleepAt) { P.sleepAt = 0; v.pause(); const sl = $("#psleep", ov); if (sl) sl.value = "0"; toast("Sleep timer: paused", 4000); }
    if (!P.trailer && !P.completed && d > 60 && v.currentTime / d > 0.9) { P.completed = true; track(P, "complete"); }
  });
  v.addEventListener("progress", () => { try { const d = v.duration; if (d && v.buffered.length) buf.style.width = (v.buffered.end(v.buffered.length - 1) / d) * 100 + "%"; } catch { /* ignore */ } });
  v.addEventListener("ended", () => {
    if (P.res?.preview) return layer(P, `<div class="pcard"><span class="eyebrow">Preview ended</span><h3>Keep watching ${esc(P.title.title)}</h3><p>Unlock every episode, with no ads, for ₹999 a year.</p><div class="row"><button class="btn gold" data-pplan>Unlock with the ₹999 yearly plan</button><button class="btn ghost" data-pclose>Close</button></div></div>`);
    save(P);
    if (!P.trailer && !P.completed) { P.completed = true; track(P, "complete"); }
    const nx = nextEp(P);
    const word = P.listen ? "listening" : "watching";
    if (P.sleepEp) { P.sleepEp = false; const sl = $("#psleep", ov); if (sl) sl.value = "0"; return layer(P, `<div class="pcard"><span class="eyebrow">Sleep timer</span><h3>Stopped at the end of the episode</h3><div class="row">${nx ? `<button class="btn gold" data-pgo>Play the next one</button>` : ""}<button class="btn ghost" data-pclose>Close</button></div></div>`); }
    if (!nx) return layer(P, `<div class="pcard"><span class="eyebrow">Finished</span><h3>Thanks for ${word}</h3><button class="btn ghost" data-pclose>Close</button></div>`);
    const nxName = `Episode ${nx.n}${nx.name && !/^Episode \d+$/.test(nx.name) ? ": " + esc(nx.name) : ""}`;
    if (!pref.autoplay) return layer(P, `<div class="pcard"><span class="eyebrow">Up next</span><h3>${nxName}</h3><div class="row"><button class="btn gold" data-pgo>Play</button><button class="btn ghost" data-pclose>Close</button></div></div>`);
    // Screen off or another app open: no countdown to look at, go straight on so the sound doesn't stop.
    if (document.hidden) return goNext(P, nx);
    // A short countdown that counts real time, so it still finishes on time if the phone slows the page down.
    const secs = P.listen ? 3 : 5, until = Date.now() + secs * 1000;
    layer(P, `<div class="pcard"><span class="eyebrow">Up next</span><h3>${nxName}</h3><p id="pcount">Starts in ${secs}s</p><div class="row"><button class="btn gold" data-pgo>Play now</button><button class="btn ghost" data-pstay>Cancel</button></div></div>`);
    clearInterval(P.countT);
    P.countT = setInterval(() => { const n = Math.ceil((until - Date.now()) / 1000); const c = $("#pcount", ov); if (c) c.textContent = `Starts in ${Math.max(0, n)}s`; if (n <= 0) { clearInterval(P.countT); goNext(P, nx); } }, 250);
  });
  // Leaving the app (screen off, another app) during the countdown: start the next episode now, since the phone may
  // slow the countdown down in the background.
  P.onVisVoice = () => { if (document.hidden) { if (P.voice) { P.voice.stop(); P.voice = null; P.voicePaused = true; } } else if (P.voicePaused && pref.voice) { P.voicePaused = false; voiceOn(P, true); } };
  document.addEventListener("visibilitychange", P.onVisVoice);
  P.onVis = () => { if (document.hidden && P.countT && P.phase === "play" && P.video.ended) { clearInterval(P.countT); P.countT = 0; goNext(P, nextEp(P)); } };
  document.addEventListener("visibilitychange", P.onVis);
  // Progress bar: tap or drag (finger or mouse); the picture jumps when you let go.
  const frac = (x) => { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)); };
  const showAt = (f) => { fill.style.width = f * 100 + "%"; knob.style.left = f * 100 + "%"; if (v.duration) time.textContent = clock(f * v.duration); };
  bar.addEventListener("pointerdown", (e) => { if (!v.duration) return; P.seeking = true; bar.setPointerCapture?.(e.pointerId); ov.classList.add("dragging"); showAt(frac(e.clientX)); wake(); });
  bar.addEventListener("pointermove", (e) => { if (P.seeking) showAt(frac(e.clientX)); });
  const endSeek = (e) => { if (!P.seeking) return; P.seeking = false; ov.classList.remove("dragging"); if (v.duration) v.currentTime = Math.min(v.duration - 1, frac(e.clientX) * v.duration); wake(); };
  bar.addEventListener("pointerup", endSeek); bar.addEventListener("pointercancel", () => { P.seeking = false; ov.classList.remove("dragging"); });
  bar.addEventListener("keydown", (e) => { if (!v.duration) return; if (e.key === "ArrowRight") v.currentTime = Math.min(v.duration - 1, v.currentTime + 10); else if (e.key === "ArrowLeft") v.currentTime = Math.max(0, v.currentTime - 10); });
  const skip = (sec) => { if (!v.duration) return; v.currentTime = Math.max(0, Math.min(v.duration - 1, v.currentTime + sec)); const fx = $(sec < 0 ? "#pfxl" : "#pfxr", ov); fx.classList.remove("on"); void fx.offsetWidth; fx.classList.add("on"); };
  $("#pq", ov).addEventListener("change", (e) => { if (P.hls) P.hls.currentLevel = Number(e.target.value); });
  $("#psleep", ov)?.addEventListener("change", (e) => {
    const val = e.target.value; P.sleepEp = val === "ep"; P.sleepAt = /^\d+$/.test(val) && val !== "0" ? Date.now() + Number(val) * 60e3 : 0;
    toast(val === "0" ? "Sleep timer off" : val === "ep" ? "Stops at the end of this episode" : `Pauses in ${val} minutes`, 2500);
  });
  ["contextmenu", "dragstart", "copy"].forEach((t) => ov.addEventListener(t, (e) => e.preventDefault()));
  // Only a real mouse wakes the controls by moving: phones send a fake mouse move just before each tap.
  ov.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" && (e.movementX || e.movementY)) wake(); });

  // Tapping the picture: one tap shows/hides the controls; a quick double tap on the left or right third skips 10 seconds.
  let lastTap = 0, tapT = 0;
  const onPicture = (e) => e.target === v || e.target.id === "pstage" || e.target.id === "pmid";
  ov.addEventListener("click", (e) => {
    const b = e.target.closest("button, [data-pclose], a, select, label");
    if (!b) {
      if (!onPicture(e) || P.phase !== "play") return;
      const r = $("#pstage", ov).getBoundingClientRect(), side = e.clientX < r.left + r.width / 3 ? -1 : e.clientX > r.right - r.width / 3 ? 1 : 0;
      const now = Date.now();
      if (side && now - lastTap < 320) { clearTimeout(tapT); lastTap = 0; if (side < 0 && P.poetry) repeatSher(P); else skip(side * 10); if (!ov.classList.contains("idle")) wake(); return; }
      lastTap = now;
      const toggle = () => { if (ov.classList.contains("idle")) wake(); else if (!v.paused) { clearTimeout(P.idleT); ov.classList.add("idle"); } };
      if (side) { clearTimeout(tapT); tapT = setTimeout(toggle, 260); } else toggle();
      return;
    }
    if (ov.classList.contains("idle") && !b.closest(".plyr")) { wake(); return; } // first tap on hidden controls just shows them
    wake();
    if (b.hasAttribute("data-pclose")) return closePlayer();
    if (b.hasAttribute("data-pp")) return v.paused ? playSafe(P) : v.pause();
    if (b.dataset.seek) return skip(Number(b.dataset.seek));
    if (b.hasAttribute("data-pnext")) return goNext(P, nextEp(P));
    if (b.hasAttribute("data-pgo")) { clearInterval(P.countT); return goNext(P, nextEp(P)); }
    if (b.hasAttribute("data-plclose")) return layer(P, "");
    if (b.hasAttribute("data-pstay")) { clearInterval(P.countT); return layer(P, `<div class="pcard"><span class="eyebrow">Autoplay stopped</span><div class="row"><button class="btn gold" data-pgo>Play the next episode</button><button class="btn ghost" data-pclose>Close</button></div></div>`); }
    if (b.hasAttribute("data-pauto")) { pref.autoplay = !pref.autoplay; b.setAttribute("aria-pressed", pref.autoplay); return toast(pref.autoplay ? "Autoplay on: the next episode starts by itself" : "Autoplay off", 2500); }
    if (b.hasAttribute("data-pmode")) return switchMode(P);
    if (b.hasAttribute("data-psher")) return repeatSher(P);
    if (b.hasAttribute("data-pshake")) { const on = !P.shake; shakeOn(P, on).then((ok) => { pref.shake = ok && on; if (ok && on) toast("Shake on. Give the phone two quick shakes to hear the sher again", 4000); }); return; }
    if (b.hasAttribute("data-pvoice")) { const on = !P.voice; pref.voice = on; voiceOn(P, on); if (on) toast("Voice on. Just say “phir se”, “dobara”, “agla”, “pichla”, “ruko” or “chalao”", 4500); return; }
    if (b.hasAttribute("data-ploop")) { P.loopN = P.loopN >= 3 ? 1 : P.loopN + 1; P.loopLeft = P.loopN - 1; b.textContent = `🔁 ×${P.loopN}`; b.setAttribute("aria-pressed", P.loopN > 1); return toast(P.loopN > 1 ? `Each sher plays ${P.loopN} times` : "Each sher plays once", 2200); }
    if (b.hasAttribute("data-plist")) return sherList(P);
    if (b.dataset.pjump) { layer(P, ""); v.currentTime = Number(b.dataset.pjump); P.loopLeft = P.loopN - 1; if (v.paused) playSafe(P); return; }
    if (b.hasAttribute("data-pfs")) return toggleFullscreen(P);
    if (b.hasAttribute("data-pretry")) return start(P, P.ep?.id || P.epId, P.trailer, Math.floor(v.currentTime || 0));
    if (b.hasAttribute("data-preport")) {
      b.disabled = true;
      Promise.resolve(P.api.reportProblem?.({ titleId: P.title.id, epId: P.ep?.id || P.epId || "", title: P.title.title, error: P.lastError, ua: navigator.userAgent.slice(0, 200) }))
        .then(() => { b.textContent = "Reported, thank you"; }).catch(() => { b.disabled = false; toast("Couldn't send the report. Try again."); });
      return;
    }
    if (b.hasAttribute("data-ptrailer")) return start(P, null, true, 0);
    const after = (fn) => { const cb = P[fn]; closePlayer(); setTimeout(() => cb?.(), 50); };
    if (b.hasAttribute("data-pplan")) return after("onNeedPlan");
    if (b.hasAttribute("data-psignin")) return after("onNeedSignIn");
    if (b.hasAttribute("data-page")) return after("onNeedAge");
  });

  // Swipe up / down for the next / previous episode on vertical shows.
  let y0 = null;
  ov.addEventListener("touchstart", (e) => { if (P.vertical) y0 = e.touches[0].clientY; }, { passive: true });
  ov.addEventListener("touchend", (e) => {
    if (y0 == null || P.phase !== "play" || P.seeking) return; const dy = e.changedTouches[0].clientY - y0; y0 = null;
    if (dy < -80) goNext(P, nextEp(P)); else if (dy > 80) goNext(P, prevEp(P));
  });

  P.onKey = (e) => {
    if (e.target.closest?.("select")) return;
    if ((e.ctrlKey || e.metaKey) && /^[spu]$/i.test(e.key)) { e.preventDefault(); return; } // save page, print, view source
    wake();
    if (e.key === "Escape" || e.key === "Backspace" || e.key === "BrowserBack" || e.key === "GoBack") { e.preventDefault(); return closePlayer(); }
    if (P.phase !== "play") return;
    if (e.key === " " || e.key === "Enter" || e.key === "MediaPlayPause") { if (document.activeElement?.tagName === "BUTTON" && e.key === "Enter") return; e.preventDefault(); v.paused ? playSafe(P) : v.pause(); }
    else if (e.key === "ArrowRight" || e.key === "MediaFastForward") { e.preventDefault(); if (v.duration) v.currentTime = Math.min(v.duration - 1, v.currentTime + 10); }
    else if (e.key === "ArrowLeft" || e.key === "MediaRewind") { e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 10); }
    else if (P.vertical && e.key === "ArrowDown") { e.preventDefault(); goNext(P, nextEp(P)); }
    else if (P.vertical && e.key === "ArrowUp") { e.preventDefault(); goNext(P, prevEp(P)); }
    else if (e.key === "MediaTrackNext" || e.key === "n") goNext(P, nextEp(P));
    else if ((e.key === "r" || e.key === "MediaTrackPrevious") && P.poetry) { e.preventDefault(); repeatSher(P); }
    else if (e.key === "f") toggleFullscreen(P);
  };
  const fsIcon = () => { const on = !!(document.fullscreenElement || document.webkitFullscreenElement); const fb = $("#pfsb", ov); if (fb) { fb.innerHTML = on ? ICON_FS_EXIT : ICON_FS; fb.setAttribute("aria-label", on ? "Exit full screen" : "Full screen"); } };
  P.onFs = fsIcon; document.addEventListener("fullscreenchange", fsIcon); document.addEventListener("webkitfullscreenchange", fsIcon);
  // Lock-screen and headphone controls, with the title shown on the phone's lock screen.
  if ("mediaSession" in navigator) {
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler("play", () => playSafe(P)); ms.setActionHandler("pause", () => v.pause());
      // iPhone's lock screen and AirPods show "skip back" rather than "previous": on poetry it repeats the sher too.
      ms.setActionHandler("seekbackward", () => { if (P.poetry && P.phase === "play") return repeatSher(P); skip(-10); }); ms.setActionHandler("seekforward", () => skip(10));
      ms.setActionHandler("nexttrack", () => { const nx = nextEp(P); if (nx) goNext(P, nx); });
      ms.setActionHandler("previoustrack", () => { if (P.poetry && P.phase === "play") return repeatSher(P); if (v.currentTime > 10) { v.currentTime = 0; return; } const pv = prevEp(P); if (pv) goNext(P, pv); });
      ms.setActionHandler("seekto", (d) => { if (v.duration && d.seekTime != null) v.currentTime = Math.min(v.duration - 1, d.seekTime); posState(P); });
    } catch { /* not every action exists everywhere */ }
  }
  document.addEventListener("keydown", P.onKey);
  P.onPop = () => teardown(false);
  window.addEventListener("popstate", P.onPop);
}

function teardown(fromCode) {
  const P = current; if (!P) return;
  P.destroyed = true; current = null;
  save(P);
  clearInterval(P.countT); clearTimeout(P.idleT); clearTimeout(P.startT); wakeLock(P, false);
  document.removeEventListener("visibilitychange", P.onVis);
  document.removeEventListener("visibilitychange", P.onVisVoice);
  if (P.voice) { P.voice.stop(); P.voice = null; }
  if (P.shake) { window.removeEventListener("devicemotion", P.shake); P.shake = null; }
  document.removeEventListener("keydown", P.onKey);
  window.removeEventListener("popstate", P.onPop);
  document.removeEventListener("fullscreenchange", P.onFs); document.removeEventListener("webkitfullscreenchange", P.onFs);
  try { screen.orientation?.unlock?.(); } catch { /* not supported */ }
  if ("mediaSession" in navigator) { try { navigator.mediaSession.metadata = null; ["play", "pause", "seekbackward", "seekforward", "nexttrack", "previoustrack", "seekto"].forEach((a) => navigator.mediaSession.setActionHandler(a, null)); } catch { /* ignore */ } }
  try { P.video.pause(); P.hls?.destroy(); P.video.removeAttribute("src"); P.video.load(); } catch { /* ignore */ }
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.();
  P.ov.remove(); document.body.classList.remove("playing");
  if (fromCode) history.back();
  P.onClosed?.();
}

// Full screen. Android and computers: the whole player, turned sideways for wide titles.
// iPhone can only make the video itself full screen (Safari's own player; no download or AirPlay there).
function toggleFullscreen(P) {
  const ov = P.ov, v = P.video;
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    try { screen.orientation?.unlock?.(); } catch { /* ignore */ }
    return (document.exitFullscreen?.() || document.webkitExitFullscreen?.())?.catch?.(() => {});
  }
  const el = ov.requestFullscreen ? ov : ov.webkitRequestFullscreen ? ov : null;
  if (el) {
    const go = el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : el.webkitRequestFullscreen();
    return Promise.resolve(go).then(() => { if (!P.vertical && screen.orientation?.lock && innerHeight > innerWidth) screen.orientation.lock("landscape").catch(() => {}); }).catch(() => {});
  }
  if (v.webkitEnterFullscreen) { try { v.webkitEnterFullscreen(); } catch { toast("Turn your phone sideways for a bigger picture."); } return; }
  toast("Full screen isn't available in this browser.");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Lock-screen progress bar (Android shows it on the media notification).
function posState(P) {
  const v = P.video;
  try { if (navigator.mediaSession?.setPositionState && v.duration && isFinite(v.duration)) navigator.mediaSession.setPositionState({ duration: v.duration, position: Math.min(v.currentTime, v.duration), playbackRate: v.playbackRate || 1 }); } catch { /* ignore */ }
}

// Keep the screen on while someone is watching the picture; let it sleep while they only listen.
async function wakeLock(P, on) {
  try {
    if (on && !P.lock && navigator.wakeLock && !document.hidden) { P.lock = await navigator.wakeLock.request("screen"); P.lock.addEventListener?.("release", () => { P.lock = null; }); }
    else if (!on && P.lock) { const l = P.lock; P.lock = null; await l.release(); }
  } catch { P.lock = null; }
}

// Switch between watching and listening at the same point, without the rating card or another ad.
function switchMode(P) {
  if (P.trailer) return;
  const at = Math.floor(P.video.currentTime || 0);
  const opts = { api: P.api, title: P.title, episodes: P.episodes, epId: P.ep?.id || P.epId, trailer: false, startAt: at, ads: P.ads, direct: P.direct,
    onNeedPlan: P.onNeedPlan, onNeedSignIn: P.onNeedSignIn, onNeedAge: P.onNeedAge, onClosed: P.onClosed, listen: !P.listen, skipIntro: true, midDone: P.midDone, loopN: P.loopN };
  openPlayer(opts).then(() => { if (current && current.listen) toast("Listening: lock your phone or switch apps, it keeps playing", 3500); });
}

// ---- Repeat the last sher -------------------------------------------------------------------------------
// With sher timings: back to the start of the sher just heard (pressed again right away: one sher further back).
// Without them yet (poetry titles): back 20 seconds.
function repeatSher(P) {
  const v = P.video; if (P.phase !== "play" || !v.duration) return;
  const to = P.shers.length ? repeatTarget(P.shers, v.currentTime) : Math.max(0, v.currentTime - FALLBACK_BACK);
  v.currentTime = Math.min(to, v.duration - 1); P.loopLeft = P.loopN - 1;
  const fx = $("#pfxl", P.ov); if (fx) { const sp = fx.querySelector("span"); if (sp) sp.textContent = P.shers.length ? "Sher again" : `${FALLBACK_BACK} sec`; fx.classList.remove("on"); void fx.offsetWidth; fx.classList.add("on"); setTimeout(() => { if (sp) sp.textContent = "10 sec"; }, 700); }
  if (v.paused) playSafe(P);
  posState(P);
}
// Follows the sher being recited (Listen mode shows it under the poster) and loops it when "🔁 ×2 / ×3" is on.
function sherTick(P) {
  const v = P.video, now = v.currentTime, i = sherIndex(P.shers, now);
  if (i !== P.sherI) { P.sherI = i; P.loopLeft = P.loopN - 1; showSher(P, i); }
  if (i < 0 || P.loopLeft <= 0) return;
  const sh = P.shers[i], nx = P.shers[i + 1];
  const end = sh.e ? sh.e + 0.3 : nx ? nx.t - 0.6 : (v.duration || 0) - 0.5;
  if (now >= end && (!nx || now < nx.t)) { P.loopLeft--; v.currentTime = sh.t; }
}
function showSher(P, i) {
  const box = $("#lsher", P.ov); if (!box) return;
  const sh = i >= 0 ? P.shers[i] : null;
  box.hidden = !sh;
  if (sh) box.innerHTML = `<p>${esc(sh.text).replace(/\n/g, "<br>")}</p>${sh.en ? `<small>${esc(sh.en).replace(/\n/g, "<br>")}</small>` : ""}<span class="lsn">Sher ${i + 1} of ${P.shers.length}</span>`;
}
function sherList(P) {
  const cur = sherIndex(P.shers, P.video.currentTime);
  layer(P, `<div class="pcard plistc"><div class="plbox"><span class="eyebrow">Shers in this ghazal</span>
    <div class="shl">${P.shers.map((x, i) => `<button class="shr ${i === cur ? "on" : ""}" data-pjump="${x.t}"><span class="tm">${fmt(x.t)}</span><span class="tx">${esc(x.text || `Sher ${i + 1}`).replace(/\n/g, "<br>")}</span></button>`).join("")}</div>
    <div class="row"><button class="btn ghost" data-plclose>Back to the player</button></div></div></div>`);
}

// ---- Voice commands -----------------------------------------------------------------------------------
function voiceOn(P, on) {
  const btn = $("#pvoice", P.ov), pill = $("#pvst", P.ov), tx = $("#pvtx", P.ov);
  if (P.voice) { P.voice.stop(); P.voice = null; }
  btn?.setAttribute("aria-pressed", on); if (pill) pill.hidden = !on;
  if (!on) return;
  if (tx) tx.textContent = "Starting the microphone…";
  P.voice = startVoice({
    onState: (st) => {
      if (!tx || P.destroyed) return;
      if (st === "listening") { pill.classList.add("live"); tx.textContent = P.poetry ? "Say “phir se”, “agla” or “ruko”" : "Say “dobara”, “agla” or “ruko”"; }
      else if (st === "denied" || st === "nomic" || st === "error" || st === "unsupported") {
        pill.classList.remove("live"); pref.voice = false; btn?.setAttribute("aria-pressed", false); pill.hidden = true; P.voice = null;
        toast(st === "denied" ? "Microphone not allowed. Allow it for this site in the browser settings to use voice." : st === "nomic" ? "No microphone found." : "Voice commands aren't working in this browser. Try Chrome.", 5000);
      }
    },
    onCommand: (cmd, heard) => voiceCommand(P, cmd, heard),
  });
}
function voiceCommand(P, cmd, heard) {
  if (P.destroyed) return;
  const v = P.video, say = (t) => { const tx = $("#pvtx", P.ov); if (tx) { tx.textContent = `“${heard.trim()}” · ${t}`; clearTimeout(P.vsayT); P.vsayT = setTimeout(() => { if (tx) tx.textContent = "Listening…"; }, 2500); } };
  if (cmd === "repeat") { say(P.poetry ? "repeating the sher" : "back 10 seconds"); if (P.poetry) repeatSher(P); else if (v.duration) v.currentTime = Math.max(0, v.currentTime - 10); return; }
  if (cmd === "next") { const nx = nextEp(P); say(nx ? "next episode" : "this is the last episode"); if (nx) { clearInterval(P.countT); goNext(P, nx); } return; }
  if (cmd === "prev") { const pv = prevEp(P); say(pv ? "previous episode" : "this is the first episode"); if (pv) goNext(P, pv); return; }
  if (cmd === "pause") { say("paused"); v.pause(); return; }
  if (cmd === "play") { say("playing"); if (P.phase === "play" && v.paused) playSafe(P); else if (v.ended) { const nx = nextEp(P); if (nx) goNext(P, nx); } }
}

// ---- Shake to repeat the sher ----------------------------------------------------------------------------
// Two quick, firm shakes (not walking or putting the phone down) = "phir se". Works with the app open on screen.
const shakeSupported = () => typeof window !== "undefined" && "DeviceMotionEvent" in window && (navigator.maxTouchPoints || 0) > 0;
const needsMotionAsk = () => typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function";
async function shakeOn(P, on) {
  const btn = $("#pshake", P.ov);
  if (P.shake) { window.removeEventListener("devicemotion", P.shake); P.shake = null; }
  btn?.setAttribute("aria-pressed", false);
  if (!on) return true;
  if (needsMotionAsk()) {
    try { if ((await DeviceMotionEvent.requestPermission()) !== "granted") { toast("Motion access wasn't allowed, so shake can't work. You can allow it in Safari's settings for this site.", 5000); return false; } }
    catch { toast("Tap Shake again to allow motion access.", 3000); return false; }
  }
  let peaks = [], last = 0;
  P.shake = (e) => {
    const a = e.accelerationIncludingGravity || e.acceleration; if (!a) return;
    const g = Math.hypot(a.x || 0, a.y || 0, a.z || 0), now = Date.now();
    if (Math.abs(g - 9.8) < 14) return;                        // ordinary movement
    if (now - (peaks.at(-1) || 0) < 120) return;              // the same jolt, not a new shake
    peaks = peaks.filter((t) => now - t < 900); peaks.push(now);
    if (peaks.length >= 3 && now - last > 2000) { last = now; peaks = []; if (navigator.vibrate) navigator.vibrate(40); repeatSher(P); toast("📳 Sher again", 1500); }
  };
  window.addEventListener("devicemotion", P.shake);
  btn?.setAttribute("aria-pressed", true);
  return true;
}
