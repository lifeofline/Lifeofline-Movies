// Lifeofline Movies — the app people open on phones, computers and TVs.
// Hash routes: #home #reels #movies #series #search #t/<titleId> #plans #account #signin #grievance #admin
import { firebaseConfig, appConfig } from "./config.js";
import { $, $$, esc, day, dur, posterStyle, isSoon, loadScript, toast, isTV } from "./util.js";
import { STARTER_TITLES, withStarter } from "./starter-titles.js";
import { DEMO_SERIES, isDemo, demoEpisodes } from "./demo-series.js";
import { LANGS, KINDS, KIDS_OK, freeEpisode } from "./access.js";
import { openPlayer } from "./player.js";

const DEMO = String(firebaseConfig.apiKey || "").startsWith("PASTE");
const api = DEMO ? (await import("./api-demo.js")).createDemoApi() : (await import("./api-firebase.js")).createFirebaseApi(firebaseConfig, appConfig);
const PRICE = 499; // Premium is paid once a year

/* ---------- state ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem("lm_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("lm_" + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const S = {
  user: null, profile: null, premium: false, sub: null, billing: DEMO ? "test" : "", admin: false,
  titles: [], progress: {}, list: [], ads: [],
  lang: store.get("lang", "All"), kids: store.get("kids", null), tv: store.get("tv", isTV()), heroI: 0, ready: false,
  after: null, // where to go after signing in
};
const visible = () => S.titles.filter((t) => !S.kids?.on || KIDS_OK.has(t.rating || "U"));
const byId = (id) => S.titles.find((t) => t.id === id);
const inLang = (list) => (S.lang === "All" ? list : list.filter((t) => t.lang === S.lang));

async function loadCatalogue() {
  const [titles, ads] = await Promise.all([api.titles().catch(() => []), api.ads().catch(() => [])]);
  // The demo series ship with the site; a Firestore title with the same id (edited in Admin) wins.
  const have = new Set(titles.map((t) => t.id));
  S.titles = [...titles.map(withStarter), ...DEMO_SERIES.filter((d) => !have.has(d.id))]; S.ads = ads;
}
// Demo series carry their own episodes; everything else asks the server.
const episodesOf = (id) => (demoEpisodes(id) ? Promise.resolve(demoEpisodes(id)) : api.episodes(id).catch(() => []));
async function loadMine() {
  if (!S.user) { S.progress = {}; S.list = []; S.premium = false; S.sub = null; S.admin = false; S.profile = null; return; }
  const [progress, list, st, admin, profile] = await Promise.all([
    api.getProgress().catch(() => ({})), api.myList().catch(() => []),
    api.subStatus().catch(() => null), api.isAdmin().catch(() => false), api.profile().catch(() => null),
  ]);
  Object.assign(S, { progress, list, admin, profile });
  if (st) { S.premium = st.premium; S.sub = st.sub; S.billing = st.mode; }
}

/* ---------- shell ---------- */
const NAV = [["home", "Home"], ["reels", "Reels"], ["movies", "Movies"], ["series", "Series"], ["search", "Search"], ["plans", "Plans"]];
const TABS = [["home", "Home", "M3 11 12 4l9 7v9h-6v-6H9v6H3z"], ["reels", "Reels", "M8 2h8a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zm2 7v6l5-3z"], ["search", "Search", "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zm5 11.5L20 20"], ["movies", "Movies", "M3 6h18v13H3zM3 10h18M8 6v4M13 6v4M18 6v4"], ["account", "Account", "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21c1-4 4-6 8-6s7 2 8 6"]];

function shell(route) {
  $("#nav").innerHTML = NAV.map(([k, l]) => `<a href="#${k}" data-nav class="${route === k ? "on" : ""}">${l}</a>`).join("");
  $("#tabbar").innerHTML = TABS.map(([k, l, d]) => `<a href="#${k}" class="${route === k ? "on" : ""}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="${d}"/></svg>${l}</a>`).join("");
  $("#tabbar").hidden = false;
  $("#me").innerHTML = S.premium ? `<a href="#account" class="badge prem" data-nav>Premium</a>`
    : `<a href="#plans" class="btn gold sm" data-nav>Subscribe ₹${PRICE}/yr</a>`;
  $("#acct").innerHTML = S.user ? `<a href="#account" class="avatar" data-nav aria-label="Account">${esc((S.user.name || "?").slice(0, 1).toUpperCase())}</a>` : `<a href="#signin" class="btn ghost sm" data-nav>Sign in</a>`;
  $("#demo").hidden = !DEMO;
  document.body.classList.toggle("tv", !!S.tv);
  document.body.classList.toggle("kids", !!S.kids?.on);
}

/* ---------- pieces ---------- */
// Available now = has a video and isn't marked Coming soon. Concept = a fictional film shown only as artwork.
const avail = (t) => !isSoon(t);
const isConcept = (t) => !!t?.concept;
const relDate = (t) => (t.releaseDate && !isNaN(Date.parse(t.releaseDate)) ? new Date(t.releaseDate + "T00:00:00+05:30").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
// How many episodes a free viewer can watch, from the title's own data.
function freeCount(t) {
  const n = Number(t.episodeCount) || 0;
  if (!t.premium) return n;
  if (t.kind === "short") return Math.min(n, t.freeEps ?? 3);
  if (t.kind === "series") return Math.min(n, t.freeEps ?? 1);
  return Math.min(n, t.freeEps ?? 0);
}
const freeNow = (t) => avail(t) && freeCount(t) > 0;
function eyebrow(t) {
  if (isConcept(t)) return "Concept showcase · Fictional film";
  if (isDemo(t)) return `Demo series · Season ${t.season || 1} · Fictional story cards`;
  const parts = [t.original ? "Lifeofline Original" : "", KINDS[t.kind] || ""];
  if (isSoon(t)) parts.push(relDate(t) ? `Releasing ${relDate(t)}` : "Coming soon");
  return parts.filter(Boolean).join(" · ");
}
// The one accurate main action for this viewer.
function mainAction(t) {
  if (isConcept(t) || isSoon(t)) return t.teaser || t.trailerUid ? `<button class="btn gold" data-trailer="${esc(t.id)}" data-nav>▶ ${t.trailerUid ? "Watch trailer" : "Watch poster teaser"}</button>` : "";
  if (isDemo(t)) return `<button class="btn gold" data-play="${esc(t.id)}" data-nav>▶ Play demo episode 1</button>`;
  if (S.premium) return `<button class="btn gold" data-play="${esc(t.id)}" data-nav>▶ Play</button>`;
  if (!t.premium) return `<button class="btn gold" data-play="${esc(t.id)}" data-nav>▶ Watch free</button>`;
  if (freeCount(t) > 0) return `<button class="btn gold" data-play="${esc(t.id)}" data-nav>▶ Watch episode 1 free</button>`;
  return `<a class="btn gold" href="#plans" data-nav>Subscribe to watch · ₹${PRICE}</a>`;
}
function tile(t, shape = "tall") {
  const p = S.progress[t.id];
  const tag = isConcept(t) ? `<span class="tag concept">Concept</span>`
    : isDemo(t) ? `<span class="tag demo">Demo</span>`
    : isSoon(t) ? `<span class="tag soon">${relDate(t) ? esc(relDate(t)) : "Coming soon"}</span>`
    : !t.premium ? `<span class="tag">Free</span>` : freeCount(t) > 0 && !S.premium ? `<span class="tag">Ep 1 free</span>` : `<span class="tag prem">Premium</span>`;
  const pct = p?.dur ? Math.min(100, (p.pos / p.dur) * 100) : 0;
  return `<a class="tile" href="#t/${esc(t.id)}" data-nav aria-label="${esc(t.title)}"${t.teaser ? ` data-teaser="${esc(t.teaser)}"` : ""}>
    <div class="poster ${shape}" style="${posterStyle(t)}">${tag}${t.format === "v" ? '<span class="tag r">9:16</span>' : ""}${t.poster ? "" : `<div class="pt">${esc(t.title)}</div>`}</div>
    ${p ? `<div class="prog"><i style="width:${pct}%"></i></div>` : ""}
    <div class="cap">${t.poster ? `<b>${esc(t.title)}</b>` : ""}<span>${isConcept(t) ? "Concept" : isDemo(t) ? "Demo series · 3 short episodes" : `${esc(KINDS[t.kind] || "")} · ${esc(t.lang || "")}`}</span></div></a>`;
}
function rail(title, items, { shape = "tall", sub = "", more = "" } = {}) {
  if (!items.length) return "";
  return `<section class="rail"><div class="rail-h"><h2>${title}</h2>${more ? `<a href="${more}" data-nav>See all</a>` : `<span>${sub}</span>`}</div>
    <div class="rowwrap"><button class="rarr l" data-scroll="-1" aria-label="Scroll left" tabindex="-1">‹</button>
    <div class="track ${shape}">${items.map((t) => tile(t, shape)).join("")}</div>
    <button class="rarr r" data-scroll="1" aria-label="Scroll right" tabindex="-1">›</button></div></section>`;
}
// Ten picks with big rank numbers, like a streaming "Top 10" row (an editorial list, set by the order in Admin).
function top10(items) {
  if (items.length < 5) return "";
  return `<section class="rail"><div class="rail-h"><h2>Top 10 picks on Lifeofline</h2><span>Chosen by our team</span></div>
    <div class="rowwrap"><button class="rarr l" data-scroll="-1" aria-label="Scroll left" tabindex="-1">‹</button>
    <div class="track top10">${items.slice(0, 10).map((t, i) => `<div class="rank"><span class="num" aria-hidden="true">${i + 1}</span>${tile(t, "tall")}</div>`).join("")}</div>
    <button class="rarr r" data-scroll="1" aria-label="Scroll right" tabindex="-1">›</button></div></section>`;
}
const chips = () => `<div class="chips" role="group" aria-label="Language">${["All", ...LANGS.filter((l) => S.titles.some((t) => t.lang === l))].map((l) => `<button class="chip ${S.lang === l ? "on" : ""}" data-lang="${esc(l)}" data-nav>${l === "All" ? "All languages" : esc(l)}</button>`).join("")}</div>`;
const empty = (msg, cta = "") => `<div class="empty"><p>${msg}</p>${cta}</div>`;

/* ---------- views ---------- */
// The 5-second silent animated poster, looping. Still poster instead when the viewer prefers less motion.
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const teaserVideo = (t, cls = "tvid") => calm() ? "" :
  `<video class="${cls}" src="${esc(t.teaser)}" poster="${esc(t.poster || "")}" muted loop autoplay playsinline preload="metadata" aria-hidden="true"></video>`;
const GENRE_RAILS = [
  ["Thrillers and crime", /thriller|crime|mystery|heist|underworld/i],
  ["Family and feel-good", /family|comedy|slice of life|friendship/i],
  ["Romance", /romance|love/i],
  ["Action", /action|war|patriot/i],
  ["Drama", /drama|social|courtroom/i],
];
function vHome() {
  const all = visible();
  if (!all.length) return empty(S.ready ? (S.admin ? "No titles published yet. Add the first one in Admin." : "New titles are on the way. Check back soon.") : `<span class="spin"></span>`, S.admin ? `<a class="btn gold" href="#admin">Open Admin</a>` : "");
  // Demo series play, but they are kept out of the banner, Top 10, "free now" and the counts so they never pass for releases.
  const ready = all.filter((t) => avail(t) && !isDemo(t));
  const R = inLang(ready);
  const demos = inLang(all.filter(isDemo));
  const upcoming = inLang(all.filter((t) => isSoon(t) && !isConcept(t)));
  const concepts = inLang(all.filter(isConcept));
  // Banner: only titles people can watch now. With nothing playable yet, the concept films, clearly labelled.
  const art = (t) => !!(t.banner || t.poster || t.teaser);
  let pool = [...new Set([...ready.filter(art), ...ready])].slice(0, 5);
  if (!pool.length) pool = [...all.filter((t) => isSoon(t) && !isConcept(t) && art(t)), ...all.filter((t) => isConcept(t) && art(t))].slice(0, 6);
  const cont = Object.entries(S.progress).sort((a, b) => b[1].at - a[1].at).map(([id]) => byId(id)).filter(Boolean).filter((t) => visible().includes(t) && avail(t));
  const list = S.list.map(byId).filter(Boolean);
  const newest = [...R].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0) || (a.order ?? 999) - (b.order ?? 999));
  const many = R.length >= 8; // collections only once there's enough to fill them without repeating
  const row = (name, list2, opts) => (list2.length >= 3 ? rail(name, list2, opts) : "");
  return `${pool.length ? heroCarousel(pool) : ""}
    ${chips()}
    ${S.premium ? "" : rail("Watch free now", R.filter(freeNow), { sub: "No plan needed · short ad breaks" })}
    ${rail("Continue watching", cont, { shape: "wide" })}
    ${rail("New on Lifeofline", newest.slice(0, 12), { shape: "wide" })}
    ${top10(ready)}
    ${rail("Reels · short dramas", R.filter((t) => t.kind === "short"), { more: "#reels", sub: "Two-minute episodes" })}
    ${many ? row("Lifeofline Originals", R.filter((t) => t.original && t.kind !== "short"), { shape: "wide" }) : ""}
    ${many ? row("Movies", R.filter((t) => t.kind === "movie"), { shape: "wide", more: "#movies" }) : ""}
    ${many ? row("Web series", R.filter((t) => t.kind === "series"), { shape: "wide", more: "#series" }) : ""}
    ${many ? GENRE_RAILS.map(([name, re]) => row(name, R.filter((t) => re.test(t.genre || "")))).join("") : ""}
    ${many ? LANGS.map((l) => row(`In ${l}`, ready.filter((t) => t.lang === l))).join("") : ""}
    ${rail("My List", list, { shape: "tall" })}
    ${R.length ? "" : `<div class="note-strip"><b>New films and series are being added.</b> Until then, try the demo series and the teasers in our concept showcase below.</div>`}
    ${rail("Demo series", demos, { sub: "Fictional animated story cards · 3 silent 5-second episodes each · free, no ads" })}
    ${rail("Coming soon", upcoming, { sub: "Release dates where confirmed" })}
    ${rail("Concept showcase", concepts, { sub: "Fictional films in development · animated poster teasers, not film footage" })}
    ${S.premium || S.kids?.on ? "" : planStrip(ready)}`;
}
// The ₹499 yearly plan, explained with what is actually available today.
function planStrip(ready) {
  const n = ready.length;
  return `<section class="planbox"><div class="pb-main"><div class="price">₹${PRICE}<small> / year</small></div>
      <p>${n ? `${n} title${n === 1 ? "" : "s"} available today. Premium unlocks all of them with no ads, in Full HD, on your phone, computer and TV.` : "Premium unlocks every film and series as it's released, with no ads."} Prices include GST. Cancel anytime.</p>
      <a class="btn gold" href="#plans" data-nav>See plan and FAQ</a></div>
    ${faqHtml(ready, 3)}</section>`;
}
// Full-width banner that rotates through up to 6 titles, playing each one's teaser, like the big streaming apps.
function heroCarousel(pool) {
  const slide = (h, i) => {
    const wide = !!h.banner; // a purpose-made 16:9 banner fills the whole slide
    const img = h.banner || h.poster;
    const bg = img ? `background-image:url('${String(img).replace(/'/g, "%27")}')` : posterStyle(h);
    return `<article class="slide ${i === 0 ? "on" : ""}" data-i="${i}" aria-roledescription="slide" aria-label="${i + 1} of ${pool.length}: ${esc(h.title)}" ${i ? 'aria-hidden="true"' : ""}>
      <div class="sbg ${wide ? "wide" : ""}" style="${bg}"></div>
      ${wide ? "" : `<div class="sart" style="${posterStyle(h)}">${h.teaser && !calm() ? `<video src="${esc(h.teaser)}" poster="${esc(h.poster || "")}" muted loop playsinline preload="${i === 0 ? "auto" : "none"}" aria-hidden="true"></video>` : ""}${isConcept(h) && h.teaser ? `<span class="artlbl">Animated poster teaser</span>` : ""}</div>`}
      <div class="hshade"></div>
      <div class="hcopy">
        <span class="eyebrow">${esc(eyebrow(h))}</span>
        <h1>${esc(h.title)}</h1>
        <div class="meta"><span class="rating">${esc(h.rating || "U")}</span><span>${esc(h.genre || "")}</span><span>${esc(h.lang || "")}</span></div>
        <p>${esc(h.synopsis || h.desc || "")}</p>
        <div class="row">
          ${mainAction(h)}
          <button class="btn ghost" data-listtog="${esc(h.id)}" data-nav>${S.list.includes(h.id) ? "✓ My List" : "＋ My List"}</button>
          <a class="btn ghost" href="#t/${esc(h.id)}" data-nav>ⓘ More info</a>
        </div>
      </div>
    </article>`;
  };
  return `<section class="hero" id="hero" aria-roledescription="carousel" aria-label="Featured on Lifeofline">
    ${pool.map(slide).join("")}
    ${pool.length > 1 ? `<button class="harrow prev" data-slide="-1" aria-label="Previous">‹</button><button class="harrow next" data-slide="1" aria-label="Next">›</button>
    <div class="dots">${pool.map((t, i) => `<button class="${i === 0 ? "on" : ""}" data-goslide="${i}" aria-label="Show ${esc(t.title)}"><i></i></button>`).join("")}</div>` : ""}
  </section>`;
}

let heroTimer = 0;
const HERO_MS = 8000;
function mountHero() {
  clearInterval(heroTimer);
  const hero = $("#hero"); if (!hero) return;
  const slides = $$(".slide", hero), dots = $$(".dots button", hero);
  let i = 0, paused = false;
  const show = (n) => {
    i = (n + slides.length) % slides.length;
    slides.forEach((sl, k) => {
      const on = k === i; sl.classList.toggle("on", on); sl.toggleAttribute("aria-hidden", !on);
      const v = $("video", sl); if (v) { if (on) { v.preload = "auto"; v.currentTime = 0; v.play().catch(() => {}); } else v.pause(); }
    });
    dots.forEach((d, k) => { d.classList.toggle("on", k === i); d.classList.remove("run"); if (k === i) { void d.offsetWidth; d.classList.add("run"); } });
  };
  const next = () => { if (!paused && !document.hidden && !document.body.classList.contains("playing")) show(i + 1); };
  show(0);
  if (slides.length > 1 && !calm()) heroTimer = setInterval(next, HERO_MS);
  hero.classList.toggle("auto", slides.length > 1 && !calm());
  hero.addEventListener("mouseenter", () => { paused = true; hero.classList.add("paused"); });
  hero.addEventListener("mouseleave", () => { paused = false; hero.classList.remove("paused"); });
  hero.addEventListener("focusin", (e) => { if (e.target.matches?.(":focus-visible")) { paused = true; hero.classList.add("paused"); } });
  hero.addEventListener("focusout", () => { paused = false; hero.classList.remove("paused"); });
  hero.addEventListener("click", (e) => {
    const b = e.target.closest("[data-slide],[data-goslide]"); if (!b) return;
    e.stopPropagation();
    show(b.dataset.slide ? i + Number(b.dataset.slide) : Number(b.dataset.goslide));
    clearInterval(heroTimer); if (slides.length > 1 && !calm()) heroTimer = setInterval(next, HERO_MS);
  });
  let x0 = null;
  hero.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) { show(i + (dx < 0 ? 1 : -1)); clearInterval(heroTimer); if (!calm()) heroTimer = setInterval(next, HERO_MS); } });
}

function vGrid(kind) {
  const base = inLang(visible().filter((t) => (kind === "movies" ? t.kind === "movie" : t.kind !== "movie")));
  const f = S.avail || "all";
  const real = (t) => avail(t) && !isDemo(t);
  const rank = (t) => (real(t) ? 0 : isDemo(t) ? 1 : 2);
  const items = base.filter((t) => f === "now" ? real(t) : f === "demo" ? isDemo(t) : f === "soon" ? !avail(t) : true).sort((a, b) => rank(a) - rank(b));
  const nNow = base.filter(real).length, nDemo = base.filter(isDemo).length, nSoon = base.filter((t) => !avail(t)).length;
  const label = { all: "All", now: `Available now (${nNow})`, demo: `Demo series (${nDemo})`, soon: `Coming soon and concepts (${nSoon})` };
  const keys = ["all", "now", ...(nDemo ? ["demo"] : []), "soon"];
  return `<div class="ptitle"><h1>${kind === "movies" ? "Movies" : "Series and short dramas"}</h1><span>${items.length} title${items.length === 1 ? "" : "s"}</span></div>
    <div class="chips" role="group" aria-label="Availability">${keys.map((k) => `<button class="chip ${f === k ? "on" : ""}" data-avail="${k}" data-nav>${label[k]}</button>`).join("")}</div>
    ${chips()}
    <div class="grid">${items.map((t) => tile(t, "tall")).join("")}</div>${items.length ? "" : empty(f === "now" ? "Nothing available here yet." : "Nothing here yet.")}`;
}

function vReels() {
  const items = inLang(visible().filter((t) => t.kind === "short"));
  if (!items.length) return `${chips()}${empty("No short dramas yet.")}`;
  return `<div class="reels" id="reels">${items.map((t) => {
    const p = S.progress[t.id];
    return `<section class="reel"><div class="rframe" style="${posterStyle(t)}">
      <div class="rover"><span class="eyebrow">${esc(t.genre || "")} · ${t.episodeCount || "?"} episodes</span><h3>${esc(t.title)}</h3><p>${esc(t.desc || "")}</p>
        <div class="row"><button class="btn gold" data-play="${esc(t.id)}" data-nav>▶ ${p ? `Continue ep ${p.n}` : "Watch ep 1"}</button>${!S.premium && t.premium && freeCount(t) > 0 ? `<span class="free">${freeCount(t) === 1 ? "Ep 1" : `Ep 1–${freeCount(t)}`} free</span>` : ""}</div></div>
      <div class="rside"><button data-listtog="${esc(t.id)}" aria-label="My List" data-nav>${S.list.includes(t.id) ? "✓" : "＋"}</button><span>My List</span>
        <a href="#t/${esc(t.id)}" aria-label="All episodes" data-nav>≡</a><span>Episodes</span>
        <button data-share="${esc(t.id)}" aria-label="Share" data-nav>↗</button><span>Share</span></div>
    </div></section>`;
  }).join("")}</div>`;
}

function vSearch(q = "") {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = words.length ? visible().filter((t) => words.every((w) => `${t.title} ${t.genre} ${t.lang} ${t.desc} ${(t.cast || []).join(" ")}`.toLowerCase().includes(w))) : [];
  return `<div class="ptitle"><h1>Search</h1></div>
    <label class="search"><span class="sr">Search titles</span><input id="q" type="search" placeholder="Titles, genres, languages, actors" value="${esc(q)}" autocomplete="off" data-nav></label>
    <div class="grid" id="hits">${(words.length ? hits : visible().slice(0, 12)).map((t) => tile(t)).join("")}</div>
    ${words.length && !hits.length ? empty(`No titles match “${esc(q)}”.`) : ""}`;
}

async function vTitle(id) {
  const t = withStarter(byId(id) || (await api.title(id).catch(() => null)));
  if (!t) return empty("This title isn't available.", `<a class="btn ghost" href="#home">Go home</a>`);
  if (S.kids?.on && !KIDS_OK.has(t.rating)) return empty(`This title is rated ${esc(t.rating)}. Leave Kids mode to watch it.`, `<a class="btn ghost" href="#account">Account</a>`);
  const eps = await episodesOf(id);
  S.eps = { id, eps };
  const p = S.progress[id];
  const demo = isDemo(t);
  const first = p ? eps.find((e) => e.id === p.epId) || eps[0] : eps[0];
  const locked = (e) => !S.premium && !freeEpisode(t, e);
  const concept = isConcept(t);
  const soon = (concept || isSoon(t)) && !(S.admin && first); // admins can still test a title once a video is uploaded
  // What a free viewer gets, worked out from the actual episodes.
  const free = eps.filter((e) => freeEpisode(t, e));
  const run = free.length && free.every((e, k) => e.n === k + 1);
  const what = t.kind === "movie" ? "movie" : "episodes";
  let access;
  if (concept) access = "Concept showcase · not scheduled for release";
  else if (demo) access = `Demo series · ${eps.length} short silent episodes · free to watch, no ads`;
  else if (soon) access = relDate(t) ? `Coming soon · releasing ${relDate(t)}` : "Coming soon · release date to be announced";
  else if (!t.premium) access = "Available now · free with ads";
  else if (S.premium) access = "Available now · included in your Premium plan";
  else if (!free.length) access = `Available now · in the ₹${PRICE} Premium plan`;
  else if (free.length === eps.length) access = "Available now · free with ads";
  else access = `Available now · ${run ? (free.length === 1 ? "episode 1" : `episodes 1–${free.length}`) : `${free.length} of ${eps.length} episodes`} free with ads, the rest in the ₹${PRICE} plan`;
  const locks = !S.premium && t.premium && free.length < eps.length;
  const note = concept ? "This is a concept for a fictional film in development. The video is an animated poster teaser, not footage from a film."
    : demo ? "This is a fictional demo series. Each episode is a 5-second animated story card with on-screen text: not filmed, no actors, no dialogue."
    : soon ? "Not out yet. Add it to My List and you'll find it there on release."
    : locks ? `Get Premium for ₹${PRICE} a year to watch ${t.kind === "movie" ? "this movie" : free.length ? "the rest" : "all episodes"} without ads.` : "";
  const runtime = t.kind === "movie" ? dur(eps[0]?.duration) : eps.length ? `${demo ? `Season ${t.season || 1} · ` : ""}${eps.length} episode${eps.length === 1 ? "" : "s"}` : "";
  const words = (x) => new Set(String(x.genre || "").toLowerCase().split(/[^a-z-]+/).filter((w) => w.length > 2));
  const mine = words(t);
  const like = visible().filter((x) => x.id !== t.id).map((x) => [x, [...words(x)].filter((w) => mine.has(w)).length + (x.lang === t.lang ? 0.5 : 0) + (avail(x) ? 1 : 0)])
    .filter(([, n]) => n >= 1.5).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([x]) => x);
  const facts = [
    ["Runtime", runtime],
    ["Release", t.releaseDate && !soon ? relDate(t) : t.year || ""],
    ["Director", t.director || ""],
    ["Cast", (t.cast || []).join(", ")],
    ["Audio", t.audio || (avail(t) ? t.lang : "")],
    ["Subtitles", t.subtitles || (avail(t) ? "None yet" : "")],
    ["Genre", t.genre || ""],
    ["Age rating", `${t.rating || "U"}${t.descriptor ? ` · ${t.descriptor}` : ""}`],
  ].filter(([, v]) => v);
  const playLabel = p ? (t.kind === "movie" ? "Resume" : `Continue ep ${first?.n}`) : demo ? "Play episode 1" : S.premium || !t.premium ? (t.kind === "movie" ? "Play" : "Play episode 1") : free.length ? (t.kind === "movie" ? "Watch free" : "Watch episode 1 free") : "";
  return `<div class="dback" style="${t.poster ? `background-image:url('${String(t.poster).replace(/'/g, "%27")}')` : posterStyle(t)}" aria-hidden="true"></div>
  <div class="detail ${t.format === "v" ? "v" : ""}">
    <div class="dposter" style="${posterStyle(t)}">${t.teaser ? teaserVideo(t) : t.poster ? "" : `<div class="pt">${esc(t.title)}</div>`}${concept && t.teaser ? `<span class="artlbl">Animated poster teaser</span>` : ""}</div>
    <div class="dbody">
      <span class="eyebrow">${esc(eyebrow(t))}${t.format === "v" ? " · vertical" : ""}</span>
      <h1>${esc(t.title)}</h1>
      <div class="meta"><span class="rating" title="Age rating">${esc(t.rating || "U")}</span><span>${esc(t.genre || "")}</span><span>${esc(t.lang || "")}</span>${runtime ? `<span>${esc(runtime)}</span>` : ""}</div>
      <p class="avail ${soon ? "no" : "yes"}">${esc(access)}</p>
      ${t.synopsis ? `<p class="desc">${esc(t.synopsis)}</p>${t.desc && t.desc !== t.synopsis ? `<p class="tagline">“${esc(t.desc)}”</p>` : ""}` : `<p class="desc">${esc(t.desc || "")}</p>`}
      <div class="row">
        ${soon ? "" : first && playLabel ? `<button class="btn gold" data-play="${esc(t.id)}" data-ep="${esc(first.id)}" data-nav>▶ ${playLabel}</button>` : !first ? "" : `<a class="btn gold" href="#plans" data-nav>Subscribe to watch · ₹${PRICE}</a>`}
        ${t.trailerUid || t.teaser ? `<button class="btn ${soon ? "gold" : "ghost"}" data-trailer="${esc(t.id)}" data-nav>▶ ${t.trailerUid ? "Trailer" : "Poster teaser"}</button>` : ""}
        <button class="btn ghost" data-listtog="${esc(t.id)}" data-nav>${S.list.includes(t.id) ? "✓ In My List" : "＋ My List"}</button>
        <button class="btn ghost" data-share="${esc(t.id)}" data-nav>Share</button>
      </div>
      ${note ? `<p class="small">${esc(note)}${locks ? ` <a href="#plans">See the plan</a>` : ""}</p>` : ""}
      ${soon && S.admin ? `<p class="small">Admin: ${concept ? "untick “Concept showcase” and add a release date when this becomes a real production. " : ""}Upload the film in <a href="#admin">Admin</a>, then untick “Coming soon”.</p>` : ""}
      <dl class="facts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      ${t.kind !== "movie" && eps.length ? `<h3>Episodes</h3><div class="eps">${eps.map((e) => {
        const ep = S.progress[id]?.epId === e.id ? S.progress[id] : null;
        const done = ep && ep.dur && ep.pos / ep.dur > 0.9;
        return `<button class="ep" data-play="${esc(t.id)}" data-ep="${esc(e.id)}" data-nav>
          <span class="n">${String(e.n).padStart(2, "0")}</span>
          <span class="thumb" style="${e.thumb ? `background:#000 url('${String(e.thumb).replace(/'/g, "%27")}') center/cover` : posterStyle(t)}"></span>
          <span class="info"><b>${esc(e.name || "Episode " + e.n)}</b>${e.desc ? `<em>${esc(e.desc)}</em>` : ""}<span>${esc(dur(e.duration))}${done ? " · watched" : ep ? " · watching" : ""}</span></span>
          ${demo ? `<span class="free">Demo</span>` : locked(e) ? `<span class="lock">₹${PRICE} plan</span>` : !S.premium ? `<span class="free">Free · ads</span>` : ""}</button>`;
      }).join("")}</div>` : ""}
    </div></div>
    ${like.length ? `<section class="rail"><div class="rail-h"><h2>More like this</h2></div><div class="grid">${like.map((x) => tile(x, "tall")).join("")}</div></section>` : ""}`;
}

// Plain answers to what people ask before paying. `limit` shows the first few (Home); Plans shows them all.
function faqHtml(ready, limit = 99) {
  const names = ready.slice(0, 4).map((t) => t.title);
  const renew = S.billing === "subscription"
    ? `Premium is ₹${PRICE} for a full year, charged once a year through UPI Autopay, card or netbanking. Your bank or UPI app notifies you before each yearly charge.`
    : `Premium is a 1-year pass for ₹${PRICE}: you pay once and watch for 365 days. It doesn't renew by itself; we email you a week before it ends and you pay again to continue.`;
  const qa = [
    ["What can I watch today?", ready.length ? `${ready.length} title${ready.length === 1 ? " is" : "s are"} available now${names.length ? `, including ${names.join(", ")}` : ""}. New films and series are added regularly; the concept showcase is not available to watch yet.` : "New films and series are being added now. The concept showcase shows films in development; their animated poster teasers are free to watch."],
    ["How do I cancel?", `Open Account → Plan → Cancel renewal. You keep Premium until the end of the period you paid for, and you can also cancel the UPI Autopay mandate in your UPI app.`],
    ["Can I watch on my TV?", "Yes. Open movies.lifeofline.com in the browser of an Android TV, Google TV or Fire TV and sign in; it switches to a TV layout you can use with the remote. TV and phone apps in the stores are coming."],
    ["Which devices work?", "Android phones and iPhones (in the browser, or add it to your home screen), computers (Chrome, Edge, Safari or Firefox) and smart TVs with a browser. Sign in with the same account everywhere; Continue watching follows you."],
    ["How many screens at once?", "Premium is for you and your household. Sign in on your own devices; please don't share your account outside your home."],
    ["How does renewal work?", renew],
    ["How can I pay?", "UPI (GPay, PhonePe, Paytm and others), debit and credit cards, and netbanking, through Razorpay. Prices include GST."],
    ["What is free?", "Titles marked Free, and the first episodes of some series, play with short ad breaks. Poster teasers and trailers are free for everyone."],
  ];
  return `<div class="faq">${qa.slice(0, limit).map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}${limit < qa.length ? `<a class="small" href="#plans" data-nav>All questions</a>` : ""}</div>`;
}

function vPlans() {
  const s = S.sub, active = S.premium;
  const ready = visible().filter((t) => avail(t) && !isDemo(t));
  return `<div class="ptitle"><div><span class="eyebrow">Plans</span><h1>One payment a year. Everything unlocked.</h1></div></div>
  <div class="plans two">
    <div class="plan"><span class="pk">Always free</span><h3>Free with ads</h3><div class="amt">₹0</div>
      <ul><li>Titles marked Free and some first episodes</li><li>Poster teasers and trailers</li><li>Short ad breaks</li><li>Phone, computer and TV browser</li><li class="no">Premium titles</li></ul>
      <a class="btn ghost" href="#home" data-nav>Keep watching free</a></div>
    <div class="plan hl"><span class="pk gold">Premium</span><h3>Premium</h3><div class="amt">₹${PRICE}<small> / year</small></div>
      <ul><li>Every available film, series and short drama${ready.length ? ` (${ready.length} today)` : ""}</li><li>No ads</li><li>Full HD where the video has it</li><li>Phone, computer and TV browser</li><li>Pay once, watch for 12 months</li><li>Cancel anytime</li></ul>
      ${active ? `<a class="btn" href="#account" data-nav>Your plan · till ${day(s?.until)}</a>` : `<button class="btn gold" data-subscribe data-nav>Subscribe for ₹${PRICE} a year</button>`}
      <p class="small">${S.billing === "subscription" ? "One payment a year. Renews yearly through UPI Autopay, card or netbanking, with a notice before each charge." : S.billing === "pass" ? "One payment for a full year (365 days). We email you before it ends; pay again to renew. It never charges you by itself." : DEMO ? "Demo mode: no money is taken." : "Pay with UPI, card or netbanking."}</p></div>
  </div>
  <h2 class="faqh">Questions</h2>
  ${faqHtml(ready)}
  <p class="small">Prices include GST. Lifeofline Movies is run by Lifeofline Pvt Ltd. <a href="refund.html">Cancellation and refunds</a> · <a href="terms.html">Terms</a></p>`;
}

function vSignin(mode = "in") {
  const up = mode === "up", reset = mode === "reset";
  return `<div class="auth"><span class="eyebrow">Lifeofline Movies</span><h1>${up ? "Create your account" : reset ? "Reset your password" : "Sign in"}</h1>
    <form id="authf" novalidate>
      ${up ? `<label class="f">Your name<input id="an" autocomplete="name" required maxlength="60" data-nav></label>` : ""}
      <label class="f">Email<input id="ae" type="email" autocomplete="email" required data-nav></label>
      ${reset ? "" : `<label class="f">Password<input id="ap" type="password" autocomplete="${up ? "new-password" : "current-password"}" minlength="6" required data-nav></label>`}
      <p class="err" id="aerr" hidden></p>
      <button class="btn gold wide" type="submit" data-nav>${up ? "Create account" : reset ? "Email me a reset link" : "Sign in"}</button>
    </form>
    ${reset ? "" : `<button class="btn ghost wide" data-google data-nav>Continue with Google</button>`}
    <p class="small">${up ? `Have an account? <a href="#signin">Sign in</a>` : `New here? <a href="#signup">Create an account</a>`}${up || reset ? "" : ` · <a href="#reset">Forgot password?</a>`}</p>
    ${up ? `<p class="small">By continuing you agree to the <a href="terms.html">Terms</a> and <a href="privacy.html">Privacy Policy</a>.</p>` : ""}</div>`;
}

function vAccount() {
  if (!S.user) return vSignin("in");
  const s = S.sub;
  const planLine = S.premium ? (s?.status === "cancelling" ? `Premium till ${day(s.until)} · won't renew` : s?.mode === "subscription" ? `Premium · ₹${PRICE}/year · renews once a year` : `Premium till ${day(s?.until)}`) : "Free with ads";
  const adult = S.profile?.adult;
  return `<div class="ptitle"><h1>Account</h1>${S.premium ? `<span class="badge prem">Premium</span>` : `<span class="badge free">Free with ads</span>`}</div>
  <div class="cards">
    <div class="card"><h3>${esc(S.user.name || "You")}</h3><div class="kv"><span>Email</span><span>${esc(S.user.email || "")}</span></div>
      ${S.user.emailVerified || DEMO ? "" : `<p class="small">Check your inbox to verify your email. <button class="link" data-verify>Send again</button></p>`}
      <button class="btn ghost" data-signout data-nav>Sign out</button></div>
    <div class="card"><h3>Plan</h3><div class="kv"><span>Current plan</span><span>${esc(planLine)}</span></div>
      ${S.premium ? (s?.status === "cancelling" ? `<a class="btn gold" href="#plans" data-nav>Renew</a>` : s?.mode === "subscription" || s?.mode === "test" ? `<button class="btn ghost" data-cancel data-nav>Cancel renewal</button>` : `<a class="btn ghost" href="#plans" data-nav>Renew early</a>`) : `<a class="btn gold" href="#plans" data-nav>Get Premium for ₹${PRICE}</a>`}</div>
    <div class="card"><h3>Age</h3>
      ${adult == null ? `<p class="small">Add your date of birth to watch titles rated A (18+). It can't be changed later.</p>
        <label class="f">Date of birth<input type="date" id="dob" max="${new Date().toISOString().slice(0, 10)}" data-nav></label><button class="btn ghost" data-dob data-nav>Save</button>`
        : `<div class="kv"><span>Titles rated A</span><span>${adult ? "Allowed" : "Not allowed (under 18)"}</span></div>`}</div>
    <div class="card"><h3>Kids mode</h3><p class="small">Shows only titles rated U and U/A 7+ on this device. A 4-digit PIN is needed to leave it.</p>
      ${S.kids?.on ? `<button class="btn ghost" data-kidsoff data-nav>Leave Kids mode</button>` : `<label class="f">Choose a 4-digit PIN<input id="kpin" inputmode="numeric" maxlength="4" pattern="\\d{4}" autocomplete="off" data-nav></label><button class="btn ghost" data-kidson data-nav>Turn on Kids mode</button>`}</div>
    <div class="card"><h3>This device</h3><div class="kv"><span>TV layout</span><span>${S.tv ? "On" : "Off"}</span></div>
      <p class="small">Big tiles and remote-control arrows. Turns on by itself on Android TV, Fire TV and smart TVs.</p><button class="btn ghost" data-tvtog data-nav>${S.tv ? "Turn off" : "Turn on"} TV layout</button></div>
    <div class="card"><h3>Help</h3><p class="small">Questions, complaints about a title or a payment problem: we reply within 24 hours and resolve within 15 days.</p>
      <a class="btn ghost" href="#grievance" data-nav>Contact the grievance officer</a>
      ${S.admin ? `<a class="btn gold" href="#admin" data-nav>Open Admin</a>` : `<button class="link small" data-claim>I'm on the admin list</button>`}</div>
  </div>`;
}

function vGrievance() {
  return `<div class="auth wide"><span class="eyebrow">Grievance redressal</span><h1>Tell us what went wrong</h1>
    <p class="small">Lifeofline Pvt Ltd · Grievance Officer · ${esc(appConfig.supportEmail || "")}<br>We acknowledge every complaint within 24 hours and decide within 15 days, as the IT Rules 2021 require. Read our <a href="content-policy.html">content classification policy</a>.</p>
    <form id="grf" novalidate>
      <label class="f">Your name<input id="gn" required maxlength="80" value="${esc(S.user?.name || "")}" data-nav></label>
      <label class="f">Email for our reply<input id="ge" type="email" required value="${esc(S.user?.email || "")}" data-nav></label>
      <label class="f">Title it is about (optional)<input id="gt" maxlength="120" data-nav></label>
      <label class="f">What happened<textarea id="gx" rows="6" required maxlength="3000" data-nav></textarea></label>
      <p class="err" id="gerr" hidden></p>
      <button class="btn gold" type="submit" data-nav>Send</button>
    </form></div>`;
}

/* ---------- router ---------- */
let renderSeq = 0;
async function route() {
  const seq = ++renderSeq;
  const h = decodeURIComponent((location.hash || "#home").slice(1));
  const [r, arg] = h.split("/");
  let html = "", tab = r;
  if (r === "t") { html = await vTitle(arg); tab = ""; }
  else if (r === "reels") html = vReels();
  else if (r === "movies" || r === "series") html = vGrid(r);
  else if (r === "search") html = vSearch(S.q || "");
  else if (r === "plans") html = vPlans();
  else if (r === "account") html = vAccount();
  else if (r === "signin" || r === "signup" || r === "reset") { html = S.user ? vAccount() : vSignin(r === "signup" ? "up" : r === "reset" ? "reset" : "in"); tab = "account"; }
  else if (r === "grievance") html = vGrievance();
  else if (r === "admin") {
    if (!S.admin) html = empty("Admins only.", `<a class="btn ghost" href="#account">Account</a>`);
    else { const m = await import("./admin.js"); if (seq !== renderSeq) return; html = `<div id="adm"></div>`; setTimeout(() => m.mountAdmin($("#adm"), { api, S, reload: async () => { await loadCatalogue(); } }), 0); }
  } else { html = vHome(); tab = "home"; }
  if (seq !== renderSeq) return;
  clearInterval(heroTimer);
  $("#app").innerHTML = html;
  shell(tab === "signin" ? "account" : tab);
  // Space above the page (header + demo bar): the banner and title backdrop slide up under it.
  document.documentElement.style.setProperty("--toph", ($(".top").offsetHeight + ($("#demo").hidden ? 0 : $("#demo").offsetHeight)) + "px");
  document.body.classList.toggle("home", tab === "home" && !!$("#hero"));
  document.body.classList.toggle("titlepg", r === "t");
  onScroll();
  if ($("#hero")) mountHero();
  clearTimeout(peekT);
  if (!S.keepScroll) window.scrollTo(0, 0);
  S.keepScroll = false;
  if (S.tv) setTimeout(() => { const f = $("#app [data-nav]"); if (f && !document.activeElement?.closest("#app")) f.focus({ preventScroll: true }); }, 30);
  if (r === "search") { const q = $("#q"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}
window.addEventListener("hashchange", () => { if (history.state?.player) return; route(); });

// Header is see-through over the banner and turns solid once the page scrolls.
function onScroll() { document.querySelector(".top")?.classList.toggle("solid", window.scrollY > 40); }
window.addEventListener("scroll", onScroll, { passive: true });

// Row arrows (computer): scroll a row by almost a screen.
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-scroll]"); if (!b) return;
  const tr = b.parentElement.querySelector(".track"); tr.scrollBy({ left: Number(b.dataset.scroll) * tr.clientWidth * 0.85, behavior: calm() ? "auto" : "smooth" });
});

// Hover preview (computer) and focus preview (TV): the tile grows a little and plays its teaser.
const canHover = matchMedia("(hover: hover) and (pointer: fine)");
let peekT = 0;
function peek(tileEl) {
  clearTimeout(peekT);
  if (!tileEl?.dataset.teaser || calm()) return;
  peekT = setTimeout(() => {
    if (tileEl.classList.contains("peek")) return;
    $$(".tile.peek").forEach(unpeek);
    const box = $(".poster", tileEl); if (!box) return;
    const v = document.createElement("video");
    Object.assign(v, { src: tileEl.dataset.teaser, muted: true, loop: true, playsInline: true, autoplay: true });
    v.className = "tvid"; v.setAttribute("aria-hidden", "true");
    box.append(v); v.play().catch(() => {});
    tileEl.classList.add("peek");
  }, 450);
}
function unpeek(tileEl) { clearTimeout(peekT); if (!tileEl) return; tileEl.classList.remove("peek"); $$("video.tvid", tileEl).forEach((v) => v.remove()); }
document.addEventListener("mouseover", (e) => { if (!canHover.matches) return; const t = e.target.closest(".tile"); if (t) peek(t); });
document.addEventListener("mouseout", (e) => { const t = e.target.closest(".tile"); if (t && !t.contains(e.relatedTarget)) unpeek(t); });
document.addEventListener("focusin", (e) => { if (!S.tv) return; const t = e.target.closest?.(".tile"); $$(".tile.peek").forEach((x) => x !== t && unpeek(x)); if (t) peek(t); });

/* ---------- actions ---------- */
async function play(titleId, epId, trailer = false) {
  const t = withStarter(byId(titleId) || (await api.title(titleId)));
  if (!t) return toast("This title isn't available.");
  if (!trailer && isSoon(t) && !S.admin) return toast(`${t.title} is coming soon. Add it to My List to find it on release.`);
  const eps = S.eps?.id === titleId ? S.eps.eps : await episodesOf(titleId);
  S.eps = { id: titleId, eps };
  const p = S.progress[titleId];
  if (!epId && !trailer) epId = p?.epId || eps[0]?.id;
  const startAt = !trailer && p && p.epId === epId && p.pos < (p.dur || 0) - 30 ? p.pos : 0;
  openPlayer({
    api, title: t, episodes: eps, epId, trailer, startAt, ads: S.ads, direct: !t.trailerUid && t.teaser ? t.teaser : "",
    onNeedPlan: () => { location.hash = "#plans"; },
    onNeedSignIn: () => { S.after = location.hash || "#home"; location.hash = "#signin"; },
    onNeedAge: () => { location.hash = "#account"; },
    onClosed: async () => { if (S.user) { S.progress = await api.getProgress().catch(() => S.progress); S.keepScroll = true; route(); } },
  });
}

async function subscribe(btn) {
  if (!S.user) { S.after = "#plans"; toast("Sign in or create an account first."); location.hash = "#signup"; return; }
  if (btn) btn.disabled = true;
  try {
    const o = await api.subStart();
    if (o.mode === "test") return confirmSheet(`<span class="eyebrow">${DEMO ? "Demo mode" : "Test mode"}</span><h2>Start Premium?</h2><p>No money is taken${DEMO ? " in the demo" : " until Razorpay keys are added on Render"}.</p>`, "Start Premium", async () => { await api.subVerify({}); await afterPaid(); });
    await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    const opts = {
      key: o.keyId, name: "Lifeofline Movies", description: o.mode === "subscription" ? `Premium · ₹${o.price}/year` : `Premium · 1 year`,
      prefill: { name: S.user.name, email: S.user.email }, theme: { color: "#f4ad3d" },
      handler: async (r) => { try { await api.subVerify(r); await afterPaid(); } catch (e) { toast(e.message, 5000); } },
      modal: { ondismiss: () => { if (btn) btn.disabled = false; } },
    };
    if (o.mode === "subscription") opts.subscription_id = o.subscriptionId; else { opts.order_id = o.orderId; opts.amount = o.price * 100; opts.currency = "INR"; }
    const rz = new window.Razorpay(opts);
    // Razorpay's own reason (card declined, UPI timed out, website not approved …) instead of a generic error.
    rz.on("payment.failed", (r) => { const er = r?.error || {}; toast(`Payment didn't go through: ${er.description || er.reason || "unknown reason"}${er.reason ? ` (${er.reason})` : ""}`, 7000); if (btn) btn.disabled = false; });
    rz.open();
  } catch (e) { toast(e.message, 7000); }
  finally { if (btn) btn.disabled = false; }
}
async function afterPaid() { await loadMine(); toast("You're Premium. Everything is unlocked and ads are off.", 4000); location.hash = "#home"; route(); }

// In-page confirmation (no browser dialogs).
function confirmSheet(html, okLabel, onOk) {
  const ov = document.createElement("div"); ov.className = "sheet-ov";
  ov.innerHTML = `<div class="sheet" role="dialog">${html}<p class="err" hidden></p><div class="row"><button class="btn gold" data-ok>${esc(okLabel)}</button><button class="btn ghost" data-no>Cancel</button></div></div>`;
  document.body.append(ov);
  const close = () => ov.remove();
  ov.addEventListener("click", async (e) => {
    if (e.target === ov || e.target.closest("[data-no]")) return close();
    if (e.target.closest("[data-ok]")) { const b = e.target.closest("[data-ok]"); b.disabled = true; try { await onOk(ov); close(); } catch (er) { const p = $(".err", ov); p.textContent = er.message; p.hidden = false; b.disabled = false; } }
  });
  $("[data-ok]", ov).focus();
  return ov;
}

const pinHash = async (pin) => { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("lm-kids:" + pin)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); };

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-play],[data-trailer],[data-lang],[data-avail],[data-hero],[data-listtog],[data-share],[data-subscribe],[data-signout],[data-cancel],[data-dob],[data-kidson],[data-kidsoff],[data-tvtog],[data-google],[data-verify],[data-claim],[data-demo-reset]");
  if (!el) return;
  if (el.dataset.play) return play(el.dataset.play, el.dataset.ep);
  if (el.dataset.trailer) return play(el.dataset.trailer, null, true);
  if (el.dataset.lang) { S.lang = el.dataset.lang; store.set("lang", S.lang); S.keepScroll = true; return route(); }
  if (el.dataset.avail) { S.avail = el.dataset.avail; S.keepScroll = true; return route(); }
  if (el.dataset.listtog) {
    try { const on = await api.toggleList(el.dataset.listtog); S.list = on ? [el.dataset.listtog, ...S.list] : S.list.filter((x) => x !== el.dataset.listtog); toast(on ? "Added to My List" : "Removed from My List");
      // Update the buttons in place so the banner doesn't jump back to its first slide.
      $$(`[data-listtog="${CSS.escape(el.dataset.listtog)}"]`).forEach((b) => { b.textContent = b.textContent.replace(/^(✓|＋) (In )?My List$/, (m, _s, inn) => `${on ? "✓" : "＋"} ${inn || ""}My List`); });
      if (!location.hash.startsWith("#home") && location.hash !== "" && !location.hash.startsWith("#t/")) { S.keepScroll = true; route(); } }
    catch (er) { if (er.needSignIn) { S.after = location.hash; location.hash = "#signin"; } toast(er.message); }
    return;
  }
  if (el.dataset.share) {
    const t = byId(el.dataset.share); const url = `${location.origin}${location.pathname}#t/${el.dataset.share}`;
    try { if (navigator.share) await navigator.share({ title: t?.title, text: `Watch ${t?.title} on Lifeofline Movies`, url }); else { await navigator.clipboard.writeText(url); toast("Link copied"); } } catch { /* cancelled */ }
    return;
  }
  if (el.hasAttribute("data-subscribe")) return subscribe(el);
  if (el.hasAttribute("data-signout")) { await api.signOut(); toast("Signed out"); location.hash = "#home"; return; }
  if (el.hasAttribute("data-cancel")) return confirmSheet(`<h2>Cancel renewal?</h2><p>You keep Premium till ${day(S.sub?.until)}. After that, free titles still play with ads.</p>`, "Cancel renewal", async () => { await api.subCancel(); await loadMine(); toast("Renewal cancelled"); route(); });
  if (el.hasAttribute("data-dob")) {
    const v = $("#dob")?.value; if (!v) return toast("Pick your date of birth.");
    return confirmSheet(`<h2>Save ${esc(new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }))}?</h2><p>Your date of birth can't be changed later.</p>`, "Save", async () => { const r = await api.setDob(v); S.profile = { ...(S.profile || {}), adult: r.adult }; toast("Saved"); route(); });
  }
  if (el.hasAttribute("data-kidson")) {
    const pin = $("#kpin")?.value || ""; if (!/^\d{4}$/.test(pin)) return toast("Enter 4 digits for the PIN.");
    S.kids = { on: true, pin: await pinHash(pin) }; store.set("kids", S.kids); toast("Kids mode is on"); location.hash = "#home"; return route();
  }
  if (el.hasAttribute("data-kidsoff")) {
    return confirmSheet(`<h2>Leave Kids mode</h2><label class="f">PIN<input id="kout" inputmode="numeric" maxlength="4" autocomplete="off"></label>`, "Leave Kids mode", async (ov) => {
      if ((await pinHash($("#kout", ov).value)) !== S.kids.pin) throw new Error("That PIN isn't right.");
      S.kids = null; store.set("kids", null); toast("Kids mode is off"); route();
    });
  }
  if (el.hasAttribute("data-tvtog")) { S.tv = !S.tv; store.set("tv", S.tv); return route(); }
  if (el.hasAttribute("data-google")) { try { await api.google(); } catch (er) { const p = $("#aerr"); if (p) { p.textContent = er.message; p.hidden = false; } } return; }
  if (el.hasAttribute("data-verify")) { try { await api.sendVerify(); toast("Verification email sent"); } catch (er) { toast(er.message); } return; }
  if (el.hasAttribute("data-claim")) { try { await api.claimAdmin(); S.admin = true; toast("You're an admin now"); location.hash = "#admin"; } catch (er) { toast(er.message, 4000); } return; }
  if (el.hasAttribute("data-demo-reset")) { api.resetDemo?.(); location.reload(); }
});

document.addEventListener("input", (e) => {
  if (e.target.id !== "q") return;
  S.q = e.target.value;
  clearTimeout(S.qT); S.qT = setTimeout(() => { const pos = e.target.selectionStart; route().then(() => { const q = $("#q"); if (q) q.setSelectionRange(pos, pos); }); }, 220);
});

document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === "authf") {
    const err = $("#aerr"); err.hidden = true;
    const show = (m) => { err.textContent = m; err.hidden = false; };
    const email = $("#ae").value.trim(), pass = $("#ap")?.value || "", name = $("#an")?.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return show("Enter a valid email address.");
    const b = $("button[type=submit]", f); b.disabled = true;
    try {
      if (location.hash === "#reset") { await api.resetPassword(email); show("Check your inbox for a reset link."); return; }
      if (pass.length < 6) return show("Use a password of at least 6 characters.");
      if (location.hash === "#signup") { if (!name) return show("Enter your name."); await api.signUp(name, email, pass); }
      else await api.signIn(email, pass);
    } catch (er) { show(er.message); } finally { b.disabled = false; }
  }
  if (f.id === "grf") {
    const err = $("#gerr"); err.hidden = true;
    const d = { name: $("#gn").value.trim(), email: $("#ge").value.trim(), title: $("#gt").value.trim(), text: $("#gx").value.trim() };
    if (!d.name || !/^\S+@\S+\.\S+$/.test(d.email) || d.text.length < 10) { err.textContent = "Add your name, a valid email and a few words about the problem."; err.hidden = false; return; }
    try { await api.grievance(d); $("#app").innerHTML = `<div class="auth"><span class="eyebrow">Received</span><h1>Thanks, we have your complaint</h1><p>We'll reply to ${esc(d.email)} within 24 hours and resolve it within 15 days.</p><a class="btn ghost" href="#home">Back to Home</a></div>`; }
    catch (er) { err.textContent = er.message; err.hidden = false; }
  }
});

/* ---------- TV remote: arrow keys move between tiles and buttons ---------- */
document.addEventListener("keydown", (e) => {
  if (!S.tv || document.body.classList.contains("playing") || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
  if (e.target.matches?.("input, textarea, select") && ["ArrowLeft", "ArrowRight"].includes(e.key)) return;
  const all = $$("[data-nav], .sheet-ov button, .sheet-ov input").filter((x) => x.offsetParent !== null);
  const cur = document.activeElement;
  if (!all.includes(cur)) { all[0]?.focus(); e.preventDefault(); return; }
  const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  const horiz = e.key === "ArrowLeft" || e.key === "ArrowRight";
  let best = null, bd = Infinity;
  for (const t of all) {
    if (t === cur) continue;
    const b = t.getBoundingClientRect(), dx = b.left + b.width / 2 - ax, dy = b.top + b.height / 2 - ay;
    const ok = e.key === "ArrowRight" ? dx > 8 : e.key === "ArrowLeft" ? dx < -8 : e.key === "ArrowDown" ? dy > 8 : dy < -8;
    if (!ok) continue;
    const d = horiz ? Math.abs(dx) + Math.abs(dy) * 3 : Math.abs(dy) + Math.abs(dx) * 0.6;
    if (d < bd) { bd = d; best = t; }
  }
  if (best) { e.preventDefault(); best.focus({ preventScroll: true }); best.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); }
});

/* ---------- start ---------- */
if ("serviceWorker" in navigator && !DEMO && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
shell("home");
await loadCatalogue();
S.ready = true;
route();
// First time an admin opens the app: add the 20 Lifeofline films as "Coming soon" titles (only if none are there yet).
async function addStarterTitles({ force = false } = {}) {
  const have = new Set((await api.allTitles()).map((t) => t.id));
  const missing = STARTER_TITLES.filter((t) => !have.has(t.id));
  if (!missing.length || (!force && missing.length < STARTER_TITLES.length)) return 0;
  for (const t of missing) await api.saveTitle({ ...t, episodeCount: 0 });
  await loadCatalogue();
  return missing.length;
}
window.__addStarterTitles = addStarterTitles;

api.onAuth(async (u) => {
  S.user = u;
  await loadMine();
  if (S.admin) addStarterTitles().then((n) => { if (n) { toast(`Added ${n} Lifeofline films as “Coming soon”.`, 4000); route(); } }).catch((e) => console.warn("starter titles", e));
  if (u && S.after) { const go = S.after; S.after = null; location.hash = go; }
  else if (u && /^#(signin|signup|reset)$/.test(location.hash)) location.hash = "#home";
  route();
});
