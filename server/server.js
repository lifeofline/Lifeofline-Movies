// lifeofline-movies-api — the small server on Render behind Lifeofline Movies.
// It decides who may play what, hands out short-lived video links (Cloudflare Stream), takes the ₹99 Premium
// payment (Razorpay), lets admins upload videos, and sends emails through Brevo.
// Everything else (catalogue, watch progress, My List) the app reads and writes in Firestore directly.
//
// Routes
//   GET  /health                      wake-up + which services are live
//   POST /play     {titleId, epId?, trailer?}   → {hls, ads, …}  (sign-in optional: free titles play for guests)
//   POST /sub      {action: status|start|verify|cancel}            (signed in)
//   POST /me       {action: setDob|claimAdmin}                      (signed in)
//   POST /admin    {action: upload|video|grant|stats}               (admins)
//   POST /pay/webhook                  Razorpay webhook
const http = require("http");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const makeStream = require("./stream.js");
const makeBilling = require("./billing.js");

const env = process.env;
const PORT = env.PORT || 10000;
const APP_URL = (env.APP_URL || "").replace(/\/$/, "");
const ID = /^[A-Za-z0-9_-]{1,128}$/;

let serviceAccount;
try { serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || ""); }
catch { console.error("FIREBASE_SERVICE_ACCOUNT is missing or isn't valid JSON. Paste the whole key file into it on Render."); process.exit(1); }
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();

/* ---------- email (Brevo, same as ArtistCart) ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const link = (path) => `${APP_URL}/#${path}`;

async function brevo(to, subject, text, html) {
  if (!env.BREVO_API_KEY || !env.MAIL_FROM_EMAIL) { console.warn("Email skipped: BREVO_API_KEY or MAIL_FROM_EMAIL not set"); return; }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { email: env.MAIL_FROM_EMAIL, name: env.MAIL_FROM_NAME || "Lifeofline Movies" }, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
  });
  if (!res.ok) console.error("Brevo error", res.status, await res.text().catch(() => ""));
}

async function sendEmail(uid, subject, lines, cta) {
  let user; try { user = await auth.getUser(uid); } catch { return false; }
  if (!user.email) return false;
  const name = (await db.doc(`users/${uid}`).get()).data()?.name || user.displayName || "there";
  const text = [`Hi ${name},`, "", ...lines, "", cta ? `${cta.label}: ${cta.url}` : "", "", "— Lifeofline Movies, a Lifeofline Pvt Ltd service"].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#140f1c;max-width:520px">
    <div style="background:#140f1c;color:#f4ad3d;font-weight:800;font-size:20px;padding:12px 16px">lifeofline <span style="font-size:12px;letter-spacing:2px">MOVIES</span></div>
    <div style="padding:16px"><p>Hi ${esc(name)},</p>${lines.map((l) => `<p>${esc(l)}</p>`).join("")}
    ${cta ? `<p><a href="${esc(cta.url)}" style="display:inline-block;background:#f4ad3d;color:#2a1a02;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">${esc(cta.label)}</a></p>` : ""}
    <p style="color:#777;font-size:12px">Lifeofline Movies is run by Lifeofline Pvt Ltd.</p></div></div>`;
  await brevo(user.email, subject, text, html);
  return true;
}

const stream = makeStream({ db, env });
const billing = makeBilling({ db, FieldValue, env, sendEmail, link });

/* ---------- who may play what ---------- */
// Same rule the app uses to label episodes (public/access.js). Keep the two in step.
function freeEpisode(title, ep) {
  if (!title.premium) return true;
  if (ep.free === true) return true;
  if (ep.free === false) return false;
  if (title.kind === "short") return ep.n <= (title.freeEps ?? 3);
  if (title.kind === "series") return ep.n <= (title.freeEps ?? 1);
  return false;
}
const show = (msg, status = 400, extra = {}) => Object.assign(new Error(msg), { show: true, status, extra });

async function play(uid, { titleId, epId, trailer }) {
  if (!ID.test(String(titleId || "")) || (epId != null && !ID.test(String(epId)))) throw show("bad request");
  const tSnap = await db.doc(`titles/${titleId}`).get();
  const t = tSnap.data();
  const admin = uid ? (await db.doc(`admins/${uid}`).get()).exists : false;
  if (!t || (!t.published && !admin)) throw show("This title isn't available.", 404);
  const premium = await billing.isPremium(uid);
  const base = { ads: !premium, premium, rating: t.rating || "U", title: t.title || "", format: t.format || "h" };

  if (trailer) {
    if (!t.trailerUid) throw show("No trailer for this title yet.", 404);
    return { ...base, ads: false, ...(await stream.playUrl(t.trailerUid)) };
  }
  if (t.rating === "A") {
    if (!uid) throw show("Sign in to watch titles rated A (18+).", 401, { needSignIn: true });
    if (!(await db.doc(`users/${uid}`).get()).data()?.adult) throw show("Titles rated A are for viewers aged 18 and over. Add your date of birth in Account.", 403, { needAge: true });
  }
  const eSnap = epId ? await db.doc(`titles/${titleId}/episodes/${epId}`).get()
    : (await db.collection(`titles/${titleId}/episodes`).orderBy("n").limit(1).get()).docs[0];
  const ep = eSnap?.data();
  if (!ep || !ep.videoUid) throw show("This episode isn't uploaded yet.", 404);
  if (!freeEpisode(t, ep) && !premium && !admin) throw show(`This is in the ₹${billing.PRICE} Premium plan.`, 402, { needPlan: true });
  return { ...base, ads: base.ads && !admin, epId: eSnap.id, n: ep.n, name: ep.name || "", duration: ep.duration || 0, ...(await stream.playUrl(ep.videoUid)) };
}

/* ---------- the signed-in person ---------- */
async function me(uid, body) {
  const { action } = body || {};
  if (action === "setDob") {
    const dob = String(body.dob || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || isNaN(Date.parse(dob))) throw show("Enter your date of birth.");
    const priv = db.doc(`users/${uid}/private/age`);
    if ((await priv.get()).exists) throw show("Your date of birth is already saved. Write to support to change it.");
    const d = new Date(dob + "T00:00:00+05:30"), n = new Date();
    let age = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) age--;
    if (age < 5 || age > 110) throw show("Check the date of birth.");
    await priv.set({ dob, at: Date.now() });
    await db.doc(`users/${uid}`).set({ adult: age >= 18 }, { merge: true });
    return { adult: age >= 18 };
  }
  // First admin: the email(s) in ADMIN_EMAILS on Render can make themselves admin once signed in.
  if (action === "claimAdmin") {
    const u = await auth.getUser(uid);
    const allowed = String(env.ADMIN_EMAILS || "").toLowerCase().split(/[,\s]+/).filter(Boolean);
    if (!u.email || !allowed.includes(u.email.toLowerCase())) throw show("This account isn't on the admin list.", 403);
    if (!u.emailVerified) throw show("Verify your email first: open the link we emailed you, then try again.", 403);
    await db.doc(`admins/${uid}`).set({ email: u.email, at: Date.now() });
    return { admin: true };
  }
  throw show("bad request");
}

/* ---------- admins ---------- */
async function admin(uid, body) {
  if (!(await db.doc(`admins/${uid}`).get()).exists) throw show("Admins only", 403);
  const { action } = body || {};
  if (action === "upload") return stream.uploadUrl(body);
  if (action === "video") return stream.status(String(body.uid || ""));
  if (action === "grant") { // give someone free Premium (cast, crew, testers)
    const days = Math.min(366, Math.max(1, Math.round(Number(body.days) || 30)));
    let u; try { u = await auth.getUserByEmail(String(body.email || "").trim()); } catch { throw show("No account uses that email. Ask them to sign up first.", 404); }
    const until = await billing.grant(u.uid, { mode: "gift", days });
    await db.collection("adminLog").add({ by: uid, action: "grant", uid: u.uid, days, at: FieldValue.serverTimestamp() });
    return { until, email: u.email };
  }
  if (action === "stats") {
    const t = Date.now();
    const [subs, titles, users] = await Promise.all([
      db.collection("subs").where("until", ">", t).count().get(),
      db.collection("titles").count().get(),
      db.collection("users").count().get(),
    ]);
    return { premium: subs.data().count, titles: titles.data().count, users: users.data().count, billing: billing.MODE, video: stream.LIVE ? "live" : "test" };
  }
  throw show("bad request");
}

/* ---------- web server ---------- */
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" };
function reply(res, code, body) {
  if (code >= 502 && code <= 504) code = 500; res.writeHead(code, { ...cors, "Content-Type": "application/json" }); res.end(JSON.stringify(body)); }
let lastHourly = 0;
const hourly = () => { if (Date.now() - lastHourly < 36e5) return; lastHourly = Date.now(); billing.hourly(); };

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  if (req.method === "GET" && (req.url === "/health" || req.url === "/")) { hourly(); return reply(res, 200, { ok: true, billing: billing.MODE, video: stream.LIVE ? "live" : "test", price: billing.PRICE }); }
  const routes = ["/play", "/sub", "/me", "/admin", "/pay/webhook"];
  if (req.method !== "POST" || !routes.includes(req.url)) return reply(res, 404, { error: "not found" });
  let raw = "";
  const cap = req.url === "/pay/webhook" ? 200000 : 5000;
  req.on("data", (c) => { raw += c; if (raw.length > cap) req.destroy(); });
  req.on("end", async () => {
    try {
      if (req.url === "/pay/webhook") { const r = await billing.webhook(raw, String(req.headers["x-razorpay-signature"] || "")); return reply(res, r.status, r.body); }
      const body = JSON.parse(raw || "{}");
      const token = (req.headers.authorization || "").replace(/^Bearer /, "");
      let uid = null;
      if (token) uid = (await auth.verifyIdToken(token)).uid;
      if (req.url === "/play") return reply(res, 200, { result: await play(uid, body) });
      if (!uid) return reply(res, 401, { error: "Sign in first." });
      if (req.url === "/sub") {
        try { const r = await billing.handle(uid, body); return reply(res, r.status, r.body); }
        catch (e) { if (e.show) throw e; console.error("sub", body?.action, e); return reply(res, 400, { error: "Payment step failed: " + (e.message || "unknown error") + ". Try again, or write to us if money was taken." }); }
      }
      if (req.url === "/me") return reply(res, 200, { result: await me(uid, body) });
      if (req.url === "/admin") {
        try { return reply(res, 200, { result: await admin(uid, body) }); }
        catch (e) { if (e.show) throw e; console.error("admin", body?.action, e); return reply(res, 400, { error: "Admin action failed: " + (e.message || "unknown error") }); }
      }
    } catch (e) {
      if (e.show) return reply(res, e.status || 400, { error: e.message, ...(e.extra || {}) });
      if (e instanceof SyntaxError) return reply(res, 400, { error: "bad request" });
      console.error(e);
      reply(res, e.code && String(e.code).startsWith("auth/") ? 401 : 500, { error: "Something went wrong. Try again." });
    }
  });
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`lifeofline-movies-api on ${PORT} · billing ${billing.MODE} · video ${stream.LIVE ? "live" : "test"}`));
  setTimeout(hourly, 30e3); setInterval(hourly, 36e5);
}
module.exports = { server, play, freeEpisode, me, admin, billing, stream };
