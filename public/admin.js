// Admin: add titles and episodes, upload videos to Cloudflare Stream, posters and ad images, give free Premium.
// Opens at #admin for accounts listed in the admins collection (see SETUP.md).
import { $, esc, dur, posterStyle, toast, hues } from "./util.js";
import { LANGS, KINDS, RATINGS } from "./access.js";
import { withStarter } from "./starter-titles.js";

export async function mountAdmin(root, { api, reload }) {
  const A = { tab: "titles", titles: [], editing: null, eps: [], ads: [], busy: false };

  async function refresh() { A.titles = await api.allTitles(); render(); }
  const tabs = [["titles", "Titles"], ["support", "Support"], ["ads", "Ads"], ["gifts", "Free Premium"], ["stats", "Numbers"]];
  // Support inbox: live chats from the help chat (Lifeofline Helpdesk).
  const SUP = { threads: null, sel: "", msgs: null, stopAll: null, stop: null };
  const QUICK = ["Thanks for reaching out! Looking into this now.", "Could you share the title name and what you see on screen?", "Done. Please reopen the app and let us know if anything else is needed.", "We've checked with Razorpay; you'll get an update within one working day."];
  function supportView() {
    if (!SUP.stopAll) SUP.stopAll = api.watchSupportThreads((l) => { SUP.threads = l; if (A.tab === "support") $("#abody") && ($("#abody").innerHTML = supportView()); });
    if (SUP.sel) {
      const t = (SUP.threads || []).find((x) => x.id === SUP.sel) || {};
      return `<div class="card sup"><div class="row"><button class="btn ghost sm" data-sback data-nav>‹ All chats</button><span class="spacer"></span><button class="btn ${t.status === "solved" ? "ghost" : "gold"} sm" data-ssolve="${t.status === "solved" ? "open" : "solved"}" data-nav>${t.status === "solved" ? "Reopen" : "Mark solved"}</button></div>
        <h3>${esc(t.name || "Viewer")} <span class="small">${esc(t.role || "")}${t.email ? " · " + esc(t.email) : ""}</span></h3>
        <div class="supm" id="supm">${SUP.msgs === null ? `<span class="spin"></span>` : SUP.msgs.map((m) => `<div class="sm ${m.from === "team" ? "t" : "u"}">${m.from === "team" ? `<small>Helpdesk${m.name ? " · " + esc(m.name) : ""}</small>` : ""}${esc(m.text)}</div>`).join("")}</div>
        <div class="chips">${QUICK.map((q) => `<button class="chip" data-squick="${esc(q)}" data-nav>${esc(q.slice(0, 30))}…</button>`).join("")}</div>
        <label class="f">Reply<textarea id="supin" maxlength="2000" rows="3" data-nav></textarea></label><button class="btn gold" data-ssend data-nav>Send reply</button>
        <p class="small">They get an email and see your reply in their chat. Call, WhatsApp and email details are set in ArtistCart Admin → Support.</p></div>`;
    }
    const list = SUP.threads;
    return list === null ? `<div class="card"><span class="spin"></span></div>` : list.length ? `<div class="card">${list.map((x) => `<button class="suprow ${x.teamUnread ? "new" : ""}" data-sopen="${esc(x.id)}" data-nav><b>${x.status === "solved" ? "✅" : x.teamUnread ? "🔴" : "💬"} ${esc(x.name || "Viewer")} · ${esc(x.role || "")}</b><span class="small">${x.lastFrom === "team" ? "You: " : ""}${esc((x.lastText || "").slice(0, 90))}</span></button>`).join("")}</div>`
      : `<div class="card"><p class="small">No chats yet. When a viewer taps "Chat with us" in the help chat, it shows up here.</p></div>`;
  }

  function render() {
    root.innerHTML = `<div class="ptitle"><div><span class="eyebrow">Admin</span><h1>Lifeofline Movies</h1></div><span>${api.mode === "demo" ? "Demo mode: changes stay in this browser" : ""}</span></div>
      <div class="chips">${tabs.map(([k, l]) => `<button class="chip ${A.tab === k ? "on" : ""}" data-atab="${k}" data-nav>${l}</button>`).join("")}</div>
      <div id="abody">${A.tab === "titles" ? (A.editing ? editor() : titleList()) : A.tab === "ads" ? adsView() : A.tab === "support" ? supportView() : A.tab === "gifts" ? giftView() : `<div class="card" id="stats"><span class="spin"></span></div>`}</div>`;
    if (A.tab === "stats") api.stats().then((x) => { const el = $("#stats"); if (el) el.innerHTML = statsHtml(x); }).catch((e) => { const el = $("#stats"); if (el) el.textContent = e.message; });
  }

  // Viewing numbers: last 7 days, top titles and the latest playback problems.
  function statsHtml(x) {
    const n = (v) => Number(v || 0);
    const days = (x.days || []).slice().reverse();
    const sum = (k) => days.reduce((a, d) => a + n(d[k]), 0);
    const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "–");
    const name = (id) => A.titles.find((t) => t.id === id)?.title || id;
    return `<h3>Right now</h3>
      <div class="kv"><span>People with Premium</span><span>${n(x.premium)}</span></div><div class="kv"><span>Accounts</span><span>${n(x.users)}</span></div>
      <div class="kv"><span>Titles</span><span>${n(x.titles)}</span></div><div class="kv"><span>Payments · video</span><span>${esc(x.billing)} · ${esc(x.video)}</span></div>
      <h3>Last 7 days</h3>
      <div class="kv"><span>Videos started</span><span>${sum("start")}</span></div>
      <div class="kv"><span>Playback errors</span><span>${sum("error")} (${pct(sum("error"), sum("start") + sum("error"))} of attempts)</span></div>
      <div class="kv"><span>Watched to the end (90%+)</span><span>${sum("complete")} (${pct(sum("complete"), sum("start"))} of starts)</span></div>
      <div class="kv"><span>Teasers played</span><span>${sum("teaser")}</span></div>
      <div class="kv"><span>New accounts → new Premium</span><span>${sum("signup")} → ${sum("newPremium")} (${pct(sum("newPremium"), sum("signup"))})</span></div>
      <div class="tbl"><table class="atable"><thead><tr><th>Day</th><th>Starts</th><th>Errors</th><th>Completed</th><th>Teasers</th><th>Sign-ups</th><th>New Premium</th><th>Reports</th></tr></thead><tbody>
        ${days.map((d) => `<tr><td>${esc(d.day)}</td><td>${n(d.start)}</td><td>${n(d.error)}</td><td>${n(d.complete)}</td><td>${n(d.teaser)}</td><td>${n(d.signup)}</td><td>${n(d.newPremium)}</td><td>${n(d.report)}</td></tr>`).join("")}
      </tbody></table></div>
      <h3>Most started titles</h3>
      ${(x.top || []).length ? `<div class="tbl"><table class="atable"><thead><tr><th>Title</th><th>Starts</th><th>Completed</th><th>Errors</th></tr></thead><tbody>${x.top.map((t) => `<tr><td>${esc(name(t.id))}</td><td>${n(t.start)}</td><td>${n(t.complete)}</td><td>${n(t.error)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="small">No plays yet.</p>`}
      <h3>Latest playback problems</h3>
      ${(x.problems || []).length ? `<div class="tbl"><table class="atable"><thead><tr><th>When</th><th>Title</th><th>What</th><th>Device</th></tr></thead><tbody>${x.problems.map((p) => `<tr><td>${esc(new Date(p.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</td><td>${esc(name(p.titleId) || p.title)}${p.type === "report" ? " · reported" : ""}</td><td>${esc(p.message || p.code)}${p.message && p.code ? ` <span class="small">(${esc(p.code)})</span>` : ""}</td><td class="small">${esc((p.ua || "").replace(/^Mozilla\/5.0 /, "").slice(0, 70))}</td></tr>`).join("")}</tbody></table></div>` : `<p class="small">None reported.</p>`}`;
  }

  function titleList() {
    return `<div class="row"><button class="btn gold" data-anew data-nav>＋ Add a title</button><button class="btn ghost" data-astarter data-nav>Add the 20 Lifeofline films (Coming soon)</button></div>
      <div class="tbl"><table class="atable"><thead><tr><th></th><th>Title</th><th>Type</th><th>Language</th><th>Rating</th><th>Plan</th><th>Episodes</th><th>Status</th><th></th></tr></thead><tbody>
      ${A.titles.map((t) => `<tr><td><span class="mini" style="${posterStyle(t)}"></span></td><td><b>${esc(t.title)}</b>${t.original ? ` <span class="small">Original</span>` : ""}</td><td>${esc(KINDS[t.kind] || "")}</td><td>${esc(t.lang || "")}</td><td><span class="rating">${esc(t.rating || "")}</span></td>
        <td>${t.premium ? "Premium" : "Free"}</td><td>${t.episodeCount || 0}</td><td>${!t.published ? `<span class="small">Draft</span>` : t.comingSoon ? `<span class="small">Coming soon</span>` : `<span class="ok">Live</span>`}</td>
        <td><button class="btn sm ghost" data-aedit="${esc(t.id)}" data-nav>Edit</button></td></tr>`).join("") || `<tr><td colspan="9" class="small">No titles yet. Add the first one.</td></tr>`}
      </tbody></table></div>`;
  }

  function editor() {
    const t = A.editing; const isNew = !t.id;
    const opt = (list, v) => list.map((x) => `<option ${x === v ? "selected" : ""}>${esc(x)}</option>`).join("");
    return `<form id="tform" class="aform" novalidate>
      <div class="row"><button type="button" class="btn ghost sm" data-aback data-nav>‹ All titles</button><span class="spacer"></span>${isNew ? "" : `<button type="button" class="btn ghost sm danger" data-adel data-nav>Delete title</button>`}</div>
      <h2>${isNew ? "New title" : esc(t.title)}</h2>
      <div class="cols">
        <div class="col">
          <label class="f">Title<input id="f_title" required maxlength="80" value="${esc(t.title || "")}" data-nav></label>
          <div class="two"><label class="f">Type<select id="f_kind" data-nav>${Object.entries(KINDS).map(([k, l]) => `<option value="${k}" ${t.kind === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
            <label class="f">Screen<select id="f_format" data-nav><option value="h" ${t.format !== "v" ? "selected" : ""}>Horizontal 16:9</option><option value="v" ${t.format === "v" ? "selected" : ""}>Vertical 9:16</option></select></label></div>
          <div class="two"><label class="f">Language<select id="f_lang" data-nav>${opt(LANGS, t.lang || "Hindi")}</select></label>
            <label class="f">Age rating<select id="f_rating" data-nav>${opt(RATINGS, t.rating || "U/A 13+")}</select></label></div>
          <label class="f">Content descriptor (shown before playing)<input id="f_descriptor" maxlength="120" placeholder="e.g. Mild violence, strong language" value="${esc(t.descriptor || "")}" data-nav></label>
          <label class="f">Genre<input id="f_genre" maxlength="60" placeholder="e.g. Romance · Thriller" value="${esc(t.genre || "")}" data-nav></label>
          <label class="f">Tagline or one-line story (shown on cards and the banner)<textarea id="f_desc" rows="2" maxlength="200" data-nav>${esc(t.desc || "")}</textarea></label>
          <label class="f">Synopsis (the full story on the title page, 3–6 sentences)<textarea id="f_synopsis" rows="5" maxlength="1500" data-nav>${esc(t.synopsis || "")}</textarea></label>
          <div class="two"><label class="f">Director<input id="f_director" maxlength="100" value="${esc(t.director || "")}" data-nav></label>
            <label class="f">Release date (leave empty if not confirmed)<input id="f_release" type="date" value="${esc(t.releaseDate || "")}" data-nav></label></div>
          <div class="two"><label class="f">Audio languages<input id="f_audio" maxlength="100" placeholder="e.g. Hindi" value="${esc(t.audio || "")}" data-nav></label>
            <label class="f">Subtitles<input id="f_subs" maxlength="100" placeholder="e.g. English, Hindi" value="${esc(t.subtitles || "")}" data-nav></label></div>
          <div class="two"><label class="f">Cast (commas between names)<input id="f_cast" maxlength="300" value="${esc((t.cast || []).join(", "))}" data-nav></label>
            <label class="f">Year<input id="f_year" inputmode="numeric" maxlength="4" value="${esc(t.year || "")}" data-nav></label></div>
        </div>
        <div class="col">
          <div class="pprev ${t.format === "v" ? "v" : ""}" id="pprev" style="${posterStyle(t)}">${t.poster ? "" : `<div class="pt">${esc(t.title || "Poster")}</div>`}</div>
          <label class="f">Poster image (${t.format === "v" ? "9:16" : "2:3 portrait"})<input type="file" id="f_poster" accept="image/*" data-nav></label>
          <label class="f">Banner image for the top of Home (16:9 wide, no text near the left side)${t.banner ? " · uploaded" : ""}<input type="file" id="f_banner" accept="image/*" data-nav></label>
          <label class="check"><input type="checkbox" id="f_premium" ${t.premium !== false ? "checked" : ""} data-nav> In the ₹499 yearly Premium plan</label>
          <label class="f">Free episodes for free users (blank = default: short dramas 3, series 1, movies 0)<input id="f_freeEps" inputmode="numeric" maxlength="2" value="${t.freeEps ?? ""}" data-nav></label>
          <label class="check"><input type="checkbox" id="f_original" ${t.original ? "checked" : ""} data-nav> Lifeofline Original</label>
          <label class="f">Order on the home screen (lower shows first)<input id="f_order" inputmode="numeric" value="${t.order ?? ""}" data-nav></label>
          <label class="check"><input type="checkbox" id="f_published" ${t.published ? "checked" : ""} data-nav> Published (visible in the app)</label>
          <label class="check"><input type="checkbox" id="f_soon" ${t.comingSoon ? "checked" : ""} data-nav> Coming soon (shows the poster; can't be played yet)</label>
          <label class="check"><input type="checkbox" id="f_concept" ${t.concept ? "checked" : ""} data-nav> Concept showcase (fictional film, not scheduled; poster teaser only)</label>
          <p class="small">Test uploads: untick “Published” so only admins see them.</p>
          <div class="upl"><b>Trailer</b> <span class="small">${t.trailerUid ? "Uploaded" : "None"} · always free</span><input type="file" id="f_trailer" accept="video/*" data-nav><div class="bar" id="trbar" hidden><i></i></div></div>
        </div>
      </div>
      <p class="err" id="terr" hidden></p>
      <div class="row"><button class="btn gold" type="submit" data-nav>${isNew ? "Save and add episodes" : "Save changes"}</button></div>
    </form>
    ${isNew ? "" : episodesView()}`;
  }

  function episodesView() {
    const t = A.editing, movie = t.kind === "movie";
    return `<section class="aeps"><h2>${movie ? "The film" : "Episodes"}</h2>
      ${A.eps.map((e) => `<div class="aep" data-epid="${esc(e.id)}">
        <span class="n">${String(e.n).padStart(2, "0")}</span>
        <input class="epname" value="${esc(e.name || "")}" aria-label="Episode name" maxlength="80" data-nav>
        <select class="epfree" aria-label="Who can watch" data-nav><option value="" ${e.free == null ? "selected" : ""}>Default rule</option><option value="free" ${e.free === true ? "selected" : ""}>Free for everyone</option><option value="prem" ${e.free === false ? "selected" : ""}>Premium only</option></select>
        <span class="small vstat">${e.videoUid ? (e.duration ? "Ready · " + dur(e.duration) : "Processing…") : "No video"}</span>
        <button class="btn sm ghost" data-epsave data-nav>Save</button><button class="btn sm ghost" data-epcheck data-nav>Check video</button><button class="btn sm ghost danger" data-epdel data-nav>Delete</button>
      </div>`).join("") || `<p class="small">No ${movie ? "video" : "episodes"} yet.</p>`}
      ${movie && A.eps.length ? "" : `<div class="aep new"><span class="n">${String((A.eps.at(-1)?.n || 0) + 1).padStart(2, "0")}</span>
        <input id="nep_name" placeholder="${movie ? "Full movie" : "Episode name (optional)"}" maxlength="80" data-nav>
        <input type="file" id="nep_file" accept="video/*" data-nav>
        <button class="btn sm gold" data-epadd data-nav>Upload ${movie ? "the film" : "episode"}</button>
        <div class="bar" id="nepbar" hidden><i></i></div></div>`}
      <p class="small">Videos go straight to Cloudflare Stream. Keep this page open until the bar is full; a dropped connection resumes when you upload the same file again. After upload, Cloudflare needs a few minutes to prepare the video: press “Check video” to see when it's ready.</p>
    </section>`;
  }

  function adsView() {
    return `<p class="small">Free-plan viewers see one of these before each title (and halfway through titles over 10 minutes). With no ads here, the slot shows a “Go ad-free for ₹499 a year” message.</p>
      <div class="cards">${A.ads.map((a) => `<div class="card"><div class="adprev" style="${a.imageUrl ? `background:#000 url('${esc(a.imageUrl)}') center/contain no-repeat` : ""}">${a.imageUrl ? "" : esc(a.title || "")}</div>
        <div class="kv"><span>${esc(a.title || "Ad")}</span><span>${a.active ? `<span class="ok">Running</span>` : "Paused"}</span></div><div class="kv"><span>Length</span><span>${a.seconds || 6}s</span></div>
        <div class="row"><button class="btn sm ghost" data-adtog="${esc(a.id)}" data-nav>${a.active ? "Pause" : "Run"}</button><button class="btn sm ghost danger" data-addel="${esc(a.id)}" data-nav>Delete</button></div></div>`).join("")}</div>
      <form id="adform" class="aform card" novalidate><h3>New ad</h3>
        <label class="f">Advertiser / ad name<input id="ad_title" required maxlength="80" data-nav></label>
        <label class="f">Image (16:9 works best)<input type="file" id="ad_img" accept="image/*" data-nav></label>
        <div class="two"><label class="f">Link (optional)<input id="ad_link" type="url" placeholder="https://" data-nav></label><label class="f">Button words<input id="ad_cta" maxlength="24" placeholder="Learn more" data-nav></label></div>
        <label class="f">Seconds on screen (5–30)<input id="ad_sec" inputmode="numeric" value="8" data-nav></label>
        <p class="err" id="aderr" hidden></p><button class="btn gold" type="submit" data-nav>Add ad</button></form>`;
  }

  function giftView() {
    return `<form id="giftform" class="aform card" novalidate><h3>Give free Premium</h3><p class="small">For cast, crew, partners and testers. They must have signed up first. It doesn't renew.</p>
      <label class="f">Their email<input id="g_email" type="email" required data-nav></label><label class="f">Days<input id="g_days" inputmode="numeric" value="30" data-nav></label>
      <p class="err" id="gerr2" hidden></p><button class="btn gold" type="submit" data-nav>Give Premium</button></form>`;
  }

  /* ---------- helpers ---------- */
  const fail = (id, m) => { const p = $("#" + id); if (p) { p.textContent = m; p.hidden = false; } else toast(m, 4000); };
  const progressBar = (id) => { const b = $("#" + id); if (b) b.hidden = false; return (pct) => { const i = $("#" + id + " i"); if (i) i.style.width = pct + "%"; }; };
  const guardLeave = (e) => { if (A.busy) { e.preventDefault(); e.returnValue = ""; } };
  window.addEventListener("beforeunload", guardLeave);

  async function openTitle(id) {
    A.editing = id ? { ...withStarter(await api.title(id)) } : { kind: "short", format: "v", premium: true, published: false, hue: hues(Date.now()) };
    A.eps = id ? await api.episodes(id) : [];
    render(); window.scrollTo(0, 0);
  }

  function readForm() {
    const v = (id) => $("#f_" + id)?.value.trim() ?? "";
    const t = A.editing;
    const num = (s) => (s === "" ? null : Math.max(0, Math.round(Number(s) || 0)));
    return {
      ...(t.id ? { id: t.id } : {}), title: v("title"), kind: v("kind"), format: v("format"), lang: v("lang"), rating: v("rating"),
      descriptor: v("descriptor"), genre: v("genre"), desc: v("desc"), cast: v("cast").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20),
      year: v("year"), premium: $("#f_premium").checked, original: $("#f_original").checked, published: $("#f_published").checked,
      comingSoon: $("#f_soon").checked, concept: $("#f_concept").checked,
      synopsis: v("synopsis"), director: v("director"), releaseDate: v("release"), audio: v("audio"), subtitles: v("subs"), banner: t.banner || "",
      freeEps: num(v("freeEps")), order: num(v("order")) ?? 99, poster: t.poster || "", trailerUid: t.trailerUid || "", hue: t.hue || hues(v("title")),
    };
  }

  root.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.sopen != null) { SUP.sel = b.dataset.sopen; SUP.msgs = null; SUP.stop?.(); SUP.stop = api.watchSupportMsgs(SUP.sel, (l) => { SUP.msgs = l; if (A.tab === "support") { $("#abody").innerHTML = supportView(); const m = $("#supm"); if (m) m.scrollTop = m.scrollHeight; } }); api.supportMarkRead(SUP.sel); return render(); }
    if (b.dataset.sback != null) { SUP.sel = ""; SUP.stop?.(); SUP.stop = null; return render(); }
    if (b.dataset.squick != null) { const t = $("#supin"); t.value = b.dataset.squick; t.focus(); return; }
    if (b.dataset.ssolve != null) { await api.supportStatus(SUP.sel, b.dataset.ssolve); toast(b.dataset.ssolve === "solved" ? "Marked solved" : "Reopened"); return; }
    if (b.dataset.ssend != null) { const t = $("#supin"); const text = t.value.trim(); if (!text) return; b.disabled = true; try { await api.supportReply(SUP.sel, text, "Helpdesk"); t.value = ""; } catch (er) { toast(er.message); } b.disabled = false; return; }
    if (b.dataset.atab) { A.tab = b.dataset.atab; A.editing = null; if (A.tab === "ads") A.ads = await api.allAds(); return render(); }
    if (b.hasAttribute("data-anew")) return openTitle(null);
    if (b.hasAttribute("data-astarter")) {
      b.disabled = true;
      try { const n = await window.__addStarterTitles({ force: true }); toast(n ? `Added ${n} films as Coming soon` : "All 20 films are already here"); await reload(); return refresh(); }
      catch (er) { toast(er.message, 5000); b.disabled = false; }
      return;
    }
    if (b.dataset.aedit) return openTitle(b.dataset.aedit);
    if (b.hasAttribute("data-aback")) { A.editing = null; return refresh(); }
    if (b.hasAttribute("data-adel")) {
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Press again to delete"; return; }
      await api.deleteTitle(A.editing.id); toast("Title deleted"); A.editing = null; await reload(); return refresh();
    }
    const row = b.closest(".aep");
    if (b.hasAttribute("data-epadd")) {
      const file = $("#nep_file").files[0]; if (!file) return toast("Choose the video file first.");
      const n = (A.eps.at(-1)?.n || 0) + 1, name = $("#nep_name").value.trim() || (A.editing.kind === "movie" ? A.editing.title : `Episode ${n}`);
      b.disabled = true; A.busy = true;
      try {
        const set = progressBar("nepbar");
        const uid = await api.uploadVideo(file, set);
        await api.saveEpisode(A.editing.id, { n, name, videoUid: uid, duration: 0 });
        toast("Uploaded. Cloudflare is preparing it."); A.eps = await api.episodes(A.editing.id); render();
      } catch (er) { toast(er.message, 6000); b.disabled = false; } finally { A.busy = false; }
      return;
    }
    if (row && b.hasAttribute("data-epsave")) {
      const fv = $(".epfree", row).value;
      await api.saveEpisode(A.editing.id, { id: row.dataset.epid, name: $(".epname", row).value.trim(), free: fv === "free" ? true : fv === "prem" ? false : null });
      return toast("Episode saved");
    }
    if (row && b.hasAttribute("data-epcheck")) {
      const ep = A.eps.find((x) => x.id === row.dataset.epid); if (!ep?.videoUid) return toast("No video uploaded for this one.");
      try {
        const s = await api.videoStatus(ep.videoUid);
        if (s.ready) { await api.saveEpisode(A.editing.id, { id: ep.id, duration: s.duration || ep.duration || 0 }); ep.duration = s.duration || ep.duration || 1; $(".vstat", row).textContent = "Ready" + (s.duration ? " · " + dur(s.duration) : ""); toast("Ready to play"); }
        else $(".vstat", row).textContent = `Processing ${Math.round(s.pct || 0)}%`;
      } catch (er) { toast(er.message); }
      return;
    }
    if (row && b.hasAttribute("data-epdel")) {
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Sure?"; return; }
      await api.deleteEpisode(A.editing.id, row.dataset.epid); A.eps = await api.episodes(A.editing.id); return render();
    }
    if (b.dataset.adtog) { const a = A.ads.find((x) => x.id === b.dataset.adtog); await api.saveAd({ id: a.id, active: !a.active }); A.ads = await api.allAds(); return render(); }
    if (b.dataset.addel) { await api.deleteAd(b.dataset.addel); A.ads = await api.allAds(); return render(); }
  });

  root.addEventListener("change", async (e) => {
    if (e.target.id === "f_banner" && e.target.files[0]) {
      try { toast("Uploading banner…"); A.editing.banner = await api.uploadImage(e.target.files[0], { wide: true }); toast("Banner ready. Save to keep it."); }
      catch (er) { toast(er.message, 4000); }
    }
    if (e.target.id === "f_poster" && e.target.files[0]) {
      try { toast("Uploading poster…"); A.editing.poster = await api.uploadImage(e.target.files[0]); const p = $("#pprev"); p.setAttribute("style", posterStyle(A.editing)); p.innerHTML = ""; toast("Poster ready. Save to keep it."); }
      catch (er) { toast(er.message, 4000); }
    }
    if (e.target.id === "f_trailer" && e.target.files[0]) {
      A.busy = true;
      try { const set = progressBar("trbar"); A.editing.trailerUid = await api.uploadVideo(e.target.files[0], set); toast("Trailer uploaded. Save to keep it."); }
      catch (er) { toast(er.message, 6000); } finally { A.busy = false; }
    }
    if (e.target.id === "f_kind") { const f = $("#f_format"); if (f) f.value = e.target.value === "short" ? "v" : "h"; }
  });

  root.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, btn = $("button[type=submit]", f);
    if (f.id === "tform") {
      const d = readForm();
      if (!d.title) return fail("terr", "Add a title.");
      if (d.published && !d.desc) return fail("terr", "Add a short story line before publishing.");
      btn.disabled = true;
      try { const id = await api.saveTitle(d); toast("Saved"); await reload(); await openTitle(id); }
      catch (er) { fail("terr", er.message); btn.disabled = false; }
    }
    if (f.id === "adform") {
      const file = $("#ad_img").files[0], title = $("#ad_title").value.trim();
      if (!title) return fail("aderr", "Name the ad.");
      btn.disabled = true;
      try {
        const imageUrl = file ? await api.uploadImage(file) : "";
        await api.saveAd({ title, imageUrl, link: $("#ad_link").value.trim(), cta: $("#ad_cta").value.trim(), seconds: Math.min(30, Math.max(5, Number($("#ad_sec").value) || 8)), active: true });
        A.ads = await api.allAds(); toast("Ad added"); render();
      } catch (er) { fail("aderr", er.message); btn.disabled = false; }
    }
    if (f.id === "giftform") {
      btn.disabled = true;
      try { const r = await api.grant($("#g_email").value.trim(), Number($("#g_days").value) || 30); toast(`${r.email} has Premium till ${new Date(r.until).toLocaleDateString("en-IN")}`, 4000); f.reset(); }
      catch (er) { fail("gerr2", er.message); } finally { btn.disabled = false; }
    }
  });

  await refresh();
}
