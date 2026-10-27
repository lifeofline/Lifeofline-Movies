// Offline checks for the API: who may play what, payments in test mode, webhook signatures, signed video links.
// Runs with fake Firebase (no network, no keys): `npm test` in server/.
const assert = require("assert");
const crypto = require("crypto");
const path = require("path");

/* ---------- a tiny in-memory Firestore ---------- */
const data = new Map(); // path -> object
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
const FieldValue = { delete: () => ({ __del: true }), serverTimestamp: () => Date.now(), increment: (n) => ({ __inc: n }), arrayUnion: (...a) => ({ __union: a }) };
function apply(prev, patch) {
  const out = { ...(prev || {}) };
  for (const [k, v] of Object.entries(patch)) { if (v && v.__del) delete out[k]; else if (v && v.__inc != null) out[k] = (out[k] || 0) + v.__inc; else out[k] = v; }
  return out;
}
function docRef(p) {
  return {
    id: p.split("/").pop(), path: p,
    async get() { const d = data.get(p); return { exists: d != null, id: p.split("/").pop(), data: () => clone(d), ref: docRef(p) }; },
    async set(v, o) { data.set(p, o?.merge ? apply(data.get(p), v) : apply({}, v)); },
    async update(v) { if (!data.has(p)) throw new Error("no doc " + p); data.set(p, apply(data.get(p), v)); },
  };
}
function collRef(p, filters = [], ord = null, lim = null) {
  const list = () => [...data.keys()].filter((k) => k.startsWith(p + "/") && k.slice(p.length + 1).split("/").length === 1)
    .map((k) => ({ k, d: data.get(k) }))
    .filter(({ d }) => filters.every(([f, op, v]) => (op === "==" ? d[f] === v : op === ">" ? d[f] > v : op === "<=" ? d[f] <= v : true)));
  return {
    doc: (id) => docRef(`${p}/${id || crypto.randomBytes(5).toString("hex")}`),
    where: (f, op, v) => collRef(p, [...filters, [f, op, v]], ord, lim),
    orderBy: (f) => collRef(p, filters, f, lim),
    limit: (n) => collRef(p, filters, ord, n),
    async add(v) { const r = docRef(`${p}/${crypto.randomBytes(5).toString("hex")}`); await r.set(v); return r; },
    count: () => ({ get: async () => ({ data: () => ({ count: list().length }) }) }),
    async get() {
      let l = list(); if (ord) l.sort((a, b) => a.d[ord] - b.d[ord]); if (lim) l = l.slice(0, lim);
      const docs = l.map(({ k, d }) => ({ id: k.split("/").pop(), exists: true, data: () => clone(d), ref: docRef(k) }));
      return { docs, empty: !docs.length, size: docs.length };
    },
  };
}
const db = {
  doc: docRef, collection: collRef,
  async runTransaction(fn) { return fn({ get: (r) => r.get(), set: (r, v, o) => r.set(v, o), update: (r, v) => r.update(v) }); },
};
const users = { u1: { uid: "u1", email: "viewer@example.com", emailVerified: true }, boss: { uid: "boss", email: "ibmhclms@gmail.com", emailVerified: true } };
const fakeAuth = {
  verifyIdToken: async (t) => ({ uid: t }),
  getUser: async (uid) => { if (!users[uid]) throw Object.assign(new Error("nf"), { code: "auth/user-not-found" }); return { ...users[uid], providerData: [] }; },
  getUserByEmail: async (e) => { const u = Object.values(users).find((x) => x.email === e); if (!u) throw new Error("nf"); return u; },
};
const stub = (name, exp) => { const id = require.resolve(name, { paths: [__dirname] }); require.cache[id] = { id, filename: id, loaded: true, exports: exp }; };
try {
  stub("firebase-admin/app", { initializeApp: () => ({}), cert: (x) => x });
  stub("firebase-admin/auth", { getAuth: () => fakeAuth });
  stub("firebase-admin/firestore", { getFirestore: () => db, FieldValue });
} catch {
  // firebase-admin isn't installed (no npm install yet): register the fakes under virtual paths instead.
  const Module = require("module"); const orig = Module._resolveFilename;
  const fakes = { "firebase-admin/app": { initializeApp: () => ({}), cert: (x) => x }, "firebase-admin/auth": { getAuth: () => fakeAuth }, "firebase-admin/firestore": { getFirestore: () => db, FieldValue } };
  Module._resolveFilename = function (req, ...a) { if (fakes[req]) { const id = "fake:" + req; require.cache[id] ||= { id, filename: id, loaded: true, exports: fakes[req] }; return id; } return orig.call(this, req, ...a); };
}

process.env.FIREBASE_SERVICE_ACCOUNT = "{}";
process.env.ADMIN_EMAILS = "ibmhclms@gmail.com";
process.env.APP_URL = "https://movies.example";
const S = require(path.join(__dirname, "server.js"));
const http = require("http");

async function req(port, p, body, token) {
  return new Promise((res, rej) => {
    const r = http.request({ port, path: p, method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) } }, (x) => {
      let b = ""; x.on("data", (c) => (b += c)); x.on("end", () => res({ status: x.statusCode, body: JSON.parse(b || "{}") }));
    });
    r.on("error", rej); if (body !== undefined) r.write(typeof body === "string" ? body : JSON.stringify(body)); r.end();
  });
}

(async () => {
  // catalogue
  data.set("titles/short1", { title: "Short", kind: "short", format: "v", premium: true, published: true, rating: "U/A 13+" });
  for (let n = 1; n <= 5; n++) data.set(`titles/short1/episodes/e${n}`, { n, videoUid: "test_s" + n });
  data.set("titles/movie1", { title: "Film", kind: "movie", premium: true, published: true, rating: "U/A 16+", trailerUid: "test_tr" });
  data.set("titles/movie1/episodes/e1", { n: 1, videoUid: "test_m" });
  data.set("titles/adult", { title: "Adult", kind: "series", premium: false, published: true, rating: "A" });
  data.set("titles/adult/episodes/e1", { n: 1, videoUid: "test_a" });
  data.set("titles/draft", { title: "Draft", kind: "movie", premium: false, published: false });
  data.set("titles/draft/episodes/e1", { n: 1, videoUid: "test_d" });
  data.set("users/u1", { name: "Viewer" });

  const srv = S.server.listen(0); const port = srv.address().port;
  let r;

  r = await req(port, "/health"); assert.equal(r.status, 200); assert.equal(r.body.billing, "test"); assert.equal(r.body.video, "test");

  // free rules
  r = await req(port, "/play", { titleId: "short1", epId: "e3" }); assert.equal(r.status, 200, "ep 3 of a premium short is free"); assert.equal(r.body.result.ads, true);
  r = await req(port, "/play", { titleId: "short1", epId: "e4" }); assert.equal(r.status, 402); assert.equal(r.body.needPlan, true);
  r = await req(port, "/play", { titleId: "movie1" }); assert.equal(r.status, 402, "premium movie locked");
  r = await req(port, "/play", { titleId: "movie1", trailer: true }); assert.equal(r.status, 200); assert.equal(r.body.result.ads, false);
  r = await req(port, "/play", { titleId: "draft" }); assert.equal(r.status, 404, "drafts hidden");
  r = await req(port, "/play", { titleId: "../x" }); assert.equal(r.status, 400);
  r = await req(port, "/play", "{bad json"); assert.equal(r.status, 400);

  // A rating
  r = await req(port, "/play", { titleId: "adult" }); assert.equal(r.status, 401); assert.equal(r.body.needSignIn, true);
  r = await req(port, "/play", { titleId: "adult" }, "u1"); assert.equal(r.status, 403); assert.equal(r.body.needAge, true);
  r = await req(port, "/me", { action: "setDob", dob: "2012-01-01" }, "u1"); assert.equal(r.body.result.adult, false);
  r = await req(port, "/me", { action: "setDob", dob: "1990-01-01" }, "u1"); assert.equal(r.status, 400, "dob can't be changed");
  data.delete("users/u1/private/age"); data.set("users/u1", { name: "Viewer" });
  r = await req(port, "/me", { action: "setDob", dob: "1990-01-01" }, "u1"); assert.equal(r.body.result.adult, true);
  r = await req(port, "/play", { titleId: "adult" }, "u1"); assert.equal(r.status, 200);

  // Premium in test mode
  r = await req(port, "/sub", { action: "status" }); assert.equal(r.status, 401, "needs sign-in");
  r = await req(port, "/sub", { action: "start" }, "u1"); assert.equal(r.body.result.mode, "test");
  r = await req(port, "/sub", { action: "verify" }, "u1"); assert.ok(r.body.result.until > Date.now() + 29 * 864e5);
  r = await req(port, "/play", { titleId: "short1", epId: "e5" }, "u1"); assert.equal(r.status, 200); assert.equal(r.body.result.ads, false, "no ads for Premium");
  r = await req(port, "/play", { titleId: "movie1" }, "u1"); assert.equal(r.status, 200);
  r = await req(port, "/sub", { action: "cancel" }, "u1"); assert.equal(r.status, 200);
  r = await req(port, "/sub", { action: "status" }, "u1"); assert.equal(r.body.result.premium, true, "still Premium till period end"); assert.equal(r.body.result.sub.status, "cancelling");

  // admin
  r = await req(port, "/admin", { action: "stats" }, "u1"); assert.equal(r.status, 403);
  r = await req(port, "/me", { action: "claimAdmin" }, "u1"); assert.equal(r.status, 403);
  r = await req(port, "/me", { action: "claimAdmin" }, "boss"); assert.equal(r.status, 200);
  r = await req(port, "/admin", { action: "stats" }, "boss"); assert.equal(r.body.result.titles, 4); assert.equal(r.body.result.premium, 1);
  r = await req(port, "/admin", { action: "upload", size: 1000, name: "ep.mp4" }, "boss"); assert.ok(r.body.result.uid.startsWith("test_"));
  r = await req(port, "/admin", { action: "grant", email: "nobody@x.com", days: 30 }, "boss"); assert.equal(r.status, 404);
  r = await req(port, "/play", { titleId: "draft" }, "boss"); assert.equal(r.status, 200, "admins can preview drafts");

  // webhook: needs the secret and a valid signature; ignores ArtistCart's payments
  r = await req(port, "/pay/webhook", { event: "x" }); assert.equal(r.status, 400);
  srv.close();

  process.env.RAZORPAY_WEBHOOK_SECRET = "whsec";
  const makeBilling = require("./billing.js");
  const mails = [];
  const B = makeBilling({ db, FieldValue, env: process.env, sendEmail: async (...a) => mails.push(a), link: (p) => p });
  const sign = (raw) => crypto.createHmac("sha256", "whsec").update(raw).digest("hex");
  let raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_artistcart", notes: {} } } } });
  assert.deepEqual((await B.webhook(raw, sign(raw))).body, { ok: true, ignored: true });
  assert.equal((await B.webhook(raw, "bad")).status, 401);
  const end = Math.floor(Date.now() / 1000) + 30 * 86400;
  raw = JSON.stringify({ event: "subscription.charged", payload: { subscription: { entity: { id: "sub_1", current_end: end, notes: { uid: "u2", app: "lifeofline-movies" } } }, payment: { entity: { id: "pay_2" } } } });
  assert.equal((await B.webhook(raw, sign(raw))).status, 200);
  assert.equal(data.get("subs/u2").status, "active"); assert.ok(data.get("subs/u2").until >= end * 1000);
  raw = JSON.stringify({ event: "subscription.halted", payload: { subscription: { entity: { id: "sub_1", notes: { uid: "u2", app: "lifeofline-movies" } } } } });
  await B.webhook(raw, sign(raw)); assert.equal(await B.isPremium("u2"), false, "halted = no Premium");
  // pass orders: paid once only, even if both the app and the webhook report it
  data.set("passOrders/order_9", { uid: "u3", status: "created" });
  raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_9", order_id: "order_9", notes: {} } } } });
  await B.webhook(raw, sign(raw)); const u1 = data.get("subs/u3").until;
  await B.webhook(raw, sign(raw)); assert.equal(data.get("subs/u3").until, u1, "no double extension");

  // signed Cloudflare links: valid RS256 JWT for the video
  const makeStream = require("./stream.js");
  const st = makeStream({ db, env: {} });
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const tok = st.sign("abc123", { id: "kid1", pem: privateKey.export({ type: "pkcs1", format: "pem" }) }, 1);
  const [h, b, s] = tok.split(".");
  assert.ok(crypto.createVerify("RSA-SHA256").update(`${h}.${b}`).verify(publicKey, Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64")));
  const pl = JSON.parse(Buffer.from(b.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  assert.equal(pl.sub, "abc123"); assert.equal(pl.kid, "kid1"); assert.ok(pl.exp > Date.now() / 1000);

  console.log("All API checks passed.");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
