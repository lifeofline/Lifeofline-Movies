// Cloudflare Stream: uploads from the admin page, and short-lived signed links for playback.
// Every video is uploaded with "require signed URLs", so a link only works for the person the server gave it to,
// and only for a few hours. Links are signed here with a key made once through Cloudflare's API (no per-play API call).
//
// Without CF_ACCOUNT_ID / CF_STREAM_TOKEN the service runs in TEST MODE: uploads are skipped and every title
// plays a public sample stream, so the whole app can be tried before Cloudflare is set up.
const crypto = require("crypto");

const SAMPLE_HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"; // public test stream used in test mode
const LINK_HOURS = 6;
// Videos only play on our own site: Cloudflare refuses requests coming from any other web page.
// STREAM_ORIGINS on Render can change the list ("off" turns the lock off).
const DEFAULT_ORIGINS = ["movies.lifeofline.com", "lifeofline-movies.onrender.com"];

module.exports = function makeStream({ db, env }) {
  const clean = (v) => String(v || "").trim().replace(/^["']|["']$/g, ""); // pasted values often carry spaces or quotes
  const ACC = clean(env.CF_ACCOUNT_ID), TOKEN = clean(env.CF_STREAM_TOKEN), CODE = clean(env.CF_STREAM_CUSTOMER_CODE).replace(/^customer-/, "").replace(/\.cloudflarestream\.com.*$/, "");
  const LIVE = !!(ACC && TOKEN);
  const ORIGINS = clean(env.STREAM_ORIGINS).toLowerCase() === "off" ? [] : clean(env.STREAM_ORIGINS) ? clean(env.STREAM_ORIGINS).split(/[,\s]+/).filter(Boolean) : DEFAULT_ORIGINS;
  const HOST = CODE ? `https://customer-${CODE}.cloudflarestream.com` : "https://videodelivery.net";
  const api = `https://api.cloudflare.com/client/v4/accounts/${ACC}/stream`;
  const show = (msg, code = 400) => Object.assign(new Error(msg), { show: true, status: code });
  const b64 = (s) => Buffer.from(String(s)).toString("base64");
  const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

  // Turns Cloudflare's answer into a message an admin can act on.
  function why(status, text) {
    let msg = ""; try { const j = JSON.parse(text); msg = (j.errors || []).map((e) => e.message).join("; "); } catch { msg = String(text || "").slice(0, 200); }
    const hint = status === 401 || status === 403 || /auth|token|permission/i.test(msg) ? " Check CF_STREAM_TOKEN on Render: it needs the permission Account → Stream → Edit."
      : status === 404 || /account/i.test(msg) ? " Check CF_ACCOUNT_ID on Render."
      : /subscription|plan|quota|storage|limit/i.test(msg) ? " Check that your Cloudflare Stream subscription is active and has storage left."
      : "";
    return show(`Cloudflare refused the request (${status}${msg ? ": " + msg : ""}).${hint}`, 400);
  }
  async function net(url, opts) {
    try { return await fetch(url, opts); }
    catch (e) { console.error("Cloudflare network", e.message, e.cause?.message || ""); throw show("Couldn't reach Cloudflare: " + (e.cause?.message || e.message) + ". Check CF_ACCOUNT_ID and CF_STREAM_TOKEN on Render.", 400); }
  }
  async function cf(method, path, body, headers = {}) {
    const res = await net(api + path, { method, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data = {}; try { data = JSON.parse(text); } catch { /* not JSON */ }
    if (!res.ok || data.success === false) { console.error("Cloudflare", method, path, res.status, text.slice(0, 500)); throw why(res.status, text); }
    return data.result;
  }

  // The signing key is created once and kept in Firestore (server-only collection).
  let keyCache = null;
  async function signingKey() {
    if (keyCache) return keyCache;
    const ref = db.doc("server/streamKey");
    const snap = await ref.get();
    if (snap.exists) return (keyCache = snap.data());
    const r = await cf("POST", "/keys");
    keyCache = { id: r.id, pem: Buffer.from(r.pem, "base64").toString("utf8"), createdAt: Date.now() };
    await ref.set(keyCache);
    return keyCache;
  }

  function sign(videoUid, key, hours = LINK_HOURS) {
    const head = b64url(JSON.stringify({ alg: "RS256", kid: key.id }));
    const body = b64url(JSON.stringify({ sub: videoUid, kid: key.id, exp: Math.floor(Date.now() / 1000) + hours * 3600 }));
    const sig = crypto.createSign("RSA-SHA256").update(`${head}.${body}`).sign(key.pem);
    return `${head}.${body}.${b64url(sig)}`;
  }

  // Returns the link the player opens. In test mode, a public sample stream.
  async function playUrl(videoUid) {
    if (!LIVE || !videoUid || videoUid.startsWith("test_")) return { hls: SAMPLE_HLS, poster: "", test: true };
    const token = sign(videoUid, await signingKey());
    return { hls: `${HOST}/${token}/manifest/video.m3u8`, poster: `${HOST}/${token}/thumbnails/thumbnail.jpg?time=8s&height=720`, test: false };
  }

  // Admin page: make a resumable (tus) upload the browser sends the file to directly. Large films are fine.
  async function uploadUrl({ size, name }) {
    size = Math.round(Number(size) || 0);
    if (size <= 0 || size > 30 * 1024 ** 3) throw show("Pick a video file under 30 GB.");
    if (!LIVE) return { test: true, uid: "test_" + crypto.randomBytes(6).toString("hex") };
    const meta = [`name ${b64(String(name || "video").slice(0, 120))}`, "requiresignedurls", `maxdurationseconds ${b64(6 * 3600)}`, ...(ORIGINS.length ? [`allowedorigins ${b64(ORIGINS.join(","))}`] : [])].join(",");
    const res = await net(`${api}?direct_user=true`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Tus-Resumable": "1.0.0", "Upload-Length": String(size), "Upload-Metadata": meta } });
    if (res.status !== 201) { const text = await res.text().catch(() => ""); console.error("Cloudflare tus", res.status, text.slice(0, 500)); throw why(res.status, text); }
    const uploadUrl = res.headers.get("location"), uid = res.headers.get("stream-media-id");
    if (!uploadUrl || !uid) { console.error("Cloudflare tus: missing headers", [...res.headers.keys()].join(",")); throw show("Cloudflare accepted the upload but didn't return an upload address. Try again.", 400); }
    return { uploadUrl, uid };
  }

  // Admin page: a teaser (short silent preview that loops on posters and the home banner). Teasers are promotion, so they
  // don't need signed links, but they still only play on our own site. Served as a plain MP4 so they autoplay without a player.
  async function teaserUpload({ size, name }) {
    size = Math.round(Number(size) || 0);
    if (size <= 0 || size > 300 * 1024 ** 2) throw show("Pick a teaser video under 300 MB (5 to 30 seconds is ideal).");
    if (!LIVE) return { test: true, uid: "test_" + crypto.randomBytes(6).toString("hex") };
    const meta = [`name ${b64("Teaser · " + String(name || "teaser").slice(0, 100))}`, `maxdurationseconds ${b64(120)}`, ...(ORIGINS.length ? [`allowedorigins ${b64(ORIGINS.join(","))}`] : [])].join(",");
    const res = await net(`${api}?direct_user=true`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Tus-Resumable": "1.0.0", "Upload-Length": String(size), "Upload-Metadata": meta } });
    if (res.status !== 201) { const text = await res.text().catch(() => ""); console.error("Cloudflare tus teaser", res.status, text.slice(0, 500)); throw why(res.status, text); }
    const uploadUrl = res.headers.get("location"), uid = res.headers.get("stream-media-id");
    if (!uploadUrl || !uid) throw show("Cloudflare accepted the upload but didn't return an upload address. Try again.", 400);
    return { uploadUrl, uid };
  }
  // After the upload: once Cloudflare has processed it, make the MP4 and return its address (call again until ready).
  async function teaserReady(uid) {
    if (!LIVE || String(uid).startsWith("test_")) return { ready: true, url: "teasers/01-sarhad.mp4", test: true };
    if (!/^[a-f0-9]{32}$/.test(String(uid))) throw show("That isn't a Cloudflare video id.");
    const v = await cf("GET", "/" + uid);
    if (!v.readyToStream) return { ready: false, stage: "processing", pct: Number(v.status?.pctComplete || 0) };
    if ((v.duration || 0) > 60) throw show(`This teaser is ${Math.round(v.duration)} seconds long. Teasers loop on posters, so keep them under 60 seconds (5 to 30 is best).`);
    const d = (await cf("POST", "/" + uid + "/downloads"))?.default || {};
    if (d.status !== "ready") return { ready: false, stage: "mp4", pct: Number(d.percentComplete || 0) };
    return { ready: true, url: d.url || `${HOST}/${uid}/downloads/default.mp4`, duration: Math.round(v.duration || 0) };
  }

  // Admin → Numbers: minutes stored against the plan, minutes watched this month and a cost estimate.
  // Prices: $5 a month per 1,000 minutes stored (bought in blocks), $1 per 1,000 minutes delivered.
  async function usage() {
    if (!LIVE) return { test: true };
    const s = await cf("GET", "/storage-usage");
    const now = new Date(), start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const iso = (d) => d.toISOString().slice(0, 10);
    let viewed = null, viewedErr = "";
    try {
      const q = `query($a: string!, $s: Date, $e: Date) { viewer { accounts(filter: { accountTag: $a }) { streamMinutesViewedAdaptiveGroups(filter: { date_geq: $s, date_lt: $e }, limit: 1) { sum { minutesViewed } } } } }`;
      const res = await net("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: q, variables: { a: ACC, s: iso(start), e: iso(next) } }) });
      const j = await res.json().catch(() => ({}));
      if (j.errors?.length) throw new Error(j.errors.map((e) => e.message).join("; "));
      viewed = Number(j.data?.viewer?.accounts?.[0]?.streamMinutesViewedAdaptiveGroups?.[0]?.sum?.minutesViewed || 0);
    } catch (e) { viewedErr = /auth|permission|not authorized|access/i.test(e.message) ? "Add the permission Account → Account Analytics → Read to CF_STREAM_TOKEN in Cloudflare to see minutes watched." : "Minutes watched aren't available right now (" + String(e.message).slice(0, 120) + ")."; }
    const daysIn = Math.round((next - start) / 864e5), dayNow = Math.max(1, (now - start) / 864e5);
    const stored = Math.round(s.totalStorageMinutes || 0), limit = Math.round(s.totalStorageMinutesLimit || 0);
    const storageUsd = (Math.ceil(Math.max(limit, stored) / 1000) || 0) * 5;
    const projected = viewed == null ? null : Math.round((viewed / dayNow) * daysIn);
    return { stored, limit, videos: s.videoCount || 0, viewed, viewedErr, projected, month: iso(start).slice(0, 7), storageUsd,
      watchUsd: viewed == null ? null : +(viewed / 1000).toFixed(2), projectedUsd: projected == null ? null : +(storageUsd + projected / 1000).toFixed(2) };
  }

  // Admin page: is the video ready to play yet?
  async function status(uid) {
    if (!LIVE || String(uid).startsWith("test_")) return { ready: true, duration: 0, state: "ready", pct: 100, test: true };
    if (!/^[a-f0-9]{32}$/.test(String(uid))) throw show("That isn't a Cloudflare video id.");
    const v = await cf("GET", "/" + uid);
    return { ready: !!v.readyToStream, duration: Math.round(v.duration || 0), state: v.status?.state || "", pct: Number(v.status?.pctComplete || 0) };
  }

  // Locks a video: signed links only, and only playable from our own site. Safe to call again.
  async function protect(uid) {
    if (!LIVE || String(uid).startsWith("test_")) return true;
    await cf("POST", "/" + uid, { uid, requireSignedURLs: true, allowedOrigins: ORIGINS });
    return true;
  }

  // Makes a separate short preview video (the first `secs` seconds). Viewers without the plan only ever get a link
  // to this clip, never to the full video, so the paywall can't be skipped by changing the time or the link.
  async function previewClip(uid, secs) {
    if (!LIVE || String(uid).startsWith("test_")) return uid;
    const r = await cf("POST", "/clip", { clippedFromVideoUID: uid, startTimeSeconds: 0, endTimeSeconds: secs, requireSignedURLs: true, allowedOrigins: ORIGINS });
    return r.uid;
  }

  return { LIVE, playUrl, uploadUrl, status, sign, protect, previewClip, teaserUpload, teaserReady, usage, SAMPLE_HLS };
};
