// Cloudflare Stream: uploads from the admin page, and short-lived signed links for playback.
// Every video is uploaded with "require signed URLs", so a link only works for the person the server gave it to,
// and only for a few hours. Links are signed here with a key made once through Cloudflare's API (no per-play API call).
//
// Without CF_ACCOUNT_ID / CF_STREAM_TOKEN the service runs in TEST MODE: uploads are skipped and every title
// plays a public sample stream, so the whole app can be tried before Cloudflare is set up.
const crypto = require("crypto");

const SAMPLE_HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"; // public test stream used in test mode
const LINK_HOURS = 6;

module.exports = function makeStream({ db, env }) {
  const ACC = env.CF_ACCOUNT_ID || "", TOKEN = env.CF_STREAM_TOKEN || "";
  const LIVE = !!(ACC && TOKEN);
  const HOST = env.CF_STREAM_CUSTOMER_CODE ? `https://customer-${env.CF_STREAM_CUSTOMER_CODE}.cloudflarestream.com` : "https://videodelivery.net";
  const api = `https://api.cloudflare.com/client/v4/accounts/${ACC}/stream`;
  const show = (msg, code = 400) => Object.assign(new Error(msg), { show: true, status: code });
  const b64 = (s) => Buffer.from(String(s)).toString("base64");
  const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

  async function cf(method, path, body, headers = {}) {
    const res = await fetch(api + path, { method, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) { console.error("Cloudflare", method, path, res.status, JSON.stringify(data.errors || data)); throw show("The video service refused this. Check the Cloudflare settings on Render.", 502); }
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
    const meta = [`name ${b64(String(name || "video").slice(0, 120))}`, "requiresignedurls", `maxdurationseconds ${b64(6 * 3600)}`].join(",");
    const res = await fetch(`${api}?direct_user=true`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Tus-Resumable": "1.0.0", "Upload-Length": String(size), "Upload-Metadata": meta } });
    if (res.status !== 201) { console.error("Cloudflare tus", res.status, await res.text().catch(() => "")); throw show("Cloudflare didn't accept the upload. Check the Cloudflare settings on Render.", 502); }
    return { uploadUrl: res.headers.get("location"), uid: res.headers.get("stream-media-id") };
  }

  // Admin page: is the video ready to play yet?
  async function status(uid) {
    if (!LIVE || String(uid).startsWith("test_")) return { ready: true, duration: 0, state: "ready", pct: 100, test: true };
    if (!/^[a-f0-9]{32}$/.test(String(uid))) throw show("That isn't a Cloudflare video id.");
    const v = await cf("GET", "/" + uid);
    return { ready: !!v.readyToStream, duration: Math.round(v.duration || 0), state: v.status?.state || "", pct: Number(v.status?.pctComplete || 0) };
  }

  return { LIVE, playUrl, uploadUrl, status, sign, SAMPLE_HLS };
};
